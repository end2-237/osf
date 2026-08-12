-- ════════════════════════════════════════════════════════════════════════════
--  MISE EN CONDITION D'EXPLOITATION
--
--  1. Isolation des données de reversement hors de la table publique
--  2. Frais de livraison par boutique
--  3. Retraits vendeur (demande + solde)
--  4. Décrément automatique du stock
--  5. RLS sur vendors / products / orders / order_items + fonctions d'accès
--
--  Idempotent : rejouable sans dommage.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

-- ════════════════════════════════════════════════════════════════════════════
--  REJOUABLE DANS N'IMPORTE QUEL ORDRE
--
--  PostgreSQL refuse un CREATE OR REPLACE qui change la forme du retour, et
--  deux signatures d'une même fonction rendraient chaque appel ambigu. On
--  efface donc d'abord toutes les signatures des fonctions que ce fichier
--  redéfinit — quel que soit l'état de la base, et quel que soit l'ordre dans
--  lequel les fichiers ont été appliqués.
-- ════════════════════════════════════════════════════════════════════════════
DO $reset$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('decrement_stock_on_order_item', 'orders_status', 'request_payout', 'restock_on_order_cancel', 'track_order', 'vendor_balance', 'vendor_sales_counts')
  LOOP
    -- CASCADE : ces fonctions portent des triggers, que le fichier recrée plus bas.
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END
$reset$;


-- ════════════════════════════════════════════════════════════════════════════
--  1. RÉGLAGES DE REVERSEMENT — table séparée, lisible par le seul vendeur
--     `vendors` doit rester lisible publiquement (pages boutique) : les
--     numéros mobile money n'ont donc rien à y faire.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.vendor_payout_settings (
  vendor_id          UUID PRIMARY KEY REFERENCES public.vendors(id) ON DELETE CASCADE,
  momo_orange_number TEXT,
  momo_mtn_number    TEXT,
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Reprise des valeurs déjà saisies avant de retirer les colonnes publiques.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'vendors'
               AND column_name = 'momo_orange_number') THEN
    INSERT INTO public.vendor_payout_settings (vendor_id, momo_orange_number, momo_mtn_number)
    SELECT id, momo_orange_number, momo_mtn_number
    FROM public.vendors
    WHERE momo_orange_number IS NOT NULL OR momo_mtn_number IS NOT NULL
    ON CONFLICT (vendor_id) DO NOTHING;
  END IF;
END $$;

ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_momo_orange_format;
ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_momo_mtn_format;
ALTER TABLE public.vendors DROP COLUMN IF EXISTS momo_orange_number;
ALTER TABLE public.vendors DROP COLUMN IF EXISTS momo_mtn_number;

ALTER TABLE public.vendor_payout_settings DROP CONSTRAINT IF EXISTS vps_orange_format;
ALTER TABLE public.vendor_payout_settings
  ADD CONSTRAINT vps_orange_format
  CHECK (momo_orange_number IS NULL OR momo_orange_number ~ '^[0-9]{8,15}$');

ALTER TABLE public.vendor_payout_settings DROP CONSTRAINT IF EXISTS vps_mtn_format;
ALTER TABLE public.vendor_payout_settings
  ADD CONSTRAINT vps_mtn_format
  CHECK (momo_mtn_number IS NULL OR momo_mtn_number ~ '^[0-9]{8,15}$');

-- ════════════════════════════════════════════════════════════════════════════
--  2. FRAIS DE LIVRAISON PAR BOUTIQUE
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS delivery_fee             INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_delivery_threshold  INTEGER,
  ADD COLUMN IF NOT EXISTS delivery_zones           TEXT,
  ADD COLUMN IF NOT EXISTS delivery_delay           TEXT;

ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_delivery_fee_positive;
ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_delivery_fee_positive
  CHECK (delivery_fee IS NULL OR delivery_fee >= 0);

-- Montant de livraison réellement facturé, conservé sur la commande.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_fee INTEGER DEFAULT 0;

-- ════════════════════════════════════════════════════════════════════════════
--  3. RETRAITS VENDEUR
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.vendor_payouts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id    UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL CHECK (amount > 0),
  method       TEXT NOT NULL CHECK (method IN ('orange_money', 'mtn_momo')),
  phone        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'processing', 'paid', 'rejected')),
  note         TEXT,
  reference    TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vendor_payouts_vendor ON public.vendor_payouts(vendor_id, requested_at DESC);

-- ─── Solde d'un vendeur ───
-- Seules les commandes encaissées EN LIGNE alimentent le solde : le paiement
-- à la livraison est collecté directement par le vendeur, la plateforme ne
-- lui doit rien dessus.
CREATE OR REPLACE FUNCTION public.vendor_balance(p_vendor_id UUID)
RETURNS TABLE (collected BIGINT, withdrawn BIGINT, pending BIGINT, available BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_collected BIGINT; v_withdrawn BIGINT; v_pending BIGINT;
BEGIN
  -- Le vendeur ne consulte que son propre solde ; le super-admin voit tout.
  IF NOT EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = p_vendor_id AND v.user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT COALESCE(SUM(o.total_amount), 0) INTO v_collected
  FROM public.orders o
  WHERE o.vendor_id = p_vendor_id
    AND o.payment_method IN ('orange_money', 'mtn_momo')
    AND o.status IN ('paid', 'shipped', 'in_transit', 'delivered');

  SELECT COALESCE(SUM(amount), 0) INTO v_withdrawn
  FROM public.vendor_payouts
  WHERE vendor_id = p_vendor_id AND status = 'paid';

  SELECT COALESCE(SUM(amount), 0) INTO v_pending
  FROM public.vendor_payouts
  WHERE vendor_id = p_vendor_id AND status IN ('pending', 'processing');

  RETURN QUERY SELECT v_collected, v_withdrawn, v_pending,
                      GREATEST(v_collected - v_withdrawn - v_pending, 0);
END;
$$;

-- ─── Demande de retrait ───
-- Le montant est revalidé côté base : un client modifié ne peut pas demander
-- plus que le solde disponible.
CREATE OR REPLACE FUNCTION public.request_payout(p_vendor_id UUID, p_amount INTEGER, p_method TEXT)
RETURNS public.vendor_payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_available BIGINT; v_phone TEXT; v_row public.vendor_payouts;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vendors v WHERE v.id = p_vendor_id AND v.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF p_method NOT IN ('orange_money', 'mtn_momo') THEN
    RAISE EXCEPTION 'Moyen de retrait invalide';
  END IF;

  SELECT CASE WHEN p_method = 'orange_money' THEN momo_orange_number ELSE momo_mtn_number END
  INTO v_phone
  FROM public.vendor_payout_settings WHERE vendor_id = p_vendor_id;

  IF v_phone IS NULL OR v_phone = '' THEN
    RAISE EXCEPTION 'Renseigne d''abord ton numéro pour ce moyen de paiement';
  END IF;

  SELECT available INTO v_available FROM public.vendor_balance(p_vendor_id);

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Montant invalide';
  END IF;
  IF p_amount > v_available THEN
    RAISE EXCEPTION 'Montant supérieur au solde disponible (% F)', v_available;
  END IF;

  INSERT INTO public.vendor_payouts (vendor_id, amount, method, phone)
  VALUES (p_vendor_id, p_amount, p_method, v_phone)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  4. STOCK — décrément à la commande, restitution à l'annulation
--     stock_qty NULL ou négatif = stock non suivi (produits importés) : on
--     n'y touche pas.
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_qty INTEGER;

CREATE OR REPLACE FUNCTION public.decrement_stock_on_order_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products
       SET stock_qty = GREATEST(stock_qty - NEW.quantity, 0)
     WHERE id = NEW.product_id
       AND stock_qty IS NOT NULL
       AND stock_qty >= 0;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  -- Le déclencheur n'a de sens que si order_items référence bien le produit.
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'order_items'
               AND column_name = 'product_id') THEN
    DROP TRIGGER IF EXISTS trg_decrement_stock ON public.order_items;
    CREATE TRIGGER trg_decrement_stock
      AFTER INSERT ON public.order_items
      FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_on_order_item();
  ELSE
    RAISE WARNING 'order_items.product_id absent — décrément de stock non activé.';
  END IF;
END $$;

-- Restitution quand une commande est annulée.
CREATE OR REPLACE FUNCTION public.restock_on_order_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND COALESCE(OLD.status, '') <> 'cancelled' THEN
    UPDATE public.products p
       SET stock_qty = p.stock_qty + oi.quantity
      FROM public.order_items oi
     WHERE oi.order_id = NEW.id
       AND p.id = oi.product_id
       AND p.stock_qty IS NOT NULL
       AND p.stock_qty >= 0;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'order_items'
               AND column_name = 'product_id') THEN
    DROP TRIGGER IF EXISTS trg_restock_cancel ON public.orders;
    CREATE TRIGGER trg_restock_cancel
      AFTER UPDATE OF status ON public.orders
      FOR EACH ROW EXECUTE FUNCTION public.restock_on_order_cancel();
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
--  5. FONCTIONS D'ACCÈS PUBLIQUES
--     Elles remplacent les lectures anonymes de `orders`, qui exposaient les
--     coordonnées de tous les clients.
-- ════════════════════════════════════════════════════════════════════════════

-- Nombre de ventes par boutique — agrégat, aucune donnée personnelle.
CREATE OR REPLACE FUNCTION public.vendor_sales_counts()
RETURNS TABLE (vendor_id UUID, sales BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT o.vendor_id, COUNT(*)::BIGINT
  FROM public.orders o
  WHERE o.vendor_id IS NOT NULL
    AND o.status IN ('confirmed', 'paid', 'shipped', 'in_transit', 'delivered')
  GROUP BY o.vendor_id;
$$;

-- Statut de commandes dont on possède déjà l'identifiant (suivi du paiement).
-- Ne renvoie que id + statut : un identifiant deviné n'expose rien d'utile.
CREATE OR REPLACE FUNCTION public.orders_status(p_ids UUID[])
RETURNS TABLE (id UUID, status TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT o.id, o.status FROM public.orders o WHERE o.id = ANY(p_ids);
$$;

-- Suivi de commande invité : exige le numéro de commande ET le téléphone.
CREATE OR REPLACE FUNCTION public.track_order(p_reference TEXT, p_phone TEXT)
RETURNS SETOF public.orders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM public.orders o
  WHERE regexp_replace(COALESCE(o.client_phone, ''), '\D', '', 'g')
        = regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g')
    AND length(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g')) >= 8
    AND (
      o.id::TEXT = p_reference
      OR COALESCE(o.order_number::TEXT, '') = p_reference
    )
  LIMIT 5;
$$;

REVOKE ALL ON FUNCTION public.vendor_balance(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.request_payout(UUID, INTEGER, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.vendor_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_payout(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_sales_counts() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orders_status(UUID[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_order(TEXT, TEXT) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  6. RLS
-- ════════════════════════════════════════════════════════════════════════════

-- Raccourcis lisibles, utilisés par les policies.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin); $$;

CREATE OR REPLACE FUNCTION public.owns_vendor(p_vendor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = p_vendor_id AND v.user_id = auth.uid()); $$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owns_vendor(UUID) TO anon, authenticated;

-- ─── vendors : vitrine publique, écriture par le propriétaire ───
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendors read public"  ON public.vendors;
CREATE POLICY "vendors read public" ON public.vendors FOR SELECT USING (true);

DROP POLICY IF EXISTS "vendors insert self"  ON public.vendors;
CREATE POLICY "vendors insert self" ON public.vendors
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS "vendors update own"   ON public.vendors;
CREATE POLICY "vendors update own" ON public.vendors
  FOR UPDATE USING (auth.uid() = user_id OR public.is_super_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS "vendors delete admin" ON public.vendors;
CREATE POLICY "vendors delete admin" ON public.vendors
  FOR DELETE USING (public.is_super_admin());

-- ─── vendor_payout_settings : strictement privé ───
ALTER TABLE public.vendor_payout_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payout settings own" ON public.vendor_payout_settings;
CREATE POLICY "payout settings own" ON public.vendor_payout_settings
  FOR ALL USING (public.owns_vendor(vendor_id) OR public.is_super_admin())
  WITH CHECK (public.owns_vendor(vendor_id) OR public.is_super_admin());

-- ─── vendor_payouts : le vendeur demande et consulte, l'admin traite ───
ALTER TABLE public.vendor_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payouts read own"    ON public.vendor_payouts;
CREATE POLICY "payouts read own" ON public.vendor_payouts
  FOR SELECT USING (public.owns_vendor(vendor_id) OR public.is_super_admin());

-- L'insertion passe par request_payout() qui revalide le solde.
DROP POLICY IF EXISTS "payouts admin write" ON public.vendor_payouts;
CREATE POLICY "payouts admin write" ON public.vendor_payouts
  FOR UPDATE USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ─── products : catalogue public, écriture par la boutique ───
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products read public" ON public.products;
CREATE POLICY "products read public" ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "products write own"   ON public.products;
CREATE POLICY "products write own" ON public.products
  FOR INSERT WITH CHECK (public.owns_vendor(vendor_id) OR public.is_super_admin());

DROP POLICY IF EXISTS "products update own"  ON public.products;
CREATE POLICY "products update own" ON public.products
  FOR UPDATE USING (public.owns_vendor(vendor_id) OR public.is_super_admin())
  WITH CHECK (public.owns_vendor(vendor_id) OR public.is_super_admin());

DROP POLICY IF EXISTS "products delete own"  ON public.products;
CREATE POLICY "products delete own" ON public.products
  FOR DELETE USING (public.owns_vendor(vendor_id) OR public.is_super_admin());

-- ─── orders : plus aucune lecture anonyme ───
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders read own" ON public.orders;
CREATE POLICY "orders read own" ON public.orders
  FOR SELECT USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR public.owns_vendor(vendor_id)
    OR public.is_super_admin()
  );

-- Commande passée depuis le site, y compris sans compte : on impose le statut
-- de départ et on interdit de s'attribuer la commande d'un autre.
DROP POLICY IF EXISTS "orders insert checkout" ON public.orders;
CREATE POLICY "orders insert checkout" ON public.orders
  FOR INSERT WITH CHECK (
    status = 'pending'
    AND (user_id IS NULL OR user_id = auth.uid())
  );

DROP POLICY IF EXISTS "orders update allowed" ON public.orders;
CREATE POLICY "orders update allowed" ON public.orders
  FOR UPDATE USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR public.owns_vendor(vendor_id)
    OR public.is_super_admin()
  )
  -- Sans WITH CHECK, un vendeur pourrait réattribuer une commande à une autre
  -- boutique, ou un acheteur se l'approprier.
  WITH CHECK (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR public.owns_vendor(vendor_id)
    OR public.is_super_admin()
  );

-- ─── order_items : suivent l'accès de leur commande ───
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items read via order" ON public.order_items;
CREATE POLICY "order_items read via order" ON public.order_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND ((o.user_id IS NOT NULL AND o.user_id = auth.uid())
           OR public.owns_vendor(o.vendor_id)
           OR public.is_super_admin())
  ));

DROP POLICY IF EXISTS "order_items insert via order" ON public.order_items;
CREATE POLICY "order_items insert via order" ON public.order_items
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND o.status = 'pending'
  ));

-- ────────────────────────────────────────────────────────────────────────────
-- NOTE — les fonctions edge (webhook Monetbil, e-mails) utilisent la clé de
-- service : elles contournent RLS et continuent de fonctionner à l'identique.
-- ────────────────────────────────────────────────────────────────────────────
