-- ════════════════════════════════════════════════════════════════════════════
--  LE RELAIS — douze états, et rien d'autre
--
--  Un relais naît quand une boutique a trouvé preneur pour un client qu'elle
--  ne pouvait pas servir. Il meurt quand le client a son article en main, ou
--  quand il n'y est jamais allé.
--
--      demande ──► appel ──┬─► sans_reponse                        (terminal)
--                          └─► propositions ──┬─► abandonne        (terminal)
--                                             └─► attribue  48 h
--                                                    ├─► expire   (terminal)
--                                                    └─► arrive
--                                                         ├─► rupture ─► re-relais
--                                                         ├─► annule  (terminal)
--                                                         └─► paye ─► remis
--
--  L'ARGENT NE BOUGE QU'À `remis`. Un bon réservé n'est pas un revenu : tant
--  que la vente n'est pas confirmée au comptoir, la commission n'existe pas.
--
--  LES TROIS ÉTATS QU'ON OUBLIE TOUJOURS
--
--    expire  — le client n'y est jamais allé. Aucun bon crédité, et l'envoyeur
--              reçoit une notification neutre. Surtout pas de reproche : il a
--              fait son travail, c'est le client qui a changé d'avis.
--    rupture — la boutique avait confirmé et n'avait plus. C'est le pire cas du
--              modèle, celui qui fait perdre confiance à l'envoyeur. Le client
--              est re-relayé depuis où il se trouve, jamais renvoyé chez lui,
--              et la boutique prend une pénalité dans l'arbitrage.
--    annule  — il est venu, il a regardé, il n'a pas acheté. Personne n'est
--              fautif, aucune pénalité. Mais ça se compte : une boutique dont
--              la moitié des clients relayés repartent a un problème de prix ou
--              d'accueil, et ça se voit avant sa note.
--
--  LE CODE. Six caractères, sans 0/O/1/I pour qu'il se lise à voix haute dans
--  une allée bruyante. Il n'a PAS besoin d'être vérifiable hors ligne : le
--  paiement qui suit trente secondes plus tard exige du réseau de toute façon.
--
--  UN SEUL COMPTE PAR BOUTIQUE, celui du patron, connecté sur le téléphone de
--  celui qui tient le comptoir. Le renvoi se compte par boutique, jamais par
--  personne — le patron sait très bien qui l'a fait, et il verse sa prime en
--  billets. L'application ne touche jamais cet argent.
--
--  Idempotent : rejouable sans dommage, dans n'importe quel ordre.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

DO $reset$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('code_relais', 'attribuer_relais', 'valider_code',
                         'declarer_rupture', 'annuler_relais', 'expirer_relais',
                         'mon_relais', 'relais_du_comptoir')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;

-- ════════════════════════════════════════════════════════════════════════════
--  1. LA TABLE
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.relais (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rayon_id      UUID NOT NULL REFERENCES public.rayons(id)   ON DELETE CASCADE,
  demande_id    UUID          REFERENCES public.demandes(id) ON DELETE SET NULL,
  appel_id      UUID          REFERENCES public.appels(id)   ON DELETE SET NULL,

  emetteur_id   UUID NOT NULL REFERENCES public.vendors(id)  ON DELETE CASCADE,
  receveur_id   UUID NOT NULL REFERENCES public.vendors(id)  ON DELETE CASCADE,
  client_id     UUID          REFERENCES auth.users(id)      ON DELETE SET NULL,

  product_id    UUID          REFERENCES public.products(id) ON DELETE SET NULL,
  libelle       TEXT NOT NULL,
  prix_net      INTEGER NOT NULL CHECK (prix_net > 0),
  -- Figés à l'attribution : le barème peut changer, pas le prix promis.
  prix_affiche  INTEGER NOT NULL,
  prix_paye     INTEGER NOT NULL,
  remise        INTEGER NOT NULL,
  bon           INTEGER NOT NULL,
  commission    INTEGER NOT NULL,

  -- 'marche' : le client va à pied. 'livre' : commerçant de services, la
  -- cliente est immobilisée et c'est la boutique qui vend qui livre.
  mode          TEXT NOT NULL DEFAULT 'marche' CHECK (mode IN ('marche', 'livre')),
  distance_m    INTEGER,

  code          TEXT NOT NULL,
  etat          TEXT NOT NULL DEFAULT 'attribue'
                CHECK (etat IN ('attribue','arrive','paye','remis','expire','rupture','annule')),

  -- Rang proposé par l'arbitrage, rang réellement choisi, et le motif de
  -- l'écart. C'est le seul endroit où la collusion entre deux boutiques laisse
  -- une trace : un vendeur dont 80 % des relais partent hors classement est la
  -- signature du renvoi entre amis.
  rang_propose  INTEGER,
  rang_choisi   INTEGER,
  motif_ecart   TEXT,

  order_id      UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  expire_le     TIMESTAMPTZ NOT NULL,
  arrive_le     TIMESTAMPTZ,
  paye_le       TIMESTAMPTZ,
  remis_le      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS relais_code_actif_uq
  ON public.relais (code) WHERE etat IN ('attribue', 'arrive', 'paye');
CREATE INDEX IF NOT EXISTS relais_emetteur_idx ON public.relais (emetteur_id, created_at DESC);
CREATE INDEX IF NOT EXISTS relais_receveur_idx ON public.relais (receveur_id, etat, created_at DESC);
CREATE INDEX IF NOT EXISTS relais_client_idx   ON public.relais (client_id, etat);

-- ════════════════════════════════════════════════════════════════════════════
--  2. LE CODE
--
--  Six caractères sur un alphabet de 30 — ni 0, ni O, ni 1, ni I : il doit se
--  lire à voix haute dans une allée bruyante et se taper sans erreur.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.code_relais()
RETURNS TEXT LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  alpha TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c TEXT; i INTEGER;
BEGIN
  LOOP
    c := '';
    FOR i IN 1..6 LOOP
      c := c || substr(alpha, 1 + floor(random() * length(alpha))::INTEGER, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.relais
       WHERE code = c AND etat IN ('attribue', 'arrive', 'paye'));
  END LOOP;
  RETURN c;
END
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  3. ATTRIBUER — le relais naît ici
--
--  Le client vient d'être identifié. Les prix sont figés maintenant, avec le
--  barème du moment : ce qui a été promis au comptoir ne bouge plus.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.attribuer_relais(
  p_appel_id    UUID,
  p_receveur_id UUID,
  p_client_id   UUID,
  p_prix_net    INTEGER,
  p_product_id  UUID    DEFAULT NULL,
  p_mode        TEXT    DEFAULT 'marche',
  p_rang_choisi INTEGER DEFAULT 1,
  p_motif       TEXT    DEFAULT NULL
)
RETURNS TABLE (relais_id UUID, code TEXT, expire_le TIMESTAMPTZ, prix_paye INTEGER, bon INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pol public.platform_policy;
  v_dem UUID; v_rayon UUID; v_emet UUID; v_lib TEXT;
  v_aff INTEGER; v_paye INTEGER; v_rem INTEGER; v_bon INTEGER; v_com INTEGER;
  v_dist INTEGER; v_code TEXT; v_id UUID; v_exp TIMESTAMPTZ; v_rang INTEGER;
BEGIN
  SELECT d.id, d.rayon_id, d.vendor_id, d.libelle
    INTO v_dem, v_rayon, v_emet, v_lib
    FROM public.appels a JOIN public.demandes d ON d.id = a.demande_id
   WHERE a.id = p_appel_id;
  IF v_dem IS NULL THEN RAISE EXCEPTION 'Appel introuvable'; END IF;
  IF v_emet = p_receveur_id THEN
    RAISE EXCEPTION 'Une boutique ne peut pas se relayer elle-même';
  END IF;

  SELECT * INTO pol FROM public.platform_policy WHERE id;

  v_aff  := ROUND(p_prix_net * (1 + pol.majoration_bps    / 10000.0));
  v_rem  := ROUND(p_prix_net * pol.part_remise_bps        / 10000.0);
  v_bon  := ROUND(p_prix_net * pol.part_bon_bps           / 10000.0);
  v_com  := ROUND(p_prix_net * pol.part_buyticle_bps      / 10000.0);
  v_paye := v_aff - v_rem;

  SELECT public.distance_m(e.pickup_lat, e.pickup_lng, r.pickup_lat, r.pickup_lng)
    INTO v_dist
    FROM public.vendors e, public.vendors r
   WHERE e.id = v_emet AND r.id = p_receveur_id;

  SELECT c.rang INTO v_rang
    FROM public.classer_repondants(p_appel_id) c
   WHERE c.vendor_id = p_receveur_id;

  v_code := public.code_relais();
  v_exp  := NOW() + (pol.bon_validite_heures || ' hours')::INTERVAL;

  INSERT INTO public.relais (
    rayon_id, demande_id, appel_id, emetteur_id, receveur_id, client_id,
    product_id, libelle, prix_net, prix_affiche, prix_paye, remise, bon, commission,
    mode, distance_m, code, etat, rang_propose, rang_choisi, motif_ecart, expire_le)
  VALUES (
    v_rayon, v_dem, p_appel_id, v_emet, p_receveur_id, p_client_id,
    p_product_id, v_lib, p_prix_net, v_aff, v_paye, v_rem, v_bon, v_com,
    p_mode, v_dist, v_code, 'attribue', v_rang, p_rang_choisi, p_motif, v_exp)
  RETURNING id INTO v_id;

  UPDATE public.demandes SET resultat = 'servie' WHERE id = v_dem;

  RETURN QUERY SELECT v_id, v_code, v_exp, v_paye, v_bon;
END
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  4. VALIDER LE CODE AU COMPTOIR
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.valider_code(p_code TEXT, p_vendor_id UUID)
RETURNS TABLE (relais_id UUID, libelle TEXT, prix_paye INTEGER, prix_affiche INTEGER,
               remise INTEGER, client_id UUID, deja_arrive BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.relais;
BEGIN
  SELECT * INTO r FROM public.relais
   WHERE upper(code) = upper(trim(p_code)) AND etat IN ('attribue', 'arrive');
  IF r.id IS NULL THEN RAISE EXCEPTION 'Code inconnu ou déjà utilisé'; END IF;
  -- Le bon ne vaut que chez la boutique désignée : c'est ce que le rabatteur
  -- ne peut pas honorer.
  IF r.receveur_id <> p_vendor_id THEN
    RAISE EXCEPTION 'Ce bon n''est pas pour cette boutique';
  END IF;
  IF r.etat = 'attribue' AND NOW() > r.expire_le THEN
    UPDATE public.relais SET etat = 'expire' WHERE id = r.id;
    RAISE EXCEPTION 'Ce bon a expiré';
  END IF;

  IF r.etat = 'attribue' THEN
    UPDATE public.relais SET etat = 'arrive', arrive_le = NOW() WHERE id = r.id;
  END IF;

  RETURN QUERY SELECT r.id, r.libelle, r.prix_paye, r.prix_affiche, r.remise,
                      r.client_id, (r.etat = 'arrive');
END
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  5. LES SORTIES QUI NE SONT PAS UNE VENTE
-- ════════════════════════════════════════════════════════════════════════════

-- Elle avait confirmé, elle n'a plus. Le client est re-relayé depuis où il se
-- trouve — jamais renvoyé chez lui — et la boutique prend −5 au score.
CREATE OR REPLACE FUNCTION public.declarer_rupture(p_relais_id UUID, p_vendor_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_appel UUID;
BEGIN
  UPDATE public.relais SET etat = 'rupture'
   WHERE id = p_relais_id AND receveur_id = p_vendor_id AND etat IN ('attribue','arrive')
  RETURNING appel_id INTO v_appel;
  IF NOT FOUND THEN RAISE EXCEPTION 'Relais introuvable ou déjà clos'; END IF;
  -- L'appel reste exploitable : les autres répondants sont toujours là.
  RETURN v_appel;
END
$$;

-- Il est venu, il n'a pas acheté. Aucune faute, aucune pénalité, mais ça compte.
CREATE OR REPLACE FUNCTION public.annuler_relais(p_relais_id UUID, p_par TEXT DEFAULT 'client')
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.relais SET etat = 'annule'
   WHERE id = p_relais_id AND etat IN ('attribue', 'arrive');
END
$$;

-- Passé 48 h sans arrivée. À appeler par une tâche planifiée.
CREATE OR REPLACE FUNCTION public.expirer_relais()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER;
BEGIN
  UPDATE public.relais SET etat = 'expire'
   WHERE etat = 'attribue' AND NOW() > expire_le;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  6. CE QUE CHACUN VOIT
-- ════════════════════════════════════════════════════════════════════════════

-- Le client, sur son téléphone : un seul relais en cours, plein écran.
CREATE OR REPLACE FUNCTION public.mon_relais()
RETURNS TABLE (
  id UUID, libelle TEXT, code TEXT, etat TEXT, mode TEXT,
  prix_affiche INTEGER, prix_paye INTEGER, remise INTEGER,
  distance_m INTEGER, expire_le TIMESTAMPTZ,
  boutique TEXT, boutique_id UUID, lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  repere TEXT, envoye_par TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.libelle, r.code, r.etat, r.mode,
         r.prix_affiche, r.prix_paye, r.remise, r.distance_m, r.expire_le,
         v.shop_name, v.id, v.pickup_lat, v.pickup_lng, v.pickup_label, e.shop_name
    FROM public.relais r
    JOIN public.vendors v ON v.id = r.receveur_id
    JOIN public.vendors e ON e.id = r.emetteur_id
   WHERE r.client_id = auth.uid()
     AND r.etat IN ('attribue', 'arrive', 'paye')
   ORDER BY r.created_at DESC
   LIMIT 1;
$$;

-- La boutique, au comptoir : ce qu'on lui envoie, et ce qu'elle a envoyé.
CREATE OR REPLACE FUNCTION public.relais_du_comptoir(p_vendor_id UUID)
RETURNS TABLE (
  id UUID, sens TEXT, libelle TEXT, code TEXT, etat TEXT,
  prix_net INTEGER, prix_paye INTEGER, bon INTEGER,
  autre_boutique TEXT, created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id,
         CASE WHEN r.emetteur_id = p_vendor_id THEN 'envoye' ELSE 'recu' END,
         r.libelle, CASE WHEN r.receveur_id = p_vendor_id THEN r.code ELSE NULL END,
         r.etat, r.prix_net, r.prix_paye, r.bon,
         CASE WHEN r.emetteur_id = p_vendor_id
              THEN (SELECT shop_name FROM public.vendors WHERE id = r.receveur_id)
              ELSE (SELECT shop_name FROM public.vendors WHERE id = r.emetteur_id) END,
         r.created_at
    FROM public.relais r
   WHERE r.emetteur_id = p_vendor_id OR r.receveur_id = p_vendor_id
   ORDER BY r.created_at DESC
   LIMIT 50;
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  7. QUI VOIT QUOI
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.relais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS relais_parties ON public.relais;
CREATE POLICY relais_parties ON public.relais FOR SELECT
  USING (
    client_id = auth.uid()
    OR emetteur_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
    OR receveur_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
  );

GRANT EXECUTE ON FUNCTION public.attribuer_relais(UUID, UUID, UUID, INTEGER, UUID, TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.valider_code(TEXT, UUID)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.declarer_rupture(UUID, UUID)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.annuler_relais(UUID, TEXT)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.mon_relais()                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.relais_du_comptoir(UUID)         TO authenticated;
