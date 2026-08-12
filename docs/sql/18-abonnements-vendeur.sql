-- ════════════════════════════════════════════════════════════════════════════
--  ABONNEMENTS VENDEUR
--
--  Le plan choisi à l'inscription restait dans le dossier de candidature : la
--  boutique n'avait aucun moyen de savoir où elle en était, ni de changer.
--
--  Deux façons de payer, parce que toutes les boutiques n'ont pas de mobile
--  money approvisionné :
--    · MOBILE MONEY — Monetbil, comme pour les commandes. Le webhook marque
--      la demande payée et le plan s'applique tout seul.
--    · EN AGENCE    — la boutique passe déposer l'argent. La demande reste en
--      attente jusqu'à ce qu'un admin la valide dans son tableau de bord.
--
--  Dans les deux cas le reçu est le même : une facture d'abonnement émise par
--  le service de facturation, téléchargeable en PDF par la boutique.
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
       AND p.proname IN ('request_subscription', 'my_subscription', 'admin_subscriptions',
                         'validate_subscription', 'reject_subscription',
                         'settle_subscription_by_ref', 'attach_subscription_invoice')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;

-- ════════════════════════════════════════════════════════════════════════════
--  1. LES FORFAITS — en table, pour que les prix se changent sans déploiement
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  price_xaf   INTEGER NOT NULL DEFAULT 0,
  period      TEXT NOT NULL DEFAULT 'mois',
  tagline     TEXT,
  features    JSONB NOT NULL DEFAULT '[]'::JSONB,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO public.subscription_plans (code, name, price_xaf, tagline, features, sort_order) VALUES
  ('starter', 'Gratuit', 0,
   'Pour ouvrir sa boutique et vendre ses premiers articles',
   '["Boutique en ligne","Jusqu''à 20 produits","Paiement mobile money","Commandes illimitées"]'::JSONB, 1),
  ('pro', 'Pro', 15000,
   'Pour une boutique qui tourne tous les jours',
   '["Produits illimités","Statistiques détaillées","Buyticle Delivery","Remise membre personnalisée","Lives de vente","Support prioritaire"]'::JSONB, 2),
  ('elite', 'Elite', 50000,
   'Pour les boutiques qui pèsent',
   '["Tout le Pro","Mise en avant sur l''accueil","Bannières sponsorisées","Livreurs dédiés","Gestionnaire de compte","Rapports mensuels"]'::JSONB, 3)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plans_read  ON public.subscription_plans;
DROP POLICY IF EXISTS plans_write ON public.subscription_plans;
CREATE POLICY plans_read  ON public.subscription_plans FOR SELECT USING (TRUE);
CREATE POLICY plans_write ON public.subscription_plans FOR ALL
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════════
--  2. LE PLAN DE LA BOUTIQUE
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS plan            TEXT NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS plan_since      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;

-- ════════════════════════════════════════════════════════════════════════════
--  3. LES DEMANDES
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.subscription_orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id      UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  from_plan      TEXT,
  to_plan        TEXT NOT NULL REFERENCES public.subscription_plans(code),
  amount         INTEGER NOT NULL,
  months         INTEGER NOT NULL DEFAULT 1,
  method         TEXT NOT NULL,          -- monetbil | agency
  status         TEXT NOT NULL DEFAULT 'pending',
  payment_ref    TEXT,                   -- référence Monetbil, ou reçu d'agence
  admin_note     TEXT,
  -- Le reçu, émis par le service de facturation.
  invoice_id     TEXT,
  invoice_number TEXT,
  invoice_url    TEXT,
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at     TIMESTAMPTZ,
  settled_by     UUID REFERENCES auth.users(id)
);

ALTER TABLE public.subscription_orders DROP CONSTRAINT IF EXISTS sub_orders_method_valid;
ALTER TABLE public.subscription_orders
  ADD CONSTRAINT sub_orders_method_valid CHECK (method IN ('monetbil', 'agency'));

ALTER TABLE public.subscription_orders DROP CONSTRAINT IF EXISTS sub_orders_status_valid;
ALTER TABLE public.subscription_orders
  ADD CONSTRAINT sub_orders_status_valid
  CHECK (status IN ('pending', 'paid', 'rejected', 'cancelled'));

CREATE INDEX IF NOT EXISTS sub_orders_vendor_idx ON public.subscription_orders(vendor_id);
CREATE INDEX IF NOT EXISTS sub_orders_pending_idx ON public.subscription_orders(status)
  WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS sub_orders_ref_idx ON public.subscription_orders(payment_ref)
  WHERE payment_ref IS NOT NULL;

ALTER TABLE public.subscription_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sub_orders_read  ON public.subscription_orders;
DROP POLICY IF EXISTS sub_orders_admin ON public.subscription_orders;

-- La boutique voit les siennes ; l'admin voit tout. L'écriture passe par les
-- fonctions : personne ne s'accorde un plan en écrivant dans la table.
CREATE POLICY sub_orders_read ON public.subscription_orders
  FOR SELECT USING (public.owns_vendor(vendor_id) OR public.is_super_admin());
CREATE POLICY sub_orders_admin ON public.subscription_orders
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════════
--  4. DEMANDER UN CHANGEMENT DE FORFAIT
--
--  Redescendre vers le gratuit est immédiat : on ne fait pas payer pour
--  arrêter de payer. Monter demande un règlement.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.request_subscription(
  p_vendor_id UUID,
  p_plan      TEXT,
  p_method    TEXT DEFAULT 'monetbil',
  p_months    INTEGER DEFAULT 1
)
RETURNS public.subscription_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cur TEXT; v_price INTEGER; v_row public.subscription_orders; v_months INTEGER;
BEGIN
  IF NOT (public.owns_vendor(p_vendor_id) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Cette boutique n''est pas la vôtre';
  END IF;
  IF p_method NOT IN ('monetbil', 'agency') THEN
    RAISE EXCEPTION 'Moyen de paiement inconnu';
  END IF;

  v_months := GREATEST(COALESCE(p_months, 1), 1);

  SELECT sp.price_xaf INTO v_price
  FROM public.subscription_plans sp WHERE sp.code = p_plan AND sp.is_active;
  IF v_price IS NULL THEN RAISE EXCEPTION 'Forfait inconnu'; END IF;

  SELECT v.plan INTO v_cur FROM public.vendors v WHERE v.id = p_vendor_id;
  IF v_cur = p_plan AND v_price > 0 THEN
    RAISE EXCEPTION 'Tu es déjà sur ce forfait';
  END IF;

  -- Le gratuit s'applique sans passer par la caisse.
  IF v_price = 0 THEN
    UPDATE public.vendors v
       SET plan = p_plan, plan_since = NOW(), plan_expires_at = NULL
     WHERE v.id = p_vendor_id;

    INSERT INTO public.subscription_orders
      (vendor_id, from_plan, to_plan, amount, months, method, status, settled_at)
    VALUES (p_vendor_id, v_cur, p_plan, 0, v_months, p_method, 'paid', NOW())
    RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  -- Une demande en attente à la fois : sinon la boutique en empile trois et
  -- personne ne sait laquelle correspond au versement reçu.
  UPDATE public.subscription_orders so
     SET status = 'cancelled'
   WHERE so.vendor_id = p_vendor_id AND so.status = 'pending';

  INSERT INTO public.subscription_orders
    (vendor_id, from_plan, to_plan, amount, months, method, status)
  VALUES (p_vendor_id, v_cur, p_plan, v_price * v_months, v_months, p_method, 'pending')
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.request_subscription(UUID, TEXT, TEXT, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_subscription(UUID, TEXT, TEXT, INTEGER) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  5. CE QUE VOIT LA BOUTIQUE
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.my_subscription(p_vendor_id UUID)
RETURNS TABLE (
  plan            TEXT,
  plan_name       TEXT,
  plan_price      INTEGER,
  plan_since      TIMESTAMPTZ,
  plan_expires_at TIMESTAMPTZ,
  pending         JSONB,
  history         JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.owns_vendor(p_vendor_id) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Cette boutique n''est pas la vôtre';
  END IF;

  RETURN QUERY
  SELECT v.plan::TEXT, sp.name::TEXT, sp.price_xaf, v.plan_since, v.plan_expires_at,
         (SELECT to_jsonb(so) FROM public.subscription_orders so
           WHERE so.vendor_id = p_vendor_id AND so.status = 'pending'
           ORDER BY so.requested_at DESC LIMIT 1),
         COALESCE((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.requested_at DESC)
                     FROM (SELECT * FROM public.subscription_orders so2
                            WHERE so2.vendor_id = p_vendor_id
                              AND so2.status <> 'cancelled'
                            ORDER BY so2.requested_at DESC LIMIT 24) h), '[]'::JSONB)
  FROM public.vendors v
  LEFT JOIN public.subscription_plans sp ON sp.code = v.plan
  WHERE v.id = p_vendor_id;
END;
$$;

REVOKE ALL ON FUNCTION public.my_subscription(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.my_subscription(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  6. VALIDER — l'admin encaisse en agence, ou le webhook confirme
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.validate_subscription(
  p_id        UUID,
  p_reference TEXT DEFAULT NULL,
  p_note      TEXT DEFAULT NULL
)
RETURNS public.subscription_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.subscription_orders;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;

  SELECT * INTO v_row FROM public.subscription_orders WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Cette demande est déjà clôturée (%)', v_row.status;
  END IF;

  UPDATE public.subscription_orders so
     SET status      = 'paid',
         payment_ref = COALESCE(NULLIF(BTRIM(p_reference), ''), so.payment_ref),
         admin_note  = COALESCE(NULLIF(BTRIM(p_note), ''), so.admin_note),
         settled_at  = NOW(),
         settled_by  = auth.uid()
   WHERE so.id = p_id
  RETURNING * INTO v_row;

  -- Le forfait prend effet ici, et nulle part ailleurs.
  UPDATE public.vendors v
     SET plan            = v_row.to_plan,
         plan_since      = NOW(),
         plan_expires_at = NOW() + (v_row.months || ' months')::INTERVAL
   WHERE v.id = v_row.vendor_id;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_subscription(p_id UUID, p_note TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  IF COALESCE(BTRIM(p_note), '') = '' THEN
    RAISE EXCEPTION 'Explique le motif : la boutique le lira';
  END IF;

  UPDATE public.subscription_orders so
     SET status = 'rejected', admin_note = BTRIM(p_note),
         settled_at = NOW(), settled_by = auth.uid()
   WHERE so.id = p_id AND so.status = 'pending';

  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable ou déjà clôturée'; END IF;
END;
$$;

-- Appelée par le webhook Monetbil, avec la clé de service.
CREATE OR REPLACE FUNCTION public.settle_subscription_by_ref(p_reference TEXT)
RETURNS public.subscription_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.subscription_orders;
BEGIN
  UPDATE public.subscription_orders so
     SET status = 'paid', settled_at = NOW()
   WHERE so.payment_ref = p_reference AND so.status = 'pending'
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN RETURN NULL; END IF;

  UPDATE public.vendors v
     SET plan            = v_row.to_plan,
         plan_since      = NOW(),
         plan_expires_at = NOW() + (v_row.months || ' months')::INTERVAL
   WHERE v.id = v_row.vendor_id;

  RETURN v_row;
END;
$$;

-- La référence Monetbil est posée par la fonction edge avant redirection.
CREATE OR REPLACE FUNCTION public.attach_subscription_invoice(
  p_id      UUID,
  p_ref     TEXT DEFAULT NULL,
  p_inv_id  TEXT DEFAULT NULL,
  p_inv_num TEXT DEFAULT NULL,
  p_inv_url TEXT DEFAULT NULL
)
RETURNS public.subscription_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.subscription_orders;
BEGIN
  SELECT * INTO v_row FROM public.subscription_orders WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF NOT (public.is_super_admin() OR public.owns_vendor(v_row.vendor_id)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  UPDATE public.subscription_orders so
     SET payment_ref    = COALESCE(NULLIF(BTRIM(p_ref), ''), so.payment_ref),
         invoice_id     = COALESCE(NULLIF(BTRIM(p_inv_id), ''), so.invoice_id),
         invoice_number = COALESCE(NULLIF(BTRIM(p_inv_num), ''), so.invoice_number),
         invoice_url    = COALESCE(NULLIF(BTRIM(p_inv_url), ''), so.invoice_url)
   WHERE so.id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_subscription(UUID, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.reject_subscription(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.attach_subscription_invoice(UUID, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.validate_subscription(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_subscription(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attach_subscription_invoice(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  7. CE QUE VOIT L'ADMIN
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_subscriptions(p_status TEXT DEFAULT 'pending')
RETURNS TABLE (
  id             UUID,
  vendor_id      UUID,
  shop_name      TEXT,
  vendor_email   TEXT,
  vendor_phone   TEXT,
  from_plan      TEXT,
  to_plan        TEXT,
  plan_name      TEXT,
  amount         INTEGER,
  months         INTEGER,
  method         TEXT,
  status         TEXT,
  payment_ref    TEXT,
  admin_note     TEXT,
  invoice_number TEXT,
  invoice_url    TEXT,
  requested_at   TIMESTAMPTZ,
  settled_at     TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;

  RETURN QUERY
  SELECT so.id, so.vendor_id, v.shop_name::TEXT, v.email::TEXT, v.phone::TEXT,
         so.from_plan::TEXT, so.to_plan::TEXT, sp.name::TEXT,
         so.amount, so.months, so.method::TEXT, so.status::TEXT,
         so.payment_ref::TEXT, so.admin_note::TEXT,
         so.invoice_number::TEXT, so.invoice_url::TEXT,
         so.requested_at, so.settled_at
  FROM public.subscription_orders so
  JOIN public.vendors v ON v.id = so.vendor_id
  LEFT JOIN public.subscription_plans sp ON sp.code = so.to_plan
  WHERE so.status <> 'cancelled'
    AND (p_status IS NULL OR so.status = p_status)
  ORDER BY so.requested_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_subscriptions(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_subscriptions(TEXT) TO authenticated;
