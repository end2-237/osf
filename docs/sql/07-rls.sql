-- Verrou court : en cas de table occupée, on échoue vite au lieu de bloquer.
SET lock_timeout = '5s';

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
