-- ════════════════════════════════════════════════════════════════════════════
--  RÉPONDRE À L'APPEL — la moitié qui manquait
--
--  Le fichier 24 sait lancer un appel et classer ceux qui ont répondu. Il ne
--  disait nulle part comment une boutique voit qu'on l'interroge. Sans ça,
--  personne ne répond jamais, aucun relais n'aboutit, et le mécanisme entier
--  reste à l'arrêt même quand tout le reste fonctionne.
--
--  ET UNE ERREUR À CORRIGER
--
--  `lancer_appel` cherchait le cas A — « l'article est au catalogue » — en
--  comptant les boutiques ayant le produit d'identifiant p_product_id. Or une
--  ligne de `products` appartient à une seule boutique : ce compte valait
--  toujours zéro, et tous les appels retombaient en question ouverte.
--
--  Tant qu'il n'y a pas de référence partagée entre boutiques, on rapproche
--  par le nom. C'est grossier et ça suffit ici : dans un rayon, « Timberland
--  6-inch 45 » et « Timberland 6 inch noir 45 » désignent la même chose pour
--  celui qui doit répondre oui ou non. Le jour où un catalogue de références
--  existera, c'est cette fonction et elle seule qu'il faudra reprendre.
--
--  Idempotent : rejouable sans dommage, dans n'importe quel ordre.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

DO $trg$
BEGIN
  -- Un déclencheur dépend de sa fonction : PostgreSQL refuse de supprimer la
  -- seconde tant que le premier existe. On les retire donc d'abord, et ce
  -- fichier les recrée plus bas.
  DROP TRIGGER IF EXISTS trg_notifier_appel     ON public.appels;
  DROP TRIGGER IF EXISTS trg_notifier_relais_ins ON public.relais;
  DROP TRIGGER IF EXISTS trg_notifier_relais_upd ON public.relais;
EXCEPTION WHEN undefined_table THEN NULL;
END
$trg$;

DO $reset$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('lancer_appel', 'appels_en_attente', 'boutiques_ciblees',
                         'notifier_appel', 'mon_appel')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;

-- ════════════════════════════════════════════════════════════════════════════
--  1. QUI EST INTERROGÉ
--
--  Une seule définition du ciblage, utilisée par l'appel, par le déclencheur de
--  notification et par la liste d'attente. Trois copies de cette règle auraient
--  divergé au premier changement.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.boutiques_ciblees(
  p_rayon_id UUID, p_emetteur UUID, p_famille_id UUID, p_libelle TEXT
)
RETURNS TABLE (vendor_id UUID, product_id UUID, prix_net INTEGER, ferme BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT br.vendor_id,
         -- L'article que CETTE boutique a référencé, s'il existe : c'est lui
         -- qu'on lui montrera, avec sa photo et son prix à elle.
         (SELECT p.id   FROM public.products p
           WHERE p.vendor_id = br.vendor_id
             AND (p.name ILIKE '%' || p_libelle || '%' OR p_libelle ILIKE '%' || p.name || '%')
           ORDER BY length(p.name) LIMIT 1),
         (SELECT p.price::INTEGER FROM public.products p
           WHERE p.vendor_id = br.vendor_id
             AND (p.name ILIKE '%' || p_libelle || '%' OR p_libelle ILIKE '%' || p.name || '%')
           ORDER BY length(p.name) LIMIT 1),
         EXISTS (SELECT 1 FROM public.products p
                  WHERE p.vendor_id = br.vendor_id
                    AND (p.name ILIKE '%' || p_libelle || '%' OR p_libelle ILIKE '%' || p.name || '%'))
    FROM public.boutique_rayon br
   WHERE br.rayon_id = p_rayon_id
     AND br.actif
     AND br.genre = 'produit'
     AND br.vendor_id <> p_emetteur
     AND (
       -- Elle a l'article au catalogue…
       EXISTS (SELECT 1 FROM public.products p
                WHERE p.vendor_id = br.vendor_id
                  AND (p.name ILIKE '%' || p_libelle || '%' OR p_libelle ILIKE '%' || p.name || '%'))
       -- …ou elle porte la famille, ce qui suffit à lui poser la question.
       OR (p_famille_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM public.boutique_famille bf
              WHERE bf.vendor_id = br.vendor_id AND bf.famille_id = p_famille_id))
     );
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  2. LANCER L'APPEL — corrigé
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.lancer_appel(
  p_vendor_id  UUID,
  p_libelle    TEXT,
  p_famille_id UUID    DEFAULT NULL,
  p_product_id UUID    DEFAULT NULL,
  p_contrainte TEXT    DEFAULT NULL,
  p_budget     INTEGER DEFAULT NULL
)
RETURNS TABLE (demande_id UUID, appel_id UUID, forme TEXT, interroges INTEGER, expire_le TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rayon UUID; v_cas TEXT; v_forme TEXT;
  v_n INTEGER; v_n_ferme INTEGER;
  v_dem UUID; v_app UUID; v_sec INTEGER; v_exp TIMESTAMPTZ;
BEGIN
  v_rayon := public.vendor_rayon(p_vendor_id);
  IF v_rayon IS NULL THEN
    RAISE EXCEPTION 'Cette boutique n''appartient à aucun rayon actif';
  END IF;

  SELECT appel_secondes INTO v_sec FROM public.platform_policy WHERE id;
  v_exp := NOW() + (v_sec || ' seconds')::INTERVAL;

  SELECT COUNT(*)::INTEGER, COUNT(*) FILTER (WHERE c.ferme)::INTEGER
    INTO v_n, v_n_ferme
    FROM public.boutiques_ciblees(v_rayon, p_vendor_id, p_famille_id, p_libelle) c;

  -- Cas A : au moins une boutique a l'article au catalogue. Elle reçoit une
  -- fiche qu'elle reconnaît et deux boutons — deux secondes au lieu d'une
  -- minute, et c'est le taux de réponse qui décide de la couverture du rayon.
  -- Cas B : personne ne l'a référencé mais la famille est portée : question
  -- ouverte, et celui qui répond oui saisit l'article. C'est ainsi que le
  -- catalogue se construit.
  -- Cas C : personne. La demande part au journal de recrutement.
  IF v_n = 0 THEN
    v_cas := 'C'; v_forme := NULL;
  ELSIF v_n_ferme > 0 THEN
    v_cas := 'A'; v_forme := 'ferme';
  ELSE
    v_cas := 'B'; v_forme := 'ouvert';
  END IF;

  INSERT INTO public.demandes (rayon_id, vendor_id, famille_id, libelle, contrainte, budget, cas, resultat)
  VALUES (v_rayon, p_vendor_id, p_famille_id, p_libelle, p_contrainte, p_budget, v_cas,
          CASE WHEN v_cas = 'C' THEN 'hors_rayon' ELSE 'ouverte' END)
  RETURNING id INTO v_dem;

  IF v_cas = 'C' THEN
    RETURN QUERY SELECT v_dem, NULL::UUID, NULL::TEXT, 0, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  INSERT INTO public.appels (demande_id, forme, product_id, interroges, expire_le)
  VALUES (v_dem, v_forme, p_product_id, v_n, v_exp)
  RETURNING id INTO v_app;

  RETURN QUERY SELECT v_dem, v_app, v_forme, v_n, v_exp;
END
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  3. CE QU'UNE BOUTIQUE DOIT VOIR TOUT DE SUITE
--
--  Les appels en cours qui la concernent et auxquels elle n'a pas répondu.
--  Trente secondes : c'est court, et c'est fait exprès — au-delà, le client
--  debout devant l'autre comptoir est déjà parti.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.appels_en_attente(p_vendor_id UUID)
RETURNS TABLE (
  appel_id    UUID,
  forme       TEXT,
  libelle     TEXT,
  contrainte  TEXT,
  budget      INTEGER,
  famille     TEXT,
  demandeur   TEXT,
  distance_m  INTEGER,
  product_id  UUID,
  produit     TEXT,
  photo       TEXT,
  prix_net    INTEGER,
  expire_le   TIMESTAMPTZ,
  reste_s     INTEGER
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rayon UUID;
BEGIN
  v_rayon := public.vendor_rayon(p_vendor_id);
  IF v_rayon IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT a.id, a.forme, d.libelle, d.contrainte, d.budget, f.nom, ve.shop_name,
         public.distance_m(ve.pickup_lat, ve.pickup_lng, moi.pickup_lat, moi.pickup_lng),
         c.product_id, p.name, p.img, c.prix_net,
         a.expire_le,
         GREATEST(0, CEIL(EXTRACT(EPOCH FROM (a.expire_le - NOW()))))::INTEGER
    FROM public.appels a
    JOIN public.demandes d ON d.id = a.demande_id
    JOIN public.vendors  ve ON ve.id = d.vendor_id
    JOIN public.vendors  moi ON moi.id = p_vendor_id
    LEFT JOIN public.familles f ON f.id = d.famille_id
    CROSS JOIN LATERAL public.boutiques_ciblees(d.rayon_id, d.vendor_id, d.famille_id, d.libelle) c
    LEFT JOIN public.products p ON p.id = c.product_id
   WHERE d.rayon_id = v_rayon
     AND c.vendor_id = p_vendor_id
     AND a.expire_le > NOW()
     AND NOT EXISTS (SELECT 1 FROM public.reponses r
                      WHERE r.appel_id = a.id AND r.vendor_id = p_vendor_id)
   ORDER BY a.created_at;
END
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  4. LE DÉCLENCHEUR DE NOTIFICATION — même ciblage, une seule vérité
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.notifier_appel()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.demandes; v_titre TEXT; v_corps TEXT;
BEGIN
  SELECT * INTO d FROM public.demandes WHERE id = NEW.demande_id;

  v_titre := CASE WHEN NEW.forme = 'ferme' THEN 'Tu as encore ça ?' ELSE 'Quelqu''un cherche' END;
  v_corps := d.libelle ||
             COALESCE(' · ' || d.contrainte, '') ||
             ' — réponds en 30 secondes';

  INSERT INTO public.relais_notifications (vendor_id, genre, titre, corps, lien, appel_id)
  SELECT c.vendor_id, 'appel', v_titre, v_corps, '/admin?section=relais', NEW.id
    FROM public.boutiques_ciblees(d.rayon_id, d.vendor_id, d.famille_id, d.libelle) c
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_notifier_appel ON public.appels;
CREATE TRIGGER trg_notifier_appel
  AFTER INSERT ON public.appels
  FOR EACH ROW EXECUTE FUNCTION public.notifier_appel();

GRANT EXECUTE ON FUNCTION public.boutiques_ciblees(UUID, UUID, UUID, TEXT)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.appels_en_attente(UUID)                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.lancer_appel(UUID, TEXT, UUID, UUID, TEXT, INTEGER)   TO authenticated;
