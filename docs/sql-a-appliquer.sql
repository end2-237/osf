-- ════════════════════════════════════════════════════════════════════════════
--  BUYTICLE — SQL À APPLIQUER
--
--  Regroupe les migrations en attente, dans l'ordre. À coller d'un seul
--  bloc dans Supabase → SQL Editor → Run.
--
--  Le script est idempotent : le rejouer ne casse rien.
-- ════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════
--  20260810_vendor_customization
-- ═══════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- PERSONNALISATION VENDEUR
--   logo_url              : photo de profil de la boutique (affichée partout)
--   cover_url             : photo de couverture de la page boutique
--   member_discount_rate  : % de remise membre choisi par le vendeur (défaut 20)
--   payment_methods       : moyens de paiement acceptés par la boutique
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS logo_url             TEXT,
  ADD COLUMN IF NOT EXISTS cover_url            TEXT,
  ADD COLUMN IF NOT EXISTS member_discount_rate INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS payment_methods      TEXT[]
    DEFAULT ARRAY['orange_money', 'mtn_momo', 'cash_on_delivery']::TEXT[];

-- Les boutiques existantes gardent la remise historique de 20 % et acceptent
-- les trois moyens de paiement de la plateforme tant qu'elles n'ont rien choisi.
UPDATE public.vendors SET member_discount_rate = 20 WHERE member_discount_rate IS NULL;
UPDATE public.vendors
   SET payment_methods = ARRAY['orange_money', 'mtn_momo', 'cash_on_delivery']::TEXT[]
 WHERE payment_methods IS NULL OR cardinality(payment_methods) = 0;

-- Garde-fou : une remise reste entre 0 et 70 %.
ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_member_discount_rate_range;
ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_member_discount_rate_range
  CHECK (member_discount_rate IS NULL OR (member_discount_rate >= 0 AND member_discount_rate <= 70));

-- ─── Bucket public pour les visuels de boutique (logo + couverture) ───
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('vendor-assets', 'vendor-assets', true, 5242880)  -- 5 MB
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "Vendor assets lecture publique" ON storage.objects;
CREATE POLICY "Vendor assets lecture publique" ON storage.objects
  FOR SELECT USING (bucket_id = 'vendor-assets');

DROP POLICY IF EXISTS "Vendor assets upload authentifie" ON storage.objects;
CREATE POLICY "Vendor assets upload authentifie" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'vendor-assets' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Vendor assets update authentifie" ON storage.objects;
CREATE POLICY "Vendor assets update authentifie" ON storage.objects
  FOR UPDATE USING (bucket_id = 'vendor-assets' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Vendor assets delete authentifie" ON storage.objects;
CREATE POLICY "Vendor assets delete authentifie" ON storage.objects
  FOR DELETE USING (bucket_id = 'vendor-assets' AND auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════════════
--  20260811_vendor_payout_numbers
-- ═══════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- NUMÉROS MOBILE MONEY DU VENDEUR
--   momo_orange_number : numéro Orange Money sur lequel le vendeur encaisse
--   momo_mtn_number    : numéro MTN MoMo sur lequel le vendeur encaisse
--   description        : présentation de la boutique, éditable depuis le
--                        dashboard (la colonne existait pour les demandes
--                        vendeur mais pas forcément sur `vendors`)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS momo_orange_number TEXT,
  ADD COLUMN IF NOT EXISTS momo_mtn_number    TEXT,
  ADD COLUMN IF NOT EXISTS description        TEXT;

-- Format attendu : chiffres uniquement, indicatif pays compris (ex : 237691234567).
-- Le formulaire normalise avant l'envoi ; la contrainte empêche les saisies
-- fantaisistes d'atteindre la base.
ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_momo_orange_format;
ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_momo_orange_format
  CHECK (momo_orange_number IS NULL OR momo_orange_number ~ '^[0-9]{8,15}$');

ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_momo_mtn_format;
ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_momo_mtn_format
  CHECK (momo_mtn_number IS NULL OR momo_mtn_number ~ '^[0-9]{8,15}$');

-- Le nom de boutique sert d'adresse publique (/shop/<nom>) : deux boutiques ne
-- peuvent pas porter le même nom, à la casse et aux espaces près.
-- Si des doublons existent déjà, on ne bloque pas la migration : on prévient,
-- et l'index pourra être créé après nettoyage. Le dashboard vérifie de toute
-- façon la disponibilité du nom avant d'enregistrer.
DO $$
DECLARE dupes INT;
BEGIN
  SELECT count(*) INTO dupes FROM (
    SELECT lower(btrim(shop_name)) AS n
    FROM public.vendors
    WHERE shop_name IS NOT NULL
    GROUP BY 1 HAVING count(*) > 1
  ) d;

  IF dupes > 0 THEN
    RAISE WARNING 'vendors : % nom(s) de boutique en double — index unique non créé. Renommez-les puis rejouez ce bloc.', dupes;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS vendors_shop_name_unique_ci
      ON public.vendors (lower(btrim(shop_name)));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
--  20260812_security_payouts_stock_shipping
-- ═══════════════════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════════════════
--  20260813_delivery_mode_and_payout_admin
-- ═══════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
--  MODE DE LIVRAISON & TRAITEMENT DES RETRAITS
--
--  1. Chaque boutique choisit qui livre : elle-même, ou Buyticle Delivery.
--  2. Le solde en tient compte : quand Buyticle livre, c'est la plateforme qui
--     encaisse l'argent du paiement à la livraison — elle le doit donc au
--     vendeur, au même titre que le mobile money.
--  3. Fonctions de traitement des demandes de retrait pour le super-admin.
--
--  Idempotent : rejouable sans dommage.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

-- ════════════════════════════════════════════════════════════════════════════
--  1. MODE DE LIVRAISON
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS delivery_mode TEXT DEFAULT 'self';

UPDATE public.vendors SET delivery_mode = 'self' WHERE delivery_mode IS NULL;

ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_delivery_mode_valid;
ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_delivery_mode_valid
  CHECK (delivery_mode IN ('self', 'buyticle'));

COMMENT ON COLUMN public.vendors.delivery_mode IS
  'self = la boutique livre et encaisse elle-même le cash ; '
  'buyticle = Buyticle Delivery livre et encaisse pour elle.';

-- ════════════════════════════════════════════════════════════════════════════
--  2. SOLDE — tient compte du mode de livraison
--     · mobile money : toujours encaissé par la plateforme
--     · à la livraison : encaissé par la plateforme UNIQUEMENT si Buyticle
--       livre, et seulement une fois la commande livrée
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.vendor_balance(p_vendor_id UUID)
RETURNS TABLE (collected BIGINT, withdrawn BIGINT, pending BIGINT, available BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_collected BIGINT; v_withdrawn BIGINT; v_pending BIGINT; v_mode TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = p_vendor_id AND v.user_id = auth.uid()
  ) AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT COALESCE(delivery_mode, 'self') INTO v_mode
  FROM public.vendors WHERE id = p_vendor_id;

  SELECT COALESCE(SUM(o.total_amount), 0) INTO v_collected
  FROM public.orders o
  WHERE o.vendor_id = p_vendor_id
    AND (
      -- Encaissé en ligne par la plateforme dès que le paiement est validé.
      (o.payment_method IN ('orange_money', 'mtn_momo')
       AND o.status IN ('paid', 'shipped', 'in_transit', 'delivered'))
      OR
      -- Cash remis au livreur Buyticle : dû au vendeur une fois livré.
      (v_mode = 'buyticle'
       AND o.payment_method NOT IN ('orange_money', 'mtn_momo')
       AND o.status = 'delivered')
    );

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

-- ════════════════════════════════════════════════════════════════════════════
--  3. TRAITEMENT DES RETRAITS — super-admin
-- ════════════════════════════════════════════════════════════════════════════

-- Liste des demandes avec le nom de la boutique, sans exposer la table
-- `vendor_payout_settings` au client.
CREATE OR REPLACE FUNCTION public.admin_payouts(p_status TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID, vendor_id UUID, shop_name TEXT, vendor_email TEXT,
  amount INTEGER, method TEXT, phone TEXT, status TEXT,
  note TEXT, reference TEXT,
  requested_at TIMESTAMPTZ, processed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  RETURN QUERY
  SELECT p.id, p.vendor_id, v.shop_name, v.email,
         p.amount, p.method, p.phone, p.status,
         p.note, p.reference, p.requested_at, p.processed_at
  FROM public.vendor_payouts p
  JOIN public.vendors v ON v.id = p.vendor_id
  WHERE p_status IS NULL OR p.status = p_status
  ORDER BY
    CASE p.status WHEN 'pending' THEN 0 WHEN 'processing' THEN 1 ELSE 2 END,
    p.requested_at DESC;
END;
$$;

-- Changement de statut d'une demande. Les transitions sont contrôlées : une
-- demande déjà versée ou refusée ne se rouvre pas.
CREATE OR REPLACE FUNCTION public.process_payout(
  p_payout_id UUID,
  p_status    TEXT,
  p_reference TEXT DEFAULT NULL,
  p_note      TEXT DEFAULT NULL
)
RETURNS public.vendor_payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_current TEXT; v_row public.vendor_payouts;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF p_status NOT IN ('pending', 'processing', 'paid', 'rejected') THEN
    RAISE EXCEPTION 'Statut invalide';
  END IF;

  SELECT status INTO v_current FROM public.vendor_payouts WHERE id = p_payout_id;
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Demande introuvable';
  END IF;
  IF v_current IN ('paid', 'rejected') THEN
    RAISE EXCEPTION 'Cette demande est déjà clôturée (%)', v_current;
  END IF;

  UPDATE public.vendor_payouts
     SET status       = p_status,
         reference    = COALESCE(NULLIF(p_reference, ''), reference),
         note         = COALESCE(NULLIF(p_note, ''), note),
         processed_at = CASE WHEN p_status IN ('paid', 'rejected') THEN NOW() ELSE processed_at END
   WHERE id = p_payout_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_payouts(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.process_payout(UUID, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_payouts(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_payout(UUID, TEXT, TEXT, TEXT) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════
--  20260814_frais_livraison_dans_le_solde
-- ═══════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
--  QUI GARDE LES FRAIS DE LIVRAISON
--
--  Règle décidée :
--    · Buyticle ne prélève AUCUNE commission sur les ventes. Le vendeur touche
--      100 % du prix des articles.
--    · Les frais de livraison suivent celui qui livre :
--        – la boutique livre elle-même  → les frais lui reviennent ;
--        – Buyticle Delivery livre      → les frais reviennent à Buyticle.
--
--  Rappel de ce que contiennent les colonnes, parce que le calcul en dépend :
--    · orders.total_amount = prix des articles pour CE vendeur, remises et
--      code promo déjà déduits. Les frais de livraison n'y sont PAS.
--    · orders.delivery_fee = frais de livraison de cette commande, à part.
--    · Le client paie la somme des deux.
--
--  Conséquence sur le solde :
--    · Boutique qui livre + paiement en ligne : Buyticle a encaissé articles
--      ET frais, mais les frais sont au vendeur → on les lui ajoute.
--    · Boutique qui livre + paiement à la livraison : le vendeur encaisse tout
--      lui-même, la plateforme ne lui doit rien → la commande ne compte pas.
--    · Buyticle Delivery : on ne reverse que les articles, jamais les frais,
--      quel que soit le moyen de paiement.
--
--  Idempotent : rejouable sans dommage.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.vendor_balance(p_vendor_id UUID)
RETURNS TABLE (collected BIGINT, withdrawn BIGINT, pending BIGINT, available BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_collected BIGINT; v_withdrawn BIGINT; v_pending BIGINT; v_mode TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = p_vendor_id AND v.user_id = auth.uid()
  ) AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT COALESCE(delivery_mode, 'self') INTO v_mode
  FROM public.vendors WHERE id = p_vendor_id;

  SELECT COALESCE(SUM(
           -- Aucune commission : le prix des articles revient entièrement
           -- à la boutique.
           o.total_amount
           -- Les frais ne sont dus au vendeur que s'il livre lui-même. Ce
           -- cas ne concerne que les commandes payées en ligne : le filtre
           -- ci-dessous écarte déjà celles payées à la livraison, qu'il a
           -- encaissées de sa main.
           + CASE WHEN v_mode = 'self' THEN COALESCE(o.delivery_fee, 0) ELSE 0 END
         ), 0) INTO v_collected
  FROM public.orders o
  WHERE o.vendor_id = p_vendor_id
    AND (
      -- Encaissé en ligne par la plateforme dès que le paiement est validé.
      (o.payment_method IN ('orange_money', 'mtn_momo')
       AND o.status IN ('paid', 'shipped', 'in_transit', 'delivered'))
      OR
      -- Cash remis au livreur Buyticle : dû au vendeur une fois livré.
      (v_mode = 'buyticle'
       AND o.payment_method NOT IN ('orange_money', 'mtn_momo')
       AND o.status = 'delivered')
    );

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

COMMENT ON FUNCTION public.vendor_balance(UUID) IS
  'Ce que Buyticle doit à une boutique : 100 % du prix des articles encaissé '
  'pour elle (aucune commission), plus les frais de livraison uniquement si '
  'elle livre elle-même, moins ce qui lui a déjà été versé ou est en cours.';


-- ═══════════════════════════════════════════════════════════════════════
--  20260815_buyticle_delivery
-- ═══════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
--  BUYTICLE DELIVERY — POSITIONS, TARIFS EN DEUX TRAJETS, ACCÈS AU SUIVI
--
--  1. Une livraison, c'est deux trajets, et chacun coûte :
--       · la RAMASSE   : notre livreur va jusqu'à la boutique
--       · la REMISE    : la boutique jusqu'au client
--     Les deux varient avec la distance, et chacun a son propre tarif.
--
--  2. Le prix est calculé EN BASE, jamais dans le navigateur. Le client
--     pourrait sinon s'annoncer à 200 m de la boutique et payer 500 F pour
--     une course de 20 km. La distance retenue est la distance à vol
--     d'oiseau corrigée d'un facteur de sinuosité : elle ne dépend d'aucun
--     service extérieur, donc elle est reproductible et non falsifiable.
--     Le tracé routier réel n'est affiché que pour l'œil.
--
--  3. Le suivi ne s'ouvre pas sans compte. `delivery_view` est la seule
--     porte : elle ne répond qu'au vendeur de la commande, au livreur
--     assigné, ou à un super-admin.
--
--  Idempotent : rejouable sans dommage.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

-- ════════════════════════════════════════════════════════════════════════════
--  1. POSITIONS
-- ════════════════════════════════════════════════════════════════════════════

-- Le client enregistre son point avec son adresse : le livreur cherche une
-- porte, pas un quartier.
ALTER TABLE public.user_addresses
  ADD COLUMN IF NOT EXISTS lat            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geo_label      TEXT,
  ADD COLUMN IF NOT EXISTS geo_updated_at TIMESTAMPTZ;

-- La boutique : point de ramasse.
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS pickup_lat     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS pickup_lng     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS pickup_label   TEXT;

-- La commande fige les deux points ET le mode de livraison : la boutique peut
-- changer d'avis demain, la commande d'hier garde ses conditions.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS client_lat     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS client_lng     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS pickup_lat     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS pickup_lng     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS delivery_mode  TEXT,
  ADD COLUMN IF NOT EXISTS pickup_km      NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS dropoff_km     NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS pickup_fee     INTEGER,
  ADD COLUMN IF NOT EXISTS dropoff_fee    INTEGER,
  ADD COLUMN IF NOT EXISTS driver_id      UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS delivered_at   TIMESTAMPTZ;

-- Horodater la livraison : sans ça, « délai moyen » ne peut être qu'inventé.
CREATE OR REPLACE FUNCTION public.stamp_delivered_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'delivered' AND COALESCE(OLD.status, '') <> 'delivered' THEN
    NEW.delivered_at := COALESCE(NEW.delivered_at, NOW());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_stamp_delivered ON public.orders;
CREATE TRIGGER orders_stamp_delivered
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.stamp_delivered_at();

CREATE INDEX IF NOT EXISTS orders_driver_idx ON public.orders(driver_id)
  WHERE driver_id IS NOT NULL;

-- Un livreur est un compte comme un autre, avec un drapeau.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_driver BOOLEAN DEFAULT FALSE;

-- ════════════════════════════════════════════════════════════════════════════
--  2. TARIFS — une seule ligne, tenue par le super-admin
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.delivery_rates (
  id              BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),  -- ligne unique
  -- Trajet 1 : notre base → la boutique
  pickup_base     INTEGER NOT NULL DEFAULT 500,
  pickup_per_km   INTEGER NOT NULL DEFAULT 150,
  pickup_free_km  NUMERIC(6,2) NOT NULL DEFAULT 2,   -- km inclus dans la base
  -- Trajet 2 : la boutique → le client
  dropoff_base    INTEGER NOT NULL DEFAULT 700,
  dropoff_per_km  INTEGER NOT NULL DEFAULT 200,
  dropoff_free_km NUMERIC(6,2) NOT NULL DEFAULT 2,
  -- Garde-fous
  min_fee         INTEGER NOT NULL DEFAULT 1000,
  max_km          NUMERIC(6,2) NOT NULL DEFAULT 40,  -- au-delà, on ne livre pas
  road_factor     NUMERIC(4,2) NOT NULL DEFAULT 1.35,-- vol d'oiseau → route
  -- D'où partent nos livreurs
  hub_lat         DOUBLE PRECISION NOT NULL DEFAULT 4.0511,
  hub_lng         DOUBLE PRECISION NOT NULL DEFAULT 9.7679,
  hub_label       TEXT NOT NULL DEFAULT 'Akwa, Douala',
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.delivery_rates (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.delivery_rates IS
  'Tarifs Buyticle Delivery. Une livraison = ramasse (base → boutique) + '
  'remise (boutique → client). Chaque trajet a sa base, ses km offerts et '
  'son prix au km.';

ALTER TABLE public.delivery_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_rates_read  ON public.delivery_rates;
DROP POLICY IF EXISTS delivery_rates_write ON public.delivery_rates;

-- Lisible de tous : le panier doit pouvoir afficher la grille tarifaire.
CREATE POLICY delivery_rates_read ON public.delivery_rates
  FOR SELECT USING (TRUE);

CREATE POLICY delivery_rates_write ON public.delivery_rates
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════════
--  3. DISTANCE — haversine, en kilomètres
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.geo_km(
  lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION
)
RETURNS NUMERIC
LANGUAGE sql IMMUTABLE
AS $$
  SELECT ROUND(
    (6371 * 2 * ASIN(SQRT(
      POWER(SIN(RADIANS(lat2 - lat1) / 2), 2) +
      COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
      POWER(SIN(RADIANS(lng2 - lng1) / 2), 2)
    )))::NUMERIC, 3);
$$;

GRANT EXECUTE ON FUNCTION public.geo_km(DOUBLE PRECISION, DOUBLE PRECISION,
                                        DOUBLE PRECISION, DOUBLE PRECISION)
  TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  4. DEVIS — le prix d'une course, calculé en base
--
--  Renvoie toujours une ligne. `serviceable` dit si la course est acceptée ;
--  quand elle ne l'est pas, `reason` explique pourquoi et le total vaut 0.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.quote_delivery(
  p_vendor_id UUID,
  p_lat       DOUBLE PRECISION,
  p_lng       DOUBLE PRECISION
)
RETURNS TABLE (
  serviceable  BOOLEAN,
  reason       TEXT,
  pickup_km    NUMERIC,
  dropoff_km   NUMERIC,
  pickup_fee   INTEGER,
  dropoff_fee  INTEGER,
  total_fee    INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r        public.delivery_rates;
  v_plat   DOUBLE PRECISION; v_plng DOUBLE PRECISION;
  v_pk     NUMERIC; v_dk NUMERIC;
  v_pf     INTEGER; v_df INTEGER;
BEGIN
  SELECT * INTO r FROM public.delivery_rates WHERE id;

  SELECT COALESCE(pickup_lat, r.hub_lat), COALESCE(pickup_lng, r.hub_lng)
    INTO v_plat, v_plng
  FROM public.vendors WHERE id = p_vendor_id;

  IF v_plat IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Boutique introuvable', 0::NUMERIC, 0::NUMERIC, 0, 0, 0;
    RETURN;
  END IF;

  IF p_lat IS NULL OR p_lng IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Position du client inconnue', 0::NUMERIC, 0::NUMERIC, 0, 0, 0;
    RETURN;
  END IF;

  -- Les routes ne sont pas des lignes droites : on corrige le vol d'oiseau.
  v_pk := ROUND(public.geo_km(r.hub_lat, r.hub_lng, v_plat, v_plng) * r.road_factor, 2);
  v_dk := ROUND(public.geo_km(v_plat,   v_plng,     p_lat,  p_lng)  * r.road_factor, 2);

  IF v_dk > r.max_km THEN
    RETURN QUERY SELECT FALSE,
      format('Trop loin : %s km, nous livrons jusqu''à %s km', v_dk, r.max_km),
      v_pk, v_dk, 0, 0, 0;
    RETURN;
  END IF;

  -- Chaque trajet : une base qui couvre les premiers kilomètres, puis au km.
  v_pf := r.pickup_base  + CEIL(GREATEST(v_pk - r.pickup_free_km,  0) * r.pickup_per_km);
  v_df := r.dropoff_base + CEIL(GREATEST(v_dk - r.dropoff_free_km, 0) * r.dropoff_per_km);

  RETURN QUERY SELECT TRUE, NULL::TEXT, v_pk, v_dk, v_pf, v_df,
                      GREATEST(v_pf + v_df, r.min_fee);
END;
$$;

REVOKE ALL ON FUNCTION public.quote_delivery(UUID, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quote_delivery(UUID, DOUBLE PRECISION, DOUBLE PRECISION)
  TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  5. SUIVI — la seule porte d'entrée du module
--
--  Pas de compte, pas de carte. Et un compte ne suffit pas : il faut être le
--  vendeur de la commande, son livreur, ou un super-admin.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.delivery_view(p_order_id UUID)
RETURNS TABLE (
  id             UUID,
  order_number   TEXT,
  status         TEXT,
  created_at     TIMESTAMPTZ,
  total_amount   NUMERIC,
  payment_method TEXT,
  delivery_mode  TEXT,
  client_name    TEXT,
  client_phone   TEXT,
  client_address TEXT,
  client_lat     DOUBLE PRECISION,
  client_lng     DOUBLE PRECISION,
  pickup_lat     DOUBLE PRECISION,
  pickup_lng     DOUBLE PRECISION,
  pickup_label   TEXT,
  shop_name      TEXT,
  shop_phone     TEXT,
  vendor_id      UUID,
  driver_id      UUID,
  driver_name    TEXT,
  pickup_km      NUMERIC,
  dropoff_km     NUMERIC,
  pickup_fee     INTEGER,
  dropoff_fee    INTEGER,
  delivered_at   TIMESTAMPTZ,
  driver_phone   TEXT,
  viewer_role    TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role TEXT; v_vendor UUID; v_driver UUID; v_exists BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;

  -- `id` est un nom de sortie : toute lecture de colonne doit être préfixée,
  -- sinon PostgreSQL ne sait pas si l'on parle de la variable ou de la table.
  SELECT TRUE, o.vendor_id, o.driver_id INTO v_exists, v_vendor, v_driver
  FROM public.orders o WHERE o.id = p_order_id;

  IF NOT COALESCE(v_exists, FALSE) THEN
    RAISE EXCEPTION 'Commande introuvable';
  END IF;

  v_role := CASE
    WHEN public.is_super_admin()                THEN 'admin'
    WHEN v_driver = auth.uid()                  THEN 'driver'
    WHEN v_vendor IS NOT NULL
         AND public.owns_vendor(v_vendor)       THEN 'vendor'
    ELSE NULL
  END;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Cette commande ne vous est pas accessible';
  END IF;

  RETURN QUERY
  SELECT o.id,
         o.order_number::TEXT, o.status::TEXT, o.created_at,
         o.total_amount::NUMERIC, o.payment_method::TEXT,
         -- Le mode figé à la commande fait foi ; à défaut, celui de la boutique.
         COALESCE(o.delivery_mode, v.delivery_mode, 'self')::TEXT,
         o.client_name::TEXT, o.client_phone::TEXT, o.client_address::TEXT,
         o.client_lat, o.client_lng,
         COALESCE(o.pickup_lat, v.pickup_lat),
         COALESCE(o.pickup_lng, v.pickup_lng),
         v.pickup_label::TEXT, v.shop_name::TEXT, v.phone::TEXT,
         o.vendor_id, o.driver_id, p.full_name::TEXT,
         o.pickup_km::NUMERIC, o.dropoff_km::NUMERIC,
         o.pickup_fee::INTEGER, o.dropoff_fee::INTEGER,
         o.delivered_at, p.phone::TEXT,
         v_role
  FROM public.orders o
  LEFT JOIN public.vendors  v ON v.id = o.vendor_id
  LEFT JOIN public.profiles p ON p.id = o.driver_id
  WHERE o.id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_view(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.delivery_view(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  6. LISTE DES COURSES — ce que le module affiche à gauche
--
--  Un vendeur voit ses commandes, un livreur les siennes, l'admin voit toutes
--  celles qui passent par Buyticle Delivery.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.delivery_feed()
RETURNS TABLE (
  id            UUID,
  order_number  TEXT,
  status        TEXT,
  created_at    TIMESTAMPTZ,
  total_amount  NUMERIC,
  client_name   TEXT,
  client_address TEXT,
  client_lat    DOUBLE PRECISION,
  client_lng    DOUBLE PRECISION,
  pickup_lat    DOUBLE PRECISION,
  pickup_lng    DOUBLE PRECISION,
  shop_name     TEXT,
  delivery_mode TEXT,
  dropoff_km    NUMERIC,
  delivered_at  TIMESTAMPTZ,
  course_fee    INTEGER,
  driver_id     UUID,
  driver_name   TEXT,
  driver_phone  TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;

  RETURN QUERY
  SELECT o.id, o.order_number::TEXT, o.status::TEXT, o.created_at,
         o.total_amount::NUMERIC,
         o.client_name::TEXT, o.client_address::TEXT, o.client_lat, o.client_lng,
         COALESCE(o.pickup_lat, v.pickup_lat),
         COALESCE(o.pickup_lng, v.pickup_lng),
         v.shop_name::TEXT,
         COALESCE(o.delivery_mode, v.delivery_mode, 'self')::TEXT,
         o.dropoff_km::NUMERIC,
         o.delivered_at,
         (COALESCE(o.pickup_fee, 0) + COALESCE(o.dropoff_fee, 0))::INTEGER,
         o.driver_id, p.full_name::TEXT, p.phone::TEXT
  FROM public.orders o
  LEFT JOIN public.vendors  v ON v.id = o.vendor_id
  LEFT JOIN public.profiles p ON p.id = o.driver_id
  WHERE o.status NOT IN ('cancelled', 'payment_failed')
    AND (
      -- Admin : tout ce qui est confié à Buyticle Delivery.
      (public.is_super_admin()
       AND COALESCE(o.delivery_mode, v.delivery_mode) = 'buyticle')
      -- Livreur : ses courses.
      OR o.driver_id = auth.uid()
      -- Vendeur : ses commandes, qu'il livre lui-même ou non.
      OR (o.vendor_id IS NOT NULL AND public.owns_vendor(o.vendor_id))
    )
  ORDER BY o.created_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_feed() FROM anon;
GRANT EXECUTE ON FUNCTION public.delivery_feed() TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════
--  20260816_position_boutique_obligatoire
-- ═══════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
--  SANS POSITION DE BOUTIQUE, PAS D'ITINÉRAIRE
--
--  Le devis retombait silencieusement sur la base Buyticle quand la boutique
--  n'avait pas enregistré son point. Deux conséquences, toutes deux fausses :
--    · le trajet « boutique → client » ne pouvait pas être tracé ;
--    · le client se voyait facturer une distance qui n'était pas la sienne.
--
--  Le devis refuse désormais, avec un motif que le panier affiche tel quel.
--
--  Idempotent : rejouable sans dommage.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.quote_delivery(
  p_vendor_id UUID,
  p_lat       DOUBLE PRECISION,
  p_lng       DOUBLE PRECISION
)
RETURNS TABLE (
  serviceable  BOOLEAN,
  reason       TEXT,
  pickup_km    NUMERIC,
  dropoff_km   NUMERIC,
  pickup_fee   INTEGER,
  dropoff_fee  INTEGER,
  total_fee    INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r        public.delivery_rates;
  v_plat   DOUBLE PRECISION; v_plng DOUBLE PRECISION;
  v_found  BOOLEAN := FALSE;
  v_pk     NUMERIC; v_dk NUMERIC;
  v_pf     INTEGER; v_df INTEGER;
BEGIN
  SELECT * INTO r FROM public.delivery_rates WHERE id;

  SELECT TRUE, pickup_lat, pickup_lng INTO v_found, v_plat, v_plng
  FROM public.vendors WHERE id = p_vendor_id;

  IF NOT v_found THEN
    RETURN QUERY SELECT FALSE, 'Boutique introuvable', 0::NUMERIC, 0::NUMERIC, 0, 0, 0;
    RETURN;
  END IF;

  -- Le point de ramasse est le départ de l'itinéraire. Sans lui, il n'y a ni
  -- trajet à tracer ni distance à facturer : on ne devine pas.
  IF v_plat IS NULL OR v_plng IS NULL THEN
    RETURN QUERY SELECT FALSE,
      'la boutique n''a pas encore enregistré sa position sur la carte',
      0::NUMERIC, 0::NUMERIC, 0, 0, 0;
    RETURN;
  END IF;

  IF p_lat IS NULL OR p_lng IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Position du client inconnue', 0::NUMERIC, 0::NUMERIC, 0, 0, 0;
    RETURN;
  END IF;

  -- Les routes ne sont pas des lignes droites : on corrige le vol d'oiseau.
  v_pk := ROUND(public.geo_km(r.hub_lat, r.hub_lng, v_plat, v_plng) * r.road_factor, 2);
  v_dk := ROUND(public.geo_km(v_plat,   v_plng,     p_lat,  p_lng)  * r.road_factor, 2);

  IF v_dk > r.max_km THEN
    RETURN QUERY SELECT FALSE,
      format('trop loin — %s km, nous livrons jusqu''à %s km', v_dk, r.max_km),
      v_pk, v_dk, 0, 0, 0;
    RETURN;
  END IF;

  v_pf := r.pickup_base  + CEIL(GREATEST(v_pk - r.pickup_free_km,  0) * r.pickup_per_km);
  v_df := r.dropoff_base + CEIL(GREATEST(v_dk - r.dropoff_free_km, 0) * r.dropoff_per_km);

  RETURN QUERY SELECT TRUE, NULL::TEXT, v_pk, v_dk, v_pf, v_df,
                      GREATEST(v_pf + v_df, r.min_fee);
END;
$$;

REVOKE ALL ON FUNCTION public.quote_delivery(UUID, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quote_delivery(UUID, DOUBLE PRECISION, DOUBLE PRECISION)
  TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  Une boutique ne peut pas confier ses livraisons à Buyticle Delivery sans
--  avoir dit d'où part la marchandise. La règle est portée par la base : elle
--  tient même si quelqu'un écrit dans la table sans passer par l'écran.
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_buyticle_needs_pickup;
ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_buyticle_needs_pickup
  CHECK (
    delivery_mode IS DISTINCT FROM 'buyticle'
    OR (pickup_lat IS NOT NULL AND pickup_lng IS NOT NULL)
  )
  NOT VALID;   -- les boutiques déjà en base ne sont pas rejetées rétroactivement

COMMENT ON CONSTRAINT vendors_buyticle_needs_pickup ON public.vendors IS
  'Buyticle Delivery part de la boutique : son point doit être connu.';


-- ═══════════════════════════════════════════════════════════════════════
--  20260817_livreurs_et_courses
-- ═══════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
--  LIVREURS, ATTRIBUTION ET DÉMARRAGE DE COURSE
--
--  Deux familles de livreurs cohabitent :
--    · ceux de Buyticle (vendor_id NULL) — l'admin les gère et les attribue
--      aux commandes que les boutiques nous confient ;
--    · ceux d'une boutique — elle seule les voit et les attribue, pour les
--      commandes qu'elle livre elle-même.
--  Dans les deux cas « je démarre moi-même » reste possible : on s'attribue
--  la course sans passer par un tiers.
--
--  Une course part de là où se trouve celui qui la fait, pas de la boutique :
--  il doit d'abord aller chercher le colis. Le point de départ est donc figé
--  au démarrage — position réelle si le navigateur la donne, siège Buyticle
--  sinon — et l'itinéraire compte trois points : où je suis, où je récupère,
--  où je livre.
--
--  Idempotent : rejouable sans dommage.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

-- ════════════════════════════════════════════════════════════════════════════
--  1. LES LIVREURS
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.couriers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = livreur Buyticle. Sinon, livreur propre à cette boutique.
  vendor_id  UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  -- Renseigné quand le livreur a un compte : il peut alors ouvrir la console.
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name  TEXT NOT NULL,
  phone      TEXT,
  avatar_url TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS couriers_vendor_idx ON public.couriers(vendor_id);
CREATE INDEX IF NOT EXISTS couriers_user_idx   ON public.couriers(user_id)
  WHERE user_id IS NOT NULL;

COMMENT ON TABLE public.couriers IS
  'Livreurs. vendor_id NULL = livreur Buyticle géré par l''admin ; sinon '
  'livreur appartenant à une boutique.';

ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS couriers_read  ON public.couriers;
DROP POLICY IF EXISTS couriers_write ON public.couriers;

-- On voit les livreurs Buyticle, les siens, et soi-même.
CREATE POLICY couriers_read ON public.couriers
  FOR SELECT USING (
    vendor_id IS NULL
    OR public.owns_vendor(vendor_id)
    OR user_id = auth.uid()
    OR public.is_super_admin()
  );

-- On ne modifie que les siens ; les livreurs Buyticle sont à l'admin seul.
CREATE POLICY couriers_write ON public.couriers
  FOR ALL
  USING      (CASE WHEN vendor_id IS NULL THEN public.is_super_admin()
                   ELSE public.owns_vendor(vendor_id) OR public.is_super_admin() END)
  WITH CHECK (CASE WHEN vendor_id IS NULL THEN public.is_super_admin()
                   ELSE public.owns_vendor(vendor_id) OR public.is_super_admin() END);

-- ════════════════════════════════════════════════════════════════════════════
--  2. LA COURSE SUR LA COMMANDE
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_id        UUID REFERENCES public.couriers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS course_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS origin_lat        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS origin_lng        DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS orders_courier_idx ON public.orders(courier_id)
  WHERE courier_id IS NOT NULL;

COMMENT ON COLUMN public.orders.origin_lat IS
  'D''où le livreur est parti chercher le colis. Figé au démarrage.';

-- ════════════════════════════════════════════════════════════════════════════
--  3. QUI PEUT ÊTRE ATTRIBUÉ À CETTE COMMANDE
--
--  L'écran ne devine pas : la base répond, selon qui demande et selon le mode
--  de livraison choisi par la boutique.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.assignable_couriers(p_order_id UUID)
RETURNS TABLE (
  id         UUID,
  full_name  TEXT,
  phone      TEXT,
  avatar_url TEXT,
  scope      TEXT,      -- 'buyticle' | 'boutique' | 'moi'
  is_me      BOOLEAN,
  active_runs INTEGER   -- courses déjà en cours, pour ne pas surcharger
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_vendor UUID; v_mode TEXT; v_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  SELECT o.vendor_id, COALESCE(o.delivery_mode, v.delivery_mode, 'self')
    INTO v_vendor, v_mode
  FROM public.orders o LEFT JOIN public.vendors v ON v.id = o.vendor_id
  WHERE o.id = p_order_id;

  IF v_vendor IS NULL AND v_mode IS NULL THEN
    RAISE EXCEPTION 'Commande introuvable';
  END IF;

  v_admin := public.is_super_admin();

  IF NOT v_admin AND NOT public.owns_vendor(v_vendor) THEN
    RAISE EXCEPTION 'Cette commande ne vous est pas accessible';
  END IF;

  RETURN QUERY
  SELECT c.id, c.full_name::TEXT, c.phone::TEXT, c.avatar_url::TEXT,
         CASE WHEN c.vendor_id IS NULL THEN 'buyticle' ELSE 'boutique' END::TEXT,
         (c.user_id IS NOT NULL AND c.user_id = auth.uid()),
         (SELECT COUNT(*) FROM public.orders o2
           WHERE o2.courier_id = c.id
             AND o2.status NOT IN ('delivered', 'cancelled', 'payment_failed'))::INTEGER
  FROM public.couriers c
  WHERE c.is_active
    AND (
      -- Commande confiée à Buyticle : nos livreurs, vus par l'admin.
      (v_mode = 'buyticle' AND c.vendor_id IS NULL AND v_admin)
      -- Commande livrée par la boutique : ses propres livreurs.
      OR (v_mode = 'self' AND c.vendor_id = v_vendor)
    )
  ORDER BY (c.user_id = auth.uid()) DESC NULLS LAST, c.full_name;
END;
$$;

REVOKE ALL ON FUNCTION public.assignable_couriers(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.assignable_couriers(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  4. ATTRIBUER
--
--  p_courier_id NULL retire l'attribution. Le livreur doit appartenir au
--  périmètre du demandeur : un vendeur ne s'attribue pas un livreur Buyticle,
--  et l'admin ne dispose pas des livreurs d'une boutique.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.assign_courier(
  p_order_id   UUID,
  p_courier_id UUID
)
RETURNS TABLE (courier_id UUID, courier_name TEXT, assigned_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor UUID; v_mode TEXT; v_admin BOOLEAN;
  v_cv UUID; v_cuser UUID; v_cname TEXT; v_active BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  SELECT o.vendor_id, COALESCE(o.delivery_mode, v.delivery_mode, 'self')
    INTO v_vendor, v_mode
  FROM public.orders o LEFT JOIN public.vendors v ON v.id = o.vendor_id
  WHERE o.id = p_order_id;

  IF v_mode IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;

  v_admin := public.is_super_admin();
  IF NOT v_admin AND NOT public.owns_vendor(v_vendor) THEN
    RAISE EXCEPTION 'Cette commande ne vous est pas accessible';
  END IF;

  -- Retrait d'attribution
  IF p_courier_id IS NULL THEN
    UPDATE public.orders o
       SET courier_id = NULL, driver_id = NULL, assigned_at = NULL
     WHERE o.id = p_order_id;
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT c.vendor_id, c.user_id, c.full_name, c.is_active
    INTO v_cv, v_cuser, v_cname, v_active
  FROM public.couriers c WHERE c.id = p_courier_id;

  IF v_cname IS NULL THEN RAISE EXCEPTION 'Livreur introuvable'; END IF;
  IF NOT v_active     THEN RAISE EXCEPTION 'Ce livreur n''est plus actif'; END IF;

  IF v_mode = 'buyticle' THEN
    IF v_cv IS NOT NULL THEN
      RAISE EXCEPTION 'Cette commande est confiée à Buyticle Delivery : elle revient à un livreur Buyticle';
    END IF;
    IF NOT v_admin THEN
      RAISE EXCEPTION 'Seul Buyticle attribue les courses qui lui sont confiées';
    END IF;
  ELSE
    IF v_cv IS DISTINCT FROM v_vendor THEN
      RAISE EXCEPTION 'Ce livreur n''appartient pas à cette boutique';
    END IF;
  END IF;

  UPDATE public.orders o
     SET courier_id  = p_courier_id,
         driver_id   = v_cuser,          -- donne l'accès console au livreur
         assigned_at = NOW()
   WHERE o.id = p_order_id;

  RETURN QUERY SELECT p_courier_id, v_cname::TEXT, NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.assign_courier(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_courier(UUID, UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  5. DÉMARRER
--
--  Fige le point de départ et fait passer la commande en route. Sans position
--  transmise, on retient le siège Buyticle : mieux vaut un départ approximatif
--  et annoncé qu'un itinéraire sans origine.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.start_course(
  p_order_id UUID,
  p_lat      DOUBLE PRECISION DEFAULT NULL,
  p_lng      DOUBLE PRECISION DEFAULT NULL
)
RETURNS TABLE (
  started_at TIMESTAMPTZ, origin_lat DOUBLE PRECISION, origin_lng DOUBLE PRECISION, status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor UUID; v_courier UUID; v_cuser UUID;
  v_lat DOUBLE PRECISION; v_lng DOUBLE PRECISION; r public.delivery_rates;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  SELECT o.vendor_id, o.courier_id INTO v_vendor, v_courier
  FROM public.orders o WHERE o.id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;

  SELECT c.user_id INTO v_cuser FROM public.couriers c WHERE c.id = v_courier;

  IF NOT (public.is_super_admin()
          OR public.owns_vendor(v_vendor)
          OR v_cuser = auth.uid()) THEN
    RAISE EXCEPTION 'Cette course ne vous est pas accessible';
  END IF;

  IF v_courier IS NULL THEN
    RAISE EXCEPTION 'Attribue d''abord la course à un livreur';
  END IF;

  SELECT * INTO r FROM public.delivery_rates WHERE id;
  v_lat := COALESCE(p_lat, r.hub_lat);
  v_lng := COALESCE(p_lng, r.hub_lng);

  -- `origin_lat`, `origin_lng` et `status` sont des noms de sortie. L'alias
  -- `o` lève l'ambiguïté : à droite du signe égal, seule la colonne est
  -- désignable. Les cibles de SET, elles, sont toujours des colonnes.
  UPDATE public.orders o
     SET course_started_at = COALESCE(o.course_started_at, NOW()),
         origin_lat        = COALESCE(o.origin_lat, v_lat),
         origin_lng        = COALESCE(o.origin_lng, v_lng),
         status            = CASE WHEN o.status IN ('delivered', 'cancelled', 'payment_failed')
                                  THEN o.status ELSE 'in_transit' END
   WHERE o.id = p_order_id;

  RETURN QUERY
  SELECT o2.course_started_at, o2.origin_lat, o2.origin_lng, o2.status::TEXT
  FROM public.orders o2 WHERE o2.id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_course(UUID, DOUBLE PRECISION, DOUBLE PRECISION) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_course(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  6. LES VUES DE LA CONSOLE — livreur, départ, démarrage
-- ════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.delivery_feed();

CREATE OR REPLACE FUNCTION public.delivery_feed()
RETURNS TABLE (
  id                UUID,
  order_number      TEXT,
  status            TEXT,
  created_at        TIMESTAMPTZ,
  total_amount      NUMERIC,
  client_name       TEXT,
  client_address    TEXT,
  client_lat        DOUBLE PRECISION,
  client_lng        DOUBLE PRECISION,
  pickup_lat        DOUBLE PRECISION,
  pickup_lng        DOUBLE PRECISION,
  shop_name         TEXT,
  delivery_mode     TEXT,
  dropoff_km        NUMERIC,
  delivered_at      TIMESTAMPTZ,
  course_fee        INTEGER,
  courier_id        UUID,
  courier_name      TEXT,
  courier_phone     TEXT,
  course_started_at TIMESTAMPTZ,
  origin_lat        DOUBLE PRECISION,
  origin_lng        DOUBLE PRECISION,
  can_manage        BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  RETURN QUERY
  SELECT o.id, o.order_number::TEXT, o.status::TEXT, o.created_at,
         o.total_amount::NUMERIC,
         o.client_name::TEXT, o.client_address::TEXT, o.client_lat, o.client_lng,
         COALESCE(o.pickup_lat, v.pickup_lat),
         COALESCE(o.pickup_lng, v.pickup_lng),
         v.shop_name::TEXT,
         COALESCE(o.delivery_mode, v.delivery_mode, 'self')::TEXT,
         o.dropoff_km::NUMERIC,
         o.delivered_at,
         (COALESCE(o.pickup_fee, 0) + COALESCE(o.dropoff_fee, 0))::INTEGER,
         o.courier_id, c.full_name::TEXT, c.phone::TEXT,
         o.course_started_at, o.origin_lat, o.origin_lng,
         -- Qui peut attribuer et démarrer cette course.
         (public.is_super_admin()
          OR (o.vendor_id IS NOT NULL AND public.owns_vendor(o.vendor_id)))
  FROM public.orders o
  LEFT JOIN public.vendors  v ON v.id = o.vendor_id
  LEFT JOIN public.couriers c ON c.id = o.courier_id
  WHERE o.status NOT IN ('cancelled', 'payment_failed')
    AND (
      (public.is_super_admin()
       AND COALESCE(o.delivery_mode, v.delivery_mode) = 'buyticle')
      OR o.driver_id = auth.uid()
      OR (o.vendor_id IS NOT NULL AND public.owns_vendor(o.vendor_id))
    )
  ORDER BY o.created_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_feed() FROM anon;
GRANT EXECUTE ON FUNCTION public.delivery_feed() TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  7. « JE DÉMARRE MOI-MÊME »
--
--  Prendre la course soi-même ne devrait pas obliger à se créer d'abord une
--  fiche livreur. Cette fonction s'en charge : elle réutilise la fiche du
--  demandeur si elle existe, la crée sinon, dans le bon périmètre — Buyticle
--  pour l'admin, la boutique pour le vendeur — puis attribue.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.take_course(p_order_id UUID)
RETURNS TABLE (courier_id UUID, courier_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor UUID; v_mode TEXT; v_admin BOOLEAN;
  v_scope  UUID;                    -- vendor_id de la fiche à utiliser
  v_id     UUID; v_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  SELECT o.vendor_id, COALESCE(o.delivery_mode, v.delivery_mode, 'self')
    INTO v_vendor, v_mode
  FROM public.orders o LEFT JOIN public.vendors v ON v.id = o.vendor_id
  WHERE o.id = p_order_id;
  IF v_mode IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;

  v_admin := public.is_super_admin();

  -- Une course confiée à Buyticle se prend côté Buyticle ; une course de
  -- boutique se prend côté boutique. Le périmètre suit le mode, pas le rôle.
  IF v_mode = 'buyticle' THEN
    IF NOT v_admin THEN
      RAISE EXCEPTION 'Cette course est confiée à Buyticle Delivery';
    END IF;
    v_scope := NULL;
  ELSE
    IF NOT (v_admin OR public.owns_vendor(v_vendor)) THEN
      RAISE EXCEPTION 'Cette commande ne vous est pas accessible';
    END IF;
    v_scope := v_vendor;
  END IF;

  SELECT c.id, c.full_name INTO v_id, v_name
  FROM public.couriers c
  WHERE c.user_id = auth.uid()
    AND c.vendor_id IS NOT DISTINCT FROM v_scope
  LIMIT 1;

  IF v_id IS NULL THEN
    SELECT COALESCE(NULLIF(BTRIM(p.full_name), ''), 'Moi')
      INTO v_name FROM public.profiles p WHERE p.id = auth.uid();

    INSERT INTO public.couriers AS c (vendor_id, user_id, full_name, created_by)
    VALUES (v_scope, auth.uid(), COALESCE(v_name, 'Moi'), auth.uid())
    RETURNING c.id, c.full_name INTO v_id, v_name;
  ELSE
    UPDATE public.couriers c SET is_active = TRUE
     WHERE c.id = v_id AND NOT c.is_active;
  END IF;

  UPDATE public.orders o
     SET courier_id = v_id, driver_id = auth.uid(), assigned_at = NOW()
   WHERE o.id = p_order_id;

  RETURN QUERY SELECT v_id, v_name::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.take_course(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.take_course(UUID) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════
--  20260818_corrige_ambiguites
-- ═══════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
--  CORRECTIF — « column reference "origin_lat" is ambiguous »
--
--  Les noms déclarés dans RETURNS TABLE sont des variables de sortie visibles
--  dans tout le corps de la fonction. Quand l'un d'eux porte le nom d'une
--  colonne touchée par la requête, PostgreSQL ne sait plus lequel on désigne
--  et refuse d'exécuter :
--
--      SET origin_lat = COALESCE(origin_lat, v_lat)
--                                 ^^^^^^^^^^ la variable, ou la colonne ?
--
--  La correction est d'aliaser la table mise à jour et de préfixer chaque
--  lecture de colonne. Les cibles de SET restent nues : PostgreSQL exige
--  qu'elles soient des colonnes, donc elles ne sont jamais ambiguës.
--
--  Trois fonctions étaient touchées :
--    · start_course   — origin_lat, origin_lng, status  (l'erreur remontée)
--    · assign_courier — courier_id, assigned_at
--    · take_course    — courier_id
--  Et delivery_view lisait `WHERE id = …` sans préfixe, avec `id` en sortie.
--
--  Aucune signature ne change : les écrans n'ont rien à adapter.
--  Idempotent : rejouable sans dommage.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

-- ════════════════════════════════════════════════════════════════════════════
--  1. DÉMARRER UNE COURSE
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.start_course(
  p_order_id UUID,
  p_lat      DOUBLE PRECISION DEFAULT NULL,
  p_lng      DOUBLE PRECISION DEFAULT NULL
)
RETURNS TABLE (
  started_at TIMESTAMPTZ, origin_lat DOUBLE PRECISION, origin_lng DOUBLE PRECISION, status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor UUID; v_courier UUID; v_cuser UUID;
  v_lat DOUBLE PRECISION; v_lng DOUBLE PRECISION; r public.delivery_rates;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  SELECT o.vendor_id, o.courier_id INTO v_vendor, v_courier
  FROM public.orders o WHERE o.id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;

  SELECT c.user_id INTO v_cuser FROM public.couriers c WHERE c.id = v_courier;

  IF NOT (public.is_super_admin()
          OR public.owns_vendor(v_vendor)
          OR v_cuser = auth.uid()) THEN
    RAISE EXCEPTION 'Cette course ne vous est pas accessible';
  END IF;

  IF v_courier IS NULL THEN
    RAISE EXCEPTION 'Attribue d''abord la course à un livreur';
  END IF;

  SELECT * INTO r FROM public.delivery_rates WHERE id;
  v_lat := COALESCE(p_lat, r.hub_lat);
  v_lng := COALESCE(p_lng, r.hub_lng);

  -- L'alias `o` lève toute ambiguïté : à droite du signe égal, `o.origin_lat`
  -- ne peut désigner que la colonne.
  UPDATE public.orders o
     SET course_started_at = COALESCE(o.course_started_at, NOW()),
         origin_lat        = COALESCE(o.origin_lat, v_lat),
         origin_lng        = COALESCE(o.origin_lng, v_lng),
         status            = CASE WHEN o.status IN ('delivered', 'cancelled', 'payment_failed')
                                  THEN o.status ELSE 'in_transit' END
   WHERE o.id = p_order_id;

  RETURN QUERY
  SELECT o2.course_started_at, o2.origin_lat, o2.origin_lng, o2.status::TEXT
  FROM public.orders o2 WHERE o2.id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_course(UUID, DOUBLE PRECISION, DOUBLE PRECISION) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_course(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  2. ATTRIBUER
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.assign_courier(
  p_order_id   UUID,
  p_courier_id UUID
)
RETURNS TABLE (courier_id UUID, courier_name TEXT, assigned_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor UUID; v_mode TEXT; v_admin BOOLEAN;
  v_cv UUID; v_cuser UUID; v_cname TEXT; v_active BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  SELECT o.vendor_id, COALESCE(o.delivery_mode, v.delivery_mode, 'self')
    INTO v_vendor, v_mode
  FROM public.orders o LEFT JOIN public.vendors v ON v.id = o.vendor_id
  WHERE o.id = p_order_id;

  IF v_mode IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;

  v_admin := public.is_super_admin();
  IF NOT v_admin AND NOT public.owns_vendor(v_vendor) THEN
    RAISE EXCEPTION 'Cette commande ne vous est pas accessible';
  END IF;

  IF p_courier_id IS NULL THEN
    UPDATE public.orders o
       SET courier_id = NULL, driver_id = NULL, assigned_at = NULL
     WHERE o.id = p_order_id;
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT c.vendor_id, c.user_id, c.full_name, c.is_active
    INTO v_cv, v_cuser, v_cname, v_active
  FROM public.couriers c WHERE c.id = p_courier_id;

  IF v_cname IS NULL THEN RAISE EXCEPTION 'Livreur introuvable'; END IF;
  IF NOT v_active     THEN RAISE EXCEPTION 'Ce livreur n''est plus actif'; END IF;

  IF v_mode = 'buyticle' THEN
    IF v_cv IS NOT NULL THEN
      RAISE EXCEPTION 'Cette commande est confiée à Buyticle Delivery : elle revient à un livreur Buyticle';
    END IF;
    IF NOT v_admin THEN
      RAISE EXCEPTION 'Seul Buyticle attribue les courses qui lui sont confiées';
    END IF;
  ELSE
    IF v_cv IS DISTINCT FROM v_vendor THEN
      RAISE EXCEPTION 'Ce livreur n''appartient pas à cette boutique';
    END IF;
  END IF;

  UPDATE public.orders o
     SET courier_id  = p_courier_id,
         driver_id   = v_cuser,
         assigned_at = NOW()
   WHERE o.id = p_order_id;

  RETURN QUERY SELECT p_courier_id, v_cname::TEXT, NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.assign_courier(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_courier(UUID, UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  3. PRENDRE LA COURSE SOI-MÊME
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.take_course(p_order_id UUID)
RETURNS TABLE (courier_id UUID, courier_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor UUID; v_mode TEXT; v_admin BOOLEAN;
  v_scope  UUID;
  v_id     UUID; v_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  SELECT o.vendor_id, COALESCE(o.delivery_mode, v.delivery_mode, 'self')
    INTO v_vendor, v_mode
  FROM public.orders o LEFT JOIN public.vendors v ON v.id = o.vendor_id
  WHERE o.id = p_order_id;
  IF v_mode IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;

  v_admin := public.is_super_admin();

  IF v_mode = 'buyticle' THEN
    IF NOT v_admin THEN
      RAISE EXCEPTION 'Cette course est confiée à Buyticle Delivery';
    END IF;
    v_scope := NULL;
  ELSE
    IF NOT (v_admin OR public.owns_vendor(v_vendor)) THEN
      RAISE EXCEPTION 'Cette commande ne vous est pas accessible';
    END IF;
    v_scope := v_vendor;
  END IF;

  SELECT c.id, c.full_name INTO v_id, v_name
  FROM public.couriers c
  WHERE c.user_id = auth.uid()
    AND c.vendor_id IS NOT DISTINCT FROM v_scope
  LIMIT 1;

  IF v_id IS NULL THEN
    SELECT COALESCE(NULLIF(BTRIM(p.full_name), ''), 'Moi')
      INTO v_name FROM public.profiles p WHERE p.id = auth.uid();

    INSERT INTO public.couriers AS c (vendor_id, user_id, full_name, created_by)
    VALUES (v_scope, auth.uid(), COALESCE(v_name, 'Moi'), auth.uid())
    RETURNING c.id, c.full_name INTO v_id, v_name;
  ELSE
    UPDATE public.couriers c SET is_active = TRUE
     WHERE c.id = v_id AND NOT c.is_active;
  END IF;

  UPDATE public.orders o
     SET courier_id = v_id, driver_id = auth.uid(), assigned_at = NOW()
   WHERE o.id = p_order_id;

  RETURN QUERY SELECT v_id, v_name::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.take_course(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.take_course(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  4. VUE DU SUIVI — `id` était lu sans préfixe alors qu'il est en sortie
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.delivery_view(p_order_id UUID)
RETURNS TABLE (
  id             UUID,
  order_number   TEXT,
  status         TEXT,
  created_at     TIMESTAMPTZ,
  total_amount   NUMERIC,
  payment_method TEXT,
  delivery_mode  TEXT,
  client_name    TEXT,
  client_phone   TEXT,
  client_address TEXT,
  client_lat     DOUBLE PRECISION,
  client_lng     DOUBLE PRECISION,
  pickup_lat     DOUBLE PRECISION,
  pickup_lng     DOUBLE PRECISION,
  pickup_label   TEXT,
  shop_name      TEXT,
  shop_phone     TEXT,
  vendor_id      UUID,
  driver_id      UUID,
  driver_name    TEXT,
  pickup_km      NUMERIC,
  dropoff_km     NUMERIC,
  pickup_fee     INTEGER,
  dropoff_fee    INTEGER,
  delivered_at   TIMESTAMPTZ,
  driver_phone   TEXT,
  viewer_role    TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role TEXT; v_vendor UUID; v_driver UUID; v_exists BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;

  SELECT TRUE, o.vendor_id, o.driver_id INTO v_exists, v_vendor, v_driver
  FROM public.orders o WHERE o.id = p_order_id;

  IF NOT COALESCE(v_exists, FALSE) THEN
    RAISE EXCEPTION 'Commande introuvable';
  END IF;

  v_role := CASE
    WHEN public.is_super_admin()                THEN 'admin'
    WHEN v_driver = auth.uid()                  THEN 'driver'
    WHEN v_vendor IS NOT NULL
         AND public.owns_vendor(v_vendor)       THEN 'vendor'
    ELSE NULL
  END;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Cette commande ne vous est pas accessible';
  END IF;

  RETURN QUERY
  SELECT o.id,
         o.order_number::TEXT, o.status::TEXT, o.created_at,
         o.total_amount::NUMERIC, o.payment_method::TEXT,
         COALESCE(o.delivery_mode, v.delivery_mode, 'self')::TEXT,
         o.client_name::TEXT, o.client_phone::TEXT, o.client_address::TEXT,
         o.client_lat, o.client_lng,
         COALESCE(o.pickup_lat, v.pickup_lat),
         COALESCE(o.pickup_lng, v.pickup_lng),
         v.pickup_label::TEXT, v.shop_name::TEXT, v.phone::TEXT,
         o.vendor_id, o.driver_id, p.full_name::TEXT,
         o.pickup_km::NUMERIC, o.dropoff_km::NUMERIC,
         o.pickup_fee::INTEGER, o.dropoff_fee::INTEGER,
         o.delivered_at, p.phone::TEXT,
         v_role
  FROM public.orders o
  LEFT JOIN public.vendors  v ON v.id = o.vendor_id
  LEFT JOIN public.profiles p ON p.id = o.driver_id
  WHERE o.id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_view(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.delivery_view(UUID) TO authenticated;
