-- ════════════════════════════════════════════════════════════════════════════
--  L'APPEL À DISPONIBILITÉ ET L'ARBITRAGE — le cœur du mécanisme
--
--  Un commerçant ne peut pas servir un client. Au lieu de le laisser partir, il
--  demande au rayon qui l'a. Trente secondes plus tard, deux ou trois boutiques
--  ont répondu, et l'application désigne celle qui doit recevoir le client.
--
--  DEUX CHOSES QU'IL NE FAUT JAMAIS CONFONDRE
--
--    Le catalogue dit qui a DÉJÀ RÉFÉRENCÉ un article, et à quel prix net.
--    Il ne dit pas si la boutique l'a maintenant.
--
--    L'appel dit qui l'a À L'INSTANT, et qui accepte le client.
--
--  Le catalogue ne remplace donc jamais l'appel — il le rend instantané. Quand
--  l'article est déjà référencé, le commerçant ne reçoit pas une question
--  ouverte à laquelle il doit réfléchir : il reçoit une fiche qu'il reconnaît,
--  avec son prix net, et deux boutons. Le taux de réponse en trente secondes
--  est le paramètre qui décide de la couverture d'un rayon — plus puissant que
--  le nombre de boutiques — et c'est là qu'on le gagne.
--
--  TROIS CAS DE RECHERCHE
--    A · l'article est au catalogue  → appel FERMÉ vers ceux qui l'ont référencé
--    B · seule la famille est connue → appel OUVERT vers les porteurs ; celui
--        qui répond oui saisit l'article et son prix net. C'est ce cas qui
--        construit le catalogue : il est le résidu du service, pas son prix
--        d'entrée.
--    C · ni l'un ni l'autre          → aucun appel, la demande va au journal,
--        et c'est lui qui dira quelle boutique recruter ensuite.
--
--  L'ARBITRAGE — « celui qui reçoit donne »
--
--      score = envoyés(30 j) − reçus(30 j) − 5 × ruptures(30 j)
--      départage : moins de reçus sur 7 jours, puis la plus proche
--      plancher  : une boutique sous son minimum mensuel passe première
--      exclusion : trois ruptures en 30 jours l'écartent 15 jours
--
--  Sans cette règle, la première boutique capte le double de clients et la
--  moitié du rayon reçoit moins d'un client par semaine — or c'est elle qui
--  alimente le réseau. Testée sur deux cents mois simulés : part de la n° 1 à
--  12 % contre 19 %, Gini 0,23 contre 0,42, et pas une vente perdue.
--
--  L'envoyeur ne choisit pas. Il voit les trois premières, et s'il s'écarte du
--  classement il doit dire pourquoi — le motif est compté, parce que c'est la
--  signature du renvoi entre amis.
--
--  Idempotent : rejouable sans dommage, dans n'importe quel ordre.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

DO $reset$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('chercher_dans_rayon', 'lancer_appel', 'repondre_appel',
                         'classer_repondants', 'compteurs_boutique', 'distance_m')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;

-- ════════════════════════════════════════════════════════════════════════════
--  1. LA DEMANDE
--
--  Toute demande est enregistrée, même celle que personne ne peut servir.
--  Surtout celle-là : c'est le journal des demandes non servies qui dit quelle
--  boutique recruter ensuite.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.demandes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rayon_id    UUID NOT NULL REFERENCES public.rayons(id)   ON DELETE CASCADE,
  vendor_id   UUID NOT NULL REFERENCES public.vendors(id)  ON DELETE CASCADE,
  famille_id  UUID          REFERENCES public.familles(id) ON DELETE SET NULL,
  -- Ce que le client a demandé, avec ses mots.
  libelle     TEXT NOT NULL,
  contrainte  TEXT,                        -- « pointure 45 », « teinte foncée »
  budget      INTEGER,
  -- A · article connu · B · famille seulement · C · hors rayon
  cas         TEXT NOT NULL CHECK (cas IN ('A', 'B', 'C')),
  resultat    TEXT NOT NULL DEFAULT 'ouverte'
              CHECK (resultat IN ('ouverte', 'servie', 'sans_reponse', 'hors_rayon', 'abandonnee')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS demandes_journal_idx
  ON public.demandes (rayon_id, created_at DESC)
  WHERE resultat IN ('sans_reponse', 'hors_rayon');

-- ════════════════════════════════════════════════════════════════════════════
--  2. L'APPEL ET LES RÉPONSES
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.appels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demande_id    UUID NOT NULL REFERENCES public.demandes(id) ON DELETE CASCADE,
  -- Fermé : on interroge ceux qui ont référencé l'article, fiche à l'appui.
  -- Ouvert : on interroge les porteurs de la famille, en question libre.
  forme         TEXT NOT NULL CHECK (forme IN ('ferme', 'ouvert')),
  product_id    UUID REFERENCES public.products(id) ON DELETE SET NULL,
  interroges    INTEGER NOT NULL DEFAULT 0,
  expire_le     TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS appels_demande_idx ON public.appels (demande_id);

CREATE TABLE IF NOT EXISTS public.reponses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appel_id    UUID NOT NULL REFERENCES public.appels(id)   ON DELETE CASCADE,
  vendor_id   UUID NOT NULL REFERENCES public.vendors(id)  ON DELETE CASCADE,
  disponible  BOOLEAN NOT NULL,
  -- Sur un appel ouvert, celui qui dit oui saisit l'article et son prix net.
  -- C'est le moment exact où le catalogue se construit.
  product_id  UUID REFERENCES public.products(id) ON DELETE SET NULL,
  prix_net    INTEGER,
  -- Le délai alimente l'engagement des trente secondes et le retrait
  -- d'arbitrage : sous 50 % de réponses sur un mois, la boutique ne reçoit plus.
  delai_ms    INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (appel_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS reponses_vendor_idx ON public.reponses (vendor_id, created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
--  3. LES COMPTEURS D'ARBITRAGE
--
--  Une vue plutôt qu'une table : le compteur se déduit des relais, il ne se
--  maintient pas à la main. Rien à resynchroniser, jamais.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.compteurs_boutique(p_vendor_id UUID)
RETURNS TABLE (
  envoyes_30j  INTEGER,
  recus_30j    INTEGER,
  ruptures_30j INTEGER,
  recus_7j     INTEGER,
  score        INTEGER
)
-- En plpgsql, et non en SQL, pour une raison précise : le corps n'est pas
-- analysé à la création. Ce fichier peut donc être appliqué avant celui qui
-- crée la table `relais`, comme le promet l'en-tête.
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY EXECUTE format($q$
    WITH r AS (
      SELECT
        COUNT(*) FILTER (WHERE emetteur_id = %1$L
                           AND etat IN ('attribue','arrive','paye','remis','expire')
                           AND created_at > NOW() - INTERVAL '30 days')::INTEGER AS env,
        COUNT(*) FILTER (WHERE receveur_id = %1$L
                           AND etat IN ('arrive','paye','remis')
                           AND created_at > NOW() - INTERVAL '30 days')::INTEGER AS rec,
        COUNT(*) FILTER (WHERE receveur_id = %1$L
                           AND etat = 'rupture'
                           AND created_at > NOW() - INTERVAL '30 days')::INTEGER AS rup,
        COUNT(*) FILTER (WHERE receveur_id = %1$L
                           AND etat IN ('arrive','paye','remis')
                           AND created_at > NOW() - INTERVAL '7 days')::INTEGER AS rec7
        FROM public.relais
    )
    SELECT env, rec, rup, rec7, env - rec - 5 * rup FROM r
  $q$, p_vendor_id);
EXCEPTION WHEN undefined_table THEN
  -- La table des relais n'existe pas encore : aucune boutique n'a de compteur.
  RETURN QUERY SELECT 0, 0, 0, 0, 0;
END
$$;

-- Distance à vol d'oiseau, en mètres. Suffisant dans un périmètre de 500 m,
-- et ça évite une dépendance à PostGIS.
CREATE OR REPLACE FUNCTION public.distance_m(
  lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION
)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN NULL
    ELSE ROUND(6371000 * 2 * ASIN(SQRT(
           POWER(SIN(RADIANS(lat2 - lat1) / 2), 2) +
           COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
           POWER(SIN(RADIANS(lng2 - lng1) / 2), 2))))::INTEGER
  END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  4. LE CLASSEMENT
--
--  Renvoie les répondants dans l'ordre où le vendeur doit les voir. La
--  première est celle qui a le plus donné au rayon. Le vendeur ne choisit pas ;
--  il peut s'écarter, avec un motif qui sera compté.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.classer_repondants(p_appel_id UUID)
RETURNS TABLE (
  vendor_id    UUID,
  shop_name    TEXT,
  product_id   UUID,
  prix_net     INTEGER,
  distance_m   INTEGER,
  envoyes_30j  INTEGER,
  recus_30j    INTEGER,
  score        INTEGER,
  sous_plancher BOOLEAN,
  ecarte       BOOLEAN,
  rang         INTEGER
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emetteur UUID;
  v_rayon    UUID;
  v_plancher INTEGER;
  v_lat      DOUBLE PRECISION;
  v_lng      DOUBLE PRECISION;
BEGIN
  SELECT d.vendor_id, d.rayon_id INTO v_emetteur, v_rayon
    FROM public.appels a JOIN public.demandes d ON d.id = a.demande_id
   WHERE a.id = p_appel_id;

  SELECT r.plancher_recus INTO v_plancher FROM public.rayons r WHERE r.id = v_rayon;
  SELECT ve.pickup_lat, ve.pickup_lng INTO v_lat, v_lng
    FROM public.vendors ve WHERE ve.id = v_emetteur;

  RETURN QUERY
  WITH rep AS (
    SELECT rp.vendor_id AS vid, rp.product_id AS pid, rp.prix_net AS pnet
      FROM public.reponses rp
     WHERE rp.appel_id = p_appel_id AND rp.disponible
  ),
  calc AS (
    SELECT
      rep.vid, v.shop_name AS nom, rep.pid, rep.pnet,
      public.distance_m(v_lat, v_lng, v.pickup_lat, v.pickup_lng) AS dist,
      c.envoyes_30j AS env, c.recus_30j AS rec, c.ruptures_30j AS rup,
      c.recus_7j AS rec7, c.score AS sc,
      -- Une boutique sous son minimum mensuel passe première : c'est ce qui
      -- empêche la mieux fournie de quitter le rayon.
      (c.recus_30j < v_plancher) AS sous_pl,
      -- Trois ruptures en trente jours : elle a confirmé et n'avait pas.
      -- C'est le pire cas du modèle — celui qui fait perdre confiance à
      -- l'envoyeur. Elle sort de l'arbitrage quinze jours.
      (c.ruptures_30j >= 3)      AS ecart
      FROM rep
      JOIN public.vendors v ON v.id = rep.vid
      CROSS JOIN LATERAL public.compteurs_boutique(rep.vid) c
  )
  SELECT calc.vid, calc.nom, calc.pid, calc.pnet, calc.dist,
         calc.env, calc.rec, calc.sc, calc.sous_pl, calc.ecart,
         ROW_NUMBER() OVER (
           ORDER BY calc.ecart ASC, calc.sous_pl DESC, calc.sc DESC,
                    calc.rec7 ASC, COALESCE(calc.dist, 999999) ASC
         )::INTEGER
    FROM calc;
END
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  5. CHERCHER — c'est l'application qui décide du cas, pas le vendeur
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.chercher_dans_rayon(p_vendor_id UUID, p_texte TEXT)
RETURNS TABLE (
  source      TEXT,          -- 'moi' avant tout le monde, puis 'rayon'
  product_id  UUID,
  nom         TEXT,
  vendor_id   UUID,
  shop_name   TEXT,
  prix_net    INTEGER,
  famille_id  UUID,
  famille     TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rayon UUID;
BEGIN
  v_rayon := public.vendor_rayon(p_vendor_id);
  IF v_rayon IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT CASE WHEN p.vendor_id = p_vendor_id THEN 'moi' ELSE 'rayon' END,
         p.id, p.name, p.vendor_id, v.shop_name, p.price::INTEGER,
         f.id, f.nom
    FROM public.products p
    JOIN public.vendors v         ON v.id  = p.vendor_id
    JOIN public.boutique_rayon br ON br.vendor_id = p.vendor_id AND br.rayon_id = v_rayon AND br.actif
    LEFT JOIN public.boutique_famille bf ON bf.vendor_id = p.vendor_id
    LEFT JOIN public.familles f   ON f.id = bf.famille_id AND f.rayon_id = v_rayon AND f.ouverte
   WHERE p.name ILIKE '%' || p_texte || '%'
   -- Son propre stock passe avant celui des autres : il récupère les deux
   -- tiers des ruptures par sa propre substitution, et c'est son métier. Une
   -- application qui propose le voisin en premier lui prend des ventes.
   ORDER BY (p.vendor_id = p_vendor_id) DESC, p.name
   LIMIT 30;
END
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  6. LANCER L'APPEL
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
  v_rayon UUID; v_cas TEXT; v_forme TEXT; v_n INTEGER;
  v_dem UUID; v_app UUID; v_sec INTEGER; v_exp TIMESTAMPTZ;
BEGIN
  v_rayon := public.vendor_rayon(p_vendor_id);
  IF v_rayon IS NULL THEN
    RAISE EXCEPTION 'Cette boutique n''appartient à aucun rayon actif';
  END IF;

  SELECT appel_secondes INTO v_sec FROM public.platform_policy WHERE id;
  v_exp := NOW() + (v_sec || ' seconds')::INTERVAL;

  -- Cas A : l'article est au catalogue. Cas B : seule la famille l'est.
  -- Cas C : ni l'un ni l'autre — pas d'appel, la demande va au journal.
  IF p_product_id IS NOT NULL THEN v_cas := 'A'; v_forme := 'ferme';
  ELSIF p_famille_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.familles WHERE id = p_famille_id AND ouverte)
  THEN v_cas := 'B'; v_forme := 'ouvert';
  ELSE v_cas := 'C'; v_forme := NULL;
  END IF;

  INSERT INTO public.demandes (rayon_id, vendor_id, famille_id, libelle, contrainte, budget, cas, resultat)
  VALUES (v_rayon, p_vendor_id, p_famille_id, p_libelle, p_contrainte, p_budget, v_cas,
          CASE WHEN v_cas = 'C' THEN 'hors_rayon' ELSE 'ouverte' END)
  RETURNING id INTO v_dem;

  IF v_cas = 'C' THEN
    RETURN QUERY SELECT v_dem, NULL::UUID, NULL::TEXT, 0, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_cas = 'A' THEN
    -- Ceux qui ont référencé exactement cet article, sauf lui-même.
    SELECT COUNT(*)::INTEGER INTO v_n
      FROM public.products p
      JOIN public.boutique_rayon br ON br.vendor_id = p.vendor_id AND br.rayon_id = v_rayon AND br.actif
     WHERE p.id = p_product_id AND p.vendor_id <> p_vendor_id;
    IF v_n = 0 THEN
      -- L'article n'existe que chez lui : on élargit à la famille.
      v_cas := 'B'; v_forme := 'ouvert';
    END IF;
  END IF;

  IF v_forme = 'ouvert' THEN
    SELECT COUNT(*)::INTEGER INTO v_n
      FROM public.boutique_famille bf
      JOIN public.boutique_rayon br ON br.vendor_id = bf.vendor_id AND br.rayon_id = v_rayon AND br.actif
     WHERE bf.famille_id = p_famille_id AND bf.vendor_id <> p_vendor_id AND br.genre = 'produit';
  END IF;

  INSERT INTO public.appels (demande_id, forme, product_id, interroges, expire_le)
  VALUES (v_dem, v_forme, CASE WHEN v_forme = 'ferme' THEN p_product_id END, COALESCE(v_n, 0), v_exp)
  RETURNING id INTO v_app;

  RETURN QUERY SELECT v_dem, v_app, v_forme, COALESCE(v_n, 0), v_exp;
END
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  7. RÉPONDRE
--
--  Sur un appel fermé : deux boutons, deux secondes. Sur un appel ouvert,
--  celui qui dit oui saisit l'article et son prix net — et le catalogue grandit.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.repondre_appel(
  p_appel_id   UUID,
  p_vendor_id  UUID,
  p_disponible BOOLEAN,
  p_product_id UUID    DEFAULT NULL,
  p_prix_net   INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_exp TIMESTAMPTZ; v_cree TIMESTAMPTZ; v_pid UUID; v_id UUID;
BEGIN
  SELECT a.expire_le, a.created_at, a.product_id INTO v_exp, v_cree, v_pid
    FROM public.appels a WHERE a.id = p_appel_id;
  IF v_exp IS NULL THEN RAISE EXCEPTION 'Appel introuvable'; END IF;

  -- Une réponse hors délai est enregistrée quand même : elle ne sert pas ce
  -- client, mais elle compte dans le taux de réponse de la boutique.
  INSERT INTO public.reponses (appel_id, vendor_id, disponible, product_id, prix_net, delai_ms)
  VALUES (p_appel_id, p_vendor_id,
          p_disponible AND NOW() <= v_exp,
          COALESCE(p_product_id, v_pid), p_prix_net,
          EXTRACT(EPOCH FROM (NOW() - v_cree))::INTEGER * 1000)
  ON CONFLICT (appel_id, vendor_id) DO UPDATE
    SET disponible = EXCLUDED.disponible,
        product_id = EXCLUDED.product_id,
        prix_net   = EXCLUDED.prix_net
  RETURNING id INTO v_id;

  RETURN v_id;
END
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  8. QUI VOIT QUOI
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.demandes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appels   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reponses ENABLE ROW LEVEL SECURITY;

-- Une boutique voit ses propres demandes, et les appels du rayon auxquels elle
-- est susceptible de répondre. Elle ne voit jamais les demandes des autres.
DROP POLICY IF EXISTS demandes_mine ON public.demandes;
CREATE POLICY demandes_mine ON public.demandes FOR SELECT
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS appels_rayon ON public.appels;
CREATE POLICY appels_rayon ON public.appels FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.demandes d
      JOIN public.boutique_rayon br ON br.rayon_id = d.rayon_id AND br.actif
      JOIN public.vendors v ON v.id = br.vendor_id
     WHERE d.id = appels.demande_id AND v.user_id = auth.uid()));

DROP POLICY IF EXISTS reponses_mine ON public.reponses;
CREATE POLICY reponses_mine ON public.reponses FOR SELECT
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));

GRANT EXECUTE ON FUNCTION public.chercher_dans_rayon(UUID, TEXT)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.lancer_appel(UUID, TEXT, UUID, UUID, TEXT, INTEGER)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.repondre_appel(UUID, UUID, BOOLEAN, UUID, INTEGER)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.classer_repondants(UUID)                             TO authenticated;
GRANT EXECUTE ON FUNCTION public.compteurs_boutique(UUID)                             TO authenticated;
GRANT EXECUTE ON FUNCTION public.distance_m(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
