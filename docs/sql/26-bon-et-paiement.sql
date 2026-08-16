-- ════════════════════════════════════════════════════════════════════════════
--  LE BON, LE PAIEMENT, ET LE MOMENT OÙ L'ARGENT BOUGE
--
--  Une seule règle commande tout ce fichier :
--
--      UN BON RÉSERVÉ N'EST PAS UN REVENU.
--      Rien n'est crédité avant que le client ait son article en main.
--
--  LE BON est le troisième portefeuille de la plateforme, à côté des points de
--  fidélité et des commissions d'affiliation. Il a ses propres règles, et une
--  échelle plutôt qu'une serrure :
--
--    1. remises à ses propres clients — immédiat, sans plafond. C'est l'usage
--       le plus rentable : il fidélise avec de l'argent gagné sur des gens
--       qu'il ne pouvait pas servir.
--    2. paiement de son abonnement — s'il le décide, jamais automatique.
--    3. retrait Mobile Money — au-delà d'un seuil, après 30 jours.
--
--  La troisième marche compte même si presque personne ne s'en sert : une
--  sortie qu'on peut emprunter n'est pas vécue comme un enfermement.
--
--  LE PAIEMENT. La commande ne naît qu'au paiement, au comptoir. Avant, il
--  n'existe qu'un relais. Aucune commande fantôme pour les clients qui ne
--  viennent jamais — et il y en a un sur dix. La marche appartient au relais,
--  pas à un transit de livraison : le mode d'exécution est « comptoir » et il
--  n'a que deux statuts, payée puis remise.
--
--  LES ESPÈCES restent possibles, mais alors aucun des trois avantages
--  n'existe : pas de remise, pas de bon, pas d'avis vérifié. Et le prix payé
--  en espèces est le PRIX NET, jamais le prix affiché — sinon le commerçant
--  encaisse les 13 % de majoration et l'engagement de prix ferme est mort dès
--  la première semaine.
--
--  L'AFFILIATION ne s'applique jamais sur un relais, et les points ne se
--  dépensent pas sur une commande relayée : le client y a déjà ses 5 %, et une
--  remise en points par-dessus sortirait de notre commission.
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
       AND p.proname IN ('payer_relais', 'confirmer_remise', 'solde_bon',
                         'depenser_bon', 'relais_a_confirmer', 'releve_boutique')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;

-- ════════════════════════════════════════════════════════════════════════════
--  1. LE TROISIÈME PORTEFEUILLE
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.bon_mouvements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  montant     INTEGER NOT NULL,                -- positif : crédit · négatif : dépense
  motif       TEXT NOT NULL CHECK (motif IN ('relais', 'remise_client', 'abonnement', 'retrait', 'correction')),
  relais_id   UUID REFERENCES public.relais(id) ON DELETE SET NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un relais ne crédite qu'une fois, quoi qu'il arrive.
CREATE UNIQUE INDEX IF NOT EXISTS bon_mouvements_relais_uq
  ON public.bon_mouvements (relais_id) WHERE motif = 'relais';
CREATE INDEX IF NOT EXISTS bon_mouvements_vendor_idx
  ON public.bon_mouvements (vendor_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.solde_bon(p_vendor_id UUID)
RETURNS TABLE (solde INTEGER, gagne_30j INTEGER, retirable INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE(SUM(montant), 0)::INTEGER,
    COALESCE(SUM(montant) FILTER (WHERE montant > 0 AND created_at > NOW() - INTERVAL '30 days'), 0)::INTEGER,
    -- Retirable : ce qui est acquis depuis plus de trente jours. Le délai fait
    -- que l'essentiel continue de circuler à l'intérieur du réseau.
    GREATEST(0, COALESCE(SUM(montant) FILTER (WHERE created_at <= NOW() - INTERVAL '30 days'), 0))::INTEGER
    FROM public.bon_mouvements
   WHERE vendor_id = p_vendor_id;
$$;

CREATE OR REPLACE FUNCTION public.depenser_bon(
  p_vendor_id UUID, p_montant INTEGER, p_motif TEXT, p_note TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_solde INTEGER; v_retirable INTEGER;
BEGIN
  IF p_montant <= 0 THEN RAISE EXCEPTION 'Montant invalide'; END IF;
  IF p_motif NOT IN ('remise_client', 'abonnement', 'retrait') THEN
    RAISE EXCEPTION 'Motif de dépense invalide';
  END IF;

  SELECT s.solde, s.retirable INTO v_solde, v_retirable
    FROM public.solde_bon(p_vendor_id) s;

  IF p_montant > v_solde THEN RAISE EXCEPTION 'Solde insuffisant'; END IF;
  -- Les deux premières marches sont libres. La troisième attend trente jours.
  IF p_motif = 'retrait' AND p_montant > v_retirable THEN
    RAISE EXCEPTION 'Retirable seulement après 30 jours';
  END IF;

  INSERT INTO public.bon_mouvements (vendor_id, montant, motif, note)
  VALUES (p_vendor_id, -p_montant, p_motif, p_note);

  RETURN v_solde - p_montant;
END
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  2. LA COMMANDE NAÎT AU PAIEMENT
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfilment TEXT NOT NULL DEFAULT 'livraison'
    CHECK (fulfilment IN ('livraison', 'comptoir')),
  ADD COLUMN IF NOT EXISTS relais_id UUID REFERENCES public.relais(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_relais_uq
  ON public.orders (relais_id) WHERE relais_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.payer_relais(
  p_relais_id UUID, p_reference TEXT DEFAULT NULL
)
RETURNS TABLE (order_id UUID, montant INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.relais; v_order UUID;
BEGIN
  SELECT * INTO r FROM public.relais WHERE id = p_relais_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Relais introuvable'; END IF;
  IF r.client_id <> auth.uid() THEN RAISE EXCEPTION 'Ce relais n''est pas le vôtre'; END IF;
  IF r.etat <> 'arrive' THEN
    RAISE EXCEPTION 'Le code doit d''abord être validé au comptoir';
  END IF;

  INSERT INTO public.orders (user_id, vendor_id, total, status, fulfilment, relais_id)
  VALUES (r.client_id, r.receveur_id, r.prix_paye, 'paid', 'comptoir', r.id)
  ON CONFLICT (relais_id) WHERE relais_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_order;

  IF v_order IS NULL THEN
    SELECT id INTO v_order FROM public.orders WHERE relais_id = r.id;
  END IF;

  UPDATE public.relais
     SET etat = 'paye', paye_le = NOW(), order_id = v_order
   WHERE id = r.id AND etat = 'arrive';

  RETURN QUERY SELECT v_order, r.prix_paye;
END
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  3. LA REMISE — c'est ici, et seulement ici, que l'argent bouge
--
--  Le client a son article en main. Trois écritures d'un coup : le prix net au
--  commerçant qui vend, le bon à celui qui a envoyé, la commission à Buyticle.
--  Celle qui reçoit ne paie rien : elle encaisse son prix net en entier.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.confirmer_remise(p_relais_id UUID)
RETURNS TABLE (net_vendeur INTEGER, bon_emetteur INTEGER, commission INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.relais;
BEGIN
  SELECT * INTO r FROM public.relais WHERE id = p_relais_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Relais introuvable'; END IF;
  IF r.etat = 'remis' THEN
    -- Déjà confirmé : on ne crédite pas deux fois, et ce n'est pas une erreur.
    RETURN QUERY SELECT r.prix_net, r.bon, r.commission;
    RETURN;
  END IF;
  IF r.etat <> 'paye' THEN RAISE EXCEPTION 'Le relais n''est pas payé'; END IF;

  UPDATE public.relais SET etat = 'remis', remis_le = NOW() WHERE id = r.id;
  UPDATE public.orders  SET status = 'delivered' WHERE id = r.order_id;

  -- Le bon de celui qui a envoyé. Il n'existe pas avant cette ligne.
  INSERT INTO public.bon_mouvements (vendor_id, montant, motif, relais_id, note)
  VALUES (r.emetteur_id, r.bon, 'relais', r.id, r.libelle)
  ON CONFLICT (relais_id) WHERE motif = 'relais' DO NOTHING;

  RETURN QUERY SELECT r.prix_net, r.bon, r.commission;
END
$$;

-- Le client a payé et n'a pas confirmé. Il est debout dans la boutique : deux
-- heures suffisent largement, et ça débloque le commerçant.
CREATE OR REPLACE FUNCTION public.relais_a_confirmer()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER := 0; r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.relais
            WHERE etat = 'paye' AND paye_le < NOW() - INTERVAL '2 hours'
  LOOP
    PERFORM public.confirmer_remise(r.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  4. LE RELEVÉ — la feuille qu'on pose sur le comptoir
--
--  Elle ne contient que ses chiffres à lui. C'est l'outil de vente de
--  l'abonnement, et il n'y a rien à plaider dessus : il sait faire une division.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.releve_boutique(p_vendor_id UUID, p_jours INTEGER DEFAULT 30)
RETURNS TABLE (
  envoyes            INTEGER,
  envoyes_aboutis    INTEGER,
  recus              INTEGER,
  marchandise_vendue BIGINT,
  bon_gagne          INTEGER,
  bon_solde          INTEGER,
  ruptures           INTEGER,
  taux_reponse       NUMERIC,
  preuve_atteinte    BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_seuil INTEGER;
BEGIN
  SELECT br.preuve_seuil INTO v_seuil
    FROM public.boutique_rayon br WHERE br.vendor_id = p_vendor_id AND br.actif LIMIT 1;

  RETURN QUERY
  WITH r AS (
    SELECT
      COUNT(*) FILTER (WHERE emetteur_id = p_vendor_id)::INTEGER AS env,
      COUNT(*) FILTER (WHERE emetteur_id = p_vendor_id AND etat = 'remis')::INTEGER AS env_ok,
      COUNT(*) FILTER (WHERE receveur_id = p_vendor_id AND etat = 'remis')::INTEGER AS rec,
      COALESCE(SUM(prix_net) FILTER (WHERE receveur_id = p_vendor_id AND etat = 'remis'), 0)::BIGINT AS ca,
      COALESCE(SUM(bon)      FILTER (WHERE emetteur_id = p_vendor_id AND etat = 'remis'), 0)::INTEGER AS bg,
      COUNT(*) FILTER (WHERE receveur_id = p_vendor_id AND etat = 'rupture')::INTEGER AS rup
      FROM public.relais
     WHERE created_at > NOW() - (p_jours || ' days')::INTERVAL
  ),
  rep AS (
    SELECT COUNT(*)::NUMERIC AS n,
           COUNT(*) FILTER (WHERE delai_ms <= 30000)::NUMERIC AS a_temps
      FROM public.reponses
     WHERE vendor_id = p_vendor_id AND created_at > NOW() - (p_jours || ' days')::INTERVAL
  )
  SELECT r.env, r.env_ok, r.rec, r.ca, r.bg,
         (SELECT s.solde FROM public.solde_bon(p_vendor_id) s),
         r.rup,
         CASE WHEN rep.n = 0 THEN NULL ELSE ROUND(rep.a_temps / rep.n, 2) END,
         r.rec >= COALESCE(v_seuil, 20)
    FROM r, rep;
END
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  5. QUI VOIT QUOI
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.bon_mouvements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bon_mine ON public.bon_mouvements;
CREATE POLICY bon_mine ON public.bon_mouvements FOR SELECT
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));

GRANT EXECUTE ON FUNCTION public.solde_bon(UUID)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.depenser_bon(UUID, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.payer_relais(UUID, TEXT)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirmer_remise(UUID)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.releve_boutique(UUID, INTEGER)         TO authenticated;
