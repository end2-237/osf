-- ════════════════════════════════════════════════════════════════════════════
--  BUYTICLE — SQL À APPLIQUER
--
--  Toutes les migrations en attente, dans l'ordre. À coller d'un seul bloc
--  dans Supabase → SQL Editor → Run.
--
--  Chaque bloc est idempotent ET rejouable dans n'importe quel ordre : les
--  fonctions qu'il redéfinit sont d'abord effacées, toutes signatures
--  confondues. Rejouer le fichier entier ne casse rien.
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
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
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
       AND p.proname IN ('admin_payouts', 'process_payout', 'vendor_balance')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;

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
       AND p.proname IN ('vendor_balance')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;

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
       AND p.proname IN ('delivery_feed', 'delivery_view', 'geo_km', 'quote_delivery', 'stamp_delivered_at')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;

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
       AND p.proname IN ('quote_delivery')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;

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
       AND p.proname IN ('assign_courier', 'assignable_couriers', 'delivery_feed', 'start_course', 'take_course')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;

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
       AND p.proname IN ('assign_courier', 'delivery_view', 'start_course', 'take_course')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;

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


-- ═══════════════════════════════════════════════════════════════════════
--  20260819_terminer_la_course
-- ═══════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
--  TERMINER UNE COURSE
--
--  Démarrer ne suffisait pas : une course a trois moments, et chacun change ce
--  qu'il reste à faire.
--    1. PARTIR   — le livreur quitte sa position, cap sur la boutique ;
--    2. RÉCUPÉRER — il a le colis en main, le premier trajet est derrière lui ;
--    3. LIVRER   — le client a reçu, la course est close.
--
--  Une seule fonction porte les trois pas, donc un seul jeu de règles d'accès
--  et un seul endroit où l'ordre est vérifié : on ne livre pas un colis qu'on
--  n'a pas récupéré, et on ne rouvre pas une course close.
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
       AND p.proname IN ('advance_course', 'delivery_feed')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.picked_up_at IS
  'Quand le livreur a pris le colis à la boutique. Sépare les deux trajets.';

-- ════════════════════════════════════════════════════════════════════════════
--  AVANCER D'UN PAS
--
--  p_step : 'start' | 'pickup' | 'finish'
--  Renvoie l'état complet de la course, pour que l'écran n'ait pas à deviner.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.advance_course(
  p_order_id UUID,
  p_step     TEXT,
  p_lat      DOUBLE PRECISION DEFAULT NULL,
  p_lng      DOUBLE PRECISION DEFAULT NULL
)
RETURNS TABLE (
  status            TEXT,
  course_started_at TIMESTAMPTZ,
  picked_up_at      TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  origin_lat        DOUBLE PRECISION,
  origin_lng        DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor  UUID; v_courier UUID; v_cuser UUID;
  v_started TIMESTAMPTZ; v_picked TIMESTAMPTZ; v_status TEXT;
  v_lat DOUBLE PRECISION; v_lng DOUBLE PRECISION; r public.delivery_rates;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  IF p_step NOT IN ('start', 'pickup', 'finish') THEN
    RAISE EXCEPTION 'Étape inconnue : %', p_step;
  END IF;

  SELECT o.vendor_id, o.courier_id, o.course_started_at, o.picked_up_at, o.status
    INTO v_vendor, v_courier, v_started, v_picked, v_status
  FROM public.orders o WHERE o.id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;

  SELECT c.user_id INTO v_cuser FROM public.couriers c WHERE c.id = v_courier;

  -- Trois personnes peuvent faire avancer une course : celui qui la porte,
  -- la boutique concernée, et l'admin.
  IF NOT (public.is_super_admin()
          OR public.owns_vendor(v_vendor)
          OR v_cuser = auth.uid()) THEN
    RAISE EXCEPTION 'Cette course ne vous est pas accessible';
  END IF;

  IF v_status IN ('cancelled', 'payment_failed') THEN
    RAISE EXCEPTION 'Cette commande est annulée';
  END IF;
  IF v_status = 'delivered' THEN
    RAISE EXCEPTION 'Cette course est déjà terminée';
  END IF;
  IF v_courier IS NULL THEN
    RAISE EXCEPTION 'Attribue d''abord la course à un livreur';
  END IF;

  -- L'ordre des pas est vérifié ici, pas dans l'écran : un colis se récupère
  -- avant d'être livré, quelle que soit la façon dont l'appel arrive.
  IF p_step IN ('pickup', 'finish') AND v_started IS NULL THEN
    RAISE EXCEPTION 'La course n''a pas encore démarré';
  END IF;
  IF p_step = 'finish' AND v_picked IS NULL THEN
    RAISE EXCEPTION 'Marque d''abord le colis comme récupéré';
  END IF;

  IF p_step = 'start' THEN
    SELECT * INTO r FROM public.delivery_rates WHERE id;
    v_lat := COALESCE(p_lat, r.hub_lat);
    v_lng := COALESCE(p_lng, r.hub_lng);

    UPDATE public.orders o
       SET course_started_at = COALESCE(o.course_started_at, NOW()),
           origin_lat        = COALESCE(o.origin_lat, v_lat),
           origin_lng        = COALESCE(o.origin_lng, v_lng),
           status            = 'in_transit'
     WHERE o.id = p_order_id;

  ELSIF p_step = 'pickup' THEN
    UPDATE public.orders o
       SET picked_up_at = COALESCE(o.picked_up_at, NOW()),
           status       = 'in_transit'
     WHERE o.id = p_order_id;

  ELSE   -- finish
    -- `delivered_at` est posé par le déclencheur `orders_stamp_delivered`.
    UPDATE public.orders o
       SET status = 'delivered'
     WHERE o.id = p_order_id;
  END IF;

  RETURN QUERY
  SELECT o.status::TEXT, o.course_started_at, o.picked_up_at, o.delivered_at,
         o.origin_lat, o.origin_lng
  FROM public.orders o WHERE o.id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_course(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) FROM anon;
GRANT EXECUTE ON FUNCTION public.advance_course(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  LE FLUX EXPOSE L'ÉTAPE DE RAMASSE
-- ════════════════════════════════════════════════════════════════════════════

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
  picked_up_at      TIMESTAMPTZ,
  origin_lat        DOUBLE PRECISION,
  origin_lng        DOUBLE PRECISION,
  client_phone      TEXT,
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
         o.course_started_at, o.picked_up_at, o.origin_lat, o.origin_lng,
         o.client_phone::TEXT,
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


-- ═══════════════════════════════════════════════════════════════════════
--  20260820_confirmation_avis_retours
-- ═══════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
--  CONFIRMATION DE RÉCEPTION, AVIS VÉRIFIÉS, RETOURS
--
--  LE PROBLÈME : rien n'empêchait une boutique de marquer « livré » sans avoir
--  livré. L'argent tombait dans son solde, et le client n'avait que ses yeux
--  pour pleurer.
--
--  LA RÉPONSE : le clic « livré » ne libère plus rien. Il ouvre une fenêtre.
--
--      livré  ──┬─→ le client confirme          → libéré tout de suite
--               ├─→ 48 h passent sans rien      → libéré automatiquement
--               └─→ le client demande un retour → gelé jusqu'à arbitrage
--
--  Tant que l'argent est retenu, il apparaît au vendeur en « en attente de
--  confirmation » : il le voit, il ne peut pas le retirer. C'est la même
--  fenêtre de 48 h qui autorise le retour et qui retient les fonds — une seule
--  horloge, donc pas de cas où l'une expire sans l'autre.
--
--  Les avis suivent la même logique : seul l'acheteur d'une commande livrée
--  peut noter, une seule fois, le produit ET la boutique. Un avis qui ne se
--  rattache à aucune commande n'existe pas.
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
       AND p.proname IN ('admin_returns', 'confirm_delivery', 'my_delivered_orders', 'order_funds_state', 'request_return', 'resolve_return', 'submit_order_reviews', 'vendor_balance')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;


-- ════════════════════════════════════════════════════════════════════════════
--  1. LES DÉLAIS, EN UN SEUL ENDROIT
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.platform_policy (
  id                  BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  -- Fenêtre pendant laquelle le client peut demander un retour…
  return_window_hours INTEGER NOT NULL DEFAULT 48,
  -- …et pendant laquelle l'argent reste retenu. Les deux vont ensemble.
  funds_hold_hours    INTEGER NOT NULL DEFAULT 48,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.platform_policy (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_policy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_policy_read  ON public.platform_policy;
DROP POLICY IF EXISTS platform_policy_write ON public.platform_policy;
CREATE POLICY platform_policy_read  ON public.platform_policy FOR SELECT USING (TRUE);
CREATE POLICY platform_policy_write ON public.platform_policy FOR ALL
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════════
--  2. CE QUE LA COMMANDE RETIENT
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS client_confirmed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS funds_released_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_status        TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS return_reason        TEXT,
  ADD COLUMN IF NOT EXISTS return_requested_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_resolved_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_note          TEXT;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_return_status_valid;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_return_status_valid
  CHECK (return_status IN ('none', 'requested', 'approved', 'rejected', 'returned'));

CREATE INDEX IF NOT EXISTS orders_return_open_idx ON public.orders(vendor_id)
  WHERE return_status = 'requested';

COMMENT ON COLUMN public.orders.funds_released_at IS
  'Quand l''argent est passé de « retenu » à « dû au vendeur ». NULL tant que '
  'le client n''a pas confirmé et que la fenêtre n''est pas écoulée.';

-- ════════════════════════════════════════════════════════════════════════════
--  3. AVIS SUR LA BOUTIQUE
--     Les avis produit vivent déjà dans `reviews`. Ceux qui portent sur la
--     boutique elle-même — le service, l'emballage, le délai — méritent leur
--     table : ils ne parlent pas de la même chose.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.vendor_reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id  UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  order_id   UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name  TEXT,
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text       TEXT,
  approved   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Une commande, un avis boutique. C'est ce qui rend l'avis vérifiable.
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS vendor_reviews_vendor_idx ON public.vendor_reviews(vendor_id);

ALTER TABLE public.vendor_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vendor_reviews_read   ON public.vendor_reviews;
DROP POLICY IF EXISTS vendor_reviews_admin  ON public.vendor_reviews;

-- Publics : c'est le but d'un avis.
CREATE POLICY vendor_reviews_read ON public.vendor_reviews
  FOR SELECT USING (approved OR user_id = auth.uid() OR public.is_super_admin());

-- L'écriture passe uniquement par `submit_order_reviews` : personne ne dépose
-- un avis sans commande livrée derrière.
CREATE POLICY vendor_reviews_admin ON public.vendor_reviews
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════════
--  4. L'ARGENT EST-IL LIBÉRÉ ?
--
--  Une seule fonction répond, et tout le reste s'y réfère : le solde, l'écran
--  vendeur, l'admin. Trois états, jamais d'ambiguïté.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.order_funds_state(p_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE o public.orders; v_hold INTEGER;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN 'unknown'; END IF;
  SELECT pp.funds_hold_hours INTO v_hold FROM public.platform_policy pp WHERE pp.id;

  IF o.status <> 'delivered'                          THEN RETURN 'pending';  END IF;
  IF o.return_status IN ('requested', 'approved',
                         'returned')                  THEN RETURN 'frozen';   END IF;
  IF o.funds_released_at IS NOT NULL
     OR o.client_confirmed_at IS NOT NULL             THEN RETURN 'released'; END IF;
  IF o.delivered_at IS NOT NULL
     AND o.delivered_at + (v_hold || ' hours')::INTERVAL <= NOW()
                                                      THEN RETURN 'released'; END IF;
  RETURN 'held';
END;
$$;

GRANT EXECUTE ON FUNCTION public.order_funds_state(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  5. LE SOLDE — ne compte que ce qui est libéré
--
--  Changement de fond : auparavant une commande payée en ligne alimentait le
--  solde dès l'encaissement, avant toute livraison. Ce n'est plus le cas.
--  Rien n'est dû tant que la réception n'est pas acquise.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.vendor_balance(p_vendor_id UUID)
RETURNS TABLE (collected BIGINT, withdrawn BIGINT, pending BIGINT,
               available BIGINT, held BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_collected BIGINT; v_withdrawn BIGINT; v_pending BIGINT;
  v_held BIGINT; v_mode TEXT; v_hold INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = p_vendor_id AND v.user_id = auth.uid()
  ) AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT COALESCE(delivery_mode, 'self') INTO v_mode
  FROM public.vendors WHERE id = p_vendor_id;
  SELECT pp.funds_hold_hours INTO v_hold FROM public.platform_policy pp WHERE pp.id;

  -- Ce que la plateforme détient pour cette boutique, livraison comprise
  -- quand la boutique livre elle-même et que le paiement est passé en ligne.
  WITH dus AS (
    SELECT o.id,
           o.total_amount
             + CASE WHEN v_mode = 'self' THEN COALESCE(o.delivery_fee, 0) ELSE 0 END
             AS montant,
           -- L'argent n'est entre nos mains que dans ces deux cas.
           (o.payment_method IN ('orange_money', 'mtn_momo')
            OR v_mode = 'buyticle') AS encaisse_par_nous,
           o.status, o.return_status, o.delivered_at,
           o.funds_released_at, o.client_confirmed_at
    FROM public.orders o
    WHERE o.vendor_id = p_vendor_id
  ), etats AS (
    SELECT montant,
           CASE
             WHEN NOT encaisse_par_nous              THEN 'hors'
             WHEN status <> 'delivered'              THEN 'attente'
             WHEN return_status IN ('requested', 'approved', 'returned') THEN 'gele'
             WHEN funds_released_at IS NOT NULL
               OR client_confirmed_at IS NOT NULL    THEN 'libere'
             WHEN delivered_at IS NOT NULL
              AND delivered_at + (v_hold || ' hours')::INTERVAL <= NOW()
                                                     THEN 'libere'
             ELSE 'retenu'
           END AS etat
    FROM dus
  )
  SELECT COALESCE(SUM(montant) FILTER (WHERE etat = 'libere'), 0),
         COALESCE(SUM(montant) FILTER (WHERE etat IN ('retenu', 'gele')), 0)
    INTO v_collected, v_held
  FROM etats;

  SELECT COALESCE(SUM(amount), 0) INTO v_withdrawn
  FROM public.vendor_payouts
  WHERE vendor_id = p_vendor_id AND status = 'paid';

  SELECT COALESCE(SUM(amount), 0) INTO v_pending
  FROM public.vendor_payouts
  WHERE vendor_id = p_vendor_id AND status IN ('pending', 'processing');

  RETURN QUERY SELECT v_collected, v_withdrawn, v_pending,
                      GREATEST(v_collected - v_withdrawn - v_pending, 0),
                      v_held;
END;
$$;

COMMENT ON FUNCTION public.vendor_balance(UUID) IS
  'Ne compte que l''argent libéré : commande livrée, puis confirmée par le '
  'client ou fenêtre de rétention écoulée sans litige. Aucune commission.';

-- ════════════════════════════════════════════════════════════════════════════
--  6. LE CLIENT CONFIRME
--     Raccourci volontaire : confirmer libère l'argent immédiatement et ferme
--     la fenêtre de retour. On le dit clairement dans l'écran.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.confirm_delivery(p_order_id UUID)
RETURNS TABLE (confirmed_at TIMESTAMPTZ, funds_state TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user UUID; v_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  SELECT o.user_id, o.status INTO v_user, v_status
  FROM public.orders o WHERE o.id = p_order_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_user IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cette commande n''est pas la vôtre';
  END IF;
  IF v_status <> 'delivered' THEN
    RAISE EXCEPTION 'Cette commande n''est pas encore marquée livrée';
  END IF;

  UPDATE public.orders o
     SET client_confirmed_at = COALESCE(o.client_confirmed_at, NOW()),
         funds_released_at   = COALESCE(o.funds_released_at, NOW())
   WHERE o.id = p_order_id;

  RETURN QUERY
  SELECT o.client_confirmed_at, public.order_funds_state(p_order_id)
  FROM public.orders o WHERE o.id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_delivery(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_delivery(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  7. LE CLIENT DEMANDE UN RETOUR
--     Dans la fenêtre, et une seule fois. La demande gèle l'argent : c'est
--     précisément ce qui donne du poids à la réclamation.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.request_return(p_order_id UUID, p_reason TEXT)
RETURNS TABLE (return_status TEXT, deadline TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID; v_status TEXT; v_delivered TIMESTAMPTZ;
  v_ret TEXT; v_window INTEGER; v_deadline TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF COALESCE(BTRIM(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Explique la raison du retour';
  END IF;

  SELECT o.user_id, o.status, o.delivered_at, o.return_status
    INTO v_user, v_status, v_delivered, v_ret
  FROM public.orders o WHERE o.id = p_order_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_user IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cette commande n''est pas la vôtre';
  END IF;
  IF v_status <> 'delivered' THEN
    RAISE EXCEPTION 'Le retour n''est possible qu''une fois la commande livrée';
  END IF;
  IF v_ret <> 'none' THEN
    RAISE EXCEPTION 'Une demande de retour existe déjà pour cette commande';
  END IF;

  SELECT pp.return_window_hours INTO v_window FROM public.platform_policy pp WHERE pp.id;
  v_deadline := COALESCE(v_delivered, NOW()) + (v_window || ' hours')::INTERVAL;

  IF NOW() > v_deadline THEN
    RAISE EXCEPTION 'Le délai de % h est dépassé : le retour n''est plus possible', v_window;
  END IF;

  -- Confirmer puis se raviser n'est pas possible : la confirmation vaut solde
  -- de tout compte, et l'argent est déjà parti.
  IF EXISTS (SELECT 1 FROM public.orders o
              WHERE o.id = p_order_id AND o.client_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Tu as déjà confirmé la bonne réception de cette commande';
  END IF;

  UPDATE public.orders o
     SET return_status       = 'requested',
         return_reason       = BTRIM(p_reason),
         return_requested_at = NOW(),
         funds_released_at   = NULL      -- l'argent est regelé
   WHERE o.id = p_order_id;

  RETURN QUERY SELECT 'requested'::TEXT, v_deadline;
END;
$$;

REVOKE ALL ON FUNCTION public.request_return(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_return(UUID, TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  8. L'ADMIN ARBITRE
--     'approved'  → le client a raison : l'argent reste gelé, à rembourser.
--     'rejected'  → la boutique a raison : l'argent est libéré.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.resolve_return(
  p_order_id UUID,
  p_decision TEXT,
  p_note     TEXT DEFAULT NULL
)
RETURNS TABLE (return_status TEXT, funds_state TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_ret TEXT;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  IF p_decision NOT IN ('approved', 'rejected', 'returned') THEN
    RAISE EXCEPTION 'Décision invalide';
  END IF;

  SELECT o.return_status INTO v_ret FROM public.orders o WHERE o.id = p_order_id;
  IF v_ret IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_ret = 'none' THEN RAISE EXCEPTION 'Aucune demande de retour sur cette commande'; END IF;

  UPDATE public.orders o
     SET return_status      = p_decision,
         return_note        = COALESCE(NULLIF(BTRIM(p_note), ''), o.return_note),
         return_resolved_at = NOW(),
         -- Retour refusé : la boutique est payée. Sinon l'argent reste gelé.
         funds_released_at  = CASE WHEN p_decision = 'rejected' THEN NOW() ELSE NULL END
   WHERE o.id = p_order_id;

  RETURN QUERY SELECT p_decision, public.order_funds_state(p_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_return(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_return(UUID, TEXT, TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  9. LES AVIS — produit ET boutique, en un seul geste
--
--  p_items : [{ "product_id": "…", "rating": 5, "text": "…" }, …]
--  Seul l'acheteur d'une commande livrée écrit, et une seule fois.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.submit_order_reviews(
  p_order_id    UUID,
  p_shop_rating SMALLINT,
  p_shop_text   TEXT DEFAULT NULL,
  p_items       JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE (product_reviews INTEGER, shop_review BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID; v_status TEXT; v_vendor UUID; v_name TEXT;
  v_item JSONB; v_pid UUID; v_rating SMALLINT; v_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  SELECT o.user_id, o.status, o.vendor_id, o.client_name
    INTO v_user, v_status, v_vendor, v_name
  FROM public.orders o WHERE o.id = p_order_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_user IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cette commande n''est pas la vôtre';
  END IF;
  IF v_status <> 'delivered' THEN
    RAISE EXCEPTION 'On ne note qu''une commande reçue';
  END IF;
  IF EXISTS (SELECT 1 FROM public.orders o
              WHERE o.id = p_order_id AND o.reviewed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Tu as déjà donné ton avis sur cette commande';
  END IF;
  IF p_shop_rating IS NULL OR p_shop_rating NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Note la boutique de 1 à 5';
  END IF;

  SELECT COALESCE(NULLIF(BTRIM(p.full_name), ''), v_name, 'Client')
    INTO v_name FROM public.profiles p WHERE p.id = auth.uid();

  -- Avis produit : uniquement sur ce qui a été acheté dans CETTE commande.
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::JSONB))
  LOOP
    v_pid    := (v_item ->> 'product_id')::UUID;
    v_rating := (v_item ->> 'rating')::SMALLINT;
    CONTINUE WHEN v_pid IS NULL OR v_rating IS NULL OR v_rating NOT BETWEEN 1 AND 5;

    IF NOT EXISTS (SELECT 1 FROM public.order_items oi
                    WHERE oi.order_id = p_order_id AND oi.product_id = v_pid) THEN
      CONTINUE;   -- pas dans la commande : on ignore plutôt que de refuser tout
    END IF;

    INSERT INTO public.reviews (product_id, user_id, user_name, rating, text, approved)
    VALUES (v_pid, auth.uid(), v_name, v_rating,
            NULLIF(BTRIM(v_item ->> 'text'), ''), TRUE)
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  IF v_vendor IS NOT NULL THEN
    INSERT INTO public.vendor_reviews (vendor_id, order_id, user_id, user_name, rating, text)
    VALUES (v_vendor, p_order_id, auth.uid(), v_name, p_shop_rating,
            NULLIF(BTRIM(p_shop_text), ''))
    ON CONFLICT (order_id) DO NOTHING;
  END IF;

  UPDATE public.orders o SET reviewed_at = NOW() WHERE o.id = p_order_id;

  RETURN QUERY SELECT v_count, v_vendor IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_order_reviews(UUID, SMALLINT, TEXT, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_order_reviews(UUID, SMALLINT, TEXT, JSONB) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  10. CE QUI ATTEND LE CLIENT
--      Alimente la fenêtre d'avis et les boutons de retour, sans exposer la
--      table des commandes.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.my_delivered_orders()
RETURNS TABLE (
  id              UUID,
  order_number    TEXT,
  shop_name       TEXT,
  vendor_id       UUID,
  total_amount    NUMERIC,
  delivered_at    TIMESTAMPTZ,
  reviewed_at     TIMESTAMPTZ,
  confirmed_at    TIMESTAMPTZ,
  return_status   TEXT,
  return_reason   TEXT,
  return_deadline TIMESTAMPTZ,
  can_return      BOOLEAN,
  items           JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_window INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  SELECT pp.return_window_hours INTO v_window FROM public.platform_policy pp WHERE pp.id;

  RETURN QUERY
  SELECT o.id, o.order_number::TEXT, v.shop_name::TEXT, o.vendor_id,
         o.total_amount::NUMERIC, o.delivered_at, o.reviewed_at,
         o.client_confirmed_at, o.return_status::TEXT, o.return_reason::TEXT,
         COALESCE(o.delivered_at, o.created_at) + (v_window || ' hours')::INTERVAL,
         (o.return_status = 'none'
          AND o.client_confirmed_at IS NULL
          AND COALESCE(o.delivered_at, o.created_at)
              + (v_window || ' hours')::INTERVAL > NOW()),
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
                    'product_id', oi.product_id,
                    'name',       oi.product_name,
                    'img',        oi.product_img,
                    'quantity',   oi.quantity))
           FROM public.order_items oi WHERE oi.order_id = o.id
         ), '[]'::JSONB)
  FROM public.orders o
  LEFT JOIN public.vendors v ON v.id = o.vendor_id
  WHERE o.user_id = auth.uid() AND o.status = 'delivered'
  ORDER BY o.delivered_at DESC NULLS LAST
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.my_delivered_orders() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_delivered_orders() TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  11. LES RETOURS VUS DE L'ADMIN
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_returns(p_status TEXT DEFAULT 'requested')
RETURNS TABLE (
  id            UUID,
  order_number  TEXT,
  shop_name     TEXT,
  vendor_id     UUID,
  client_name   TEXT,
  client_phone  TEXT,
  total_amount  NUMERIC,
  delivered_at  TIMESTAMPTZ,
  requested_at  TIMESTAMPTZ,
  resolved_at   TIMESTAMPTZ,
  return_status TEXT,
  return_reason TEXT,
  return_note   TEXT,
  funds_state   TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;

  RETURN QUERY
  SELECT o.id, o.order_number::TEXT, v.shop_name::TEXT, o.vendor_id,
         o.client_name::TEXT, o.client_phone::TEXT, o.total_amount::NUMERIC,
         o.delivered_at, o.return_requested_at, o.return_resolved_at,
         o.return_status::TEXT, o.return_reason::TEXT, o.return_note::TEXT,
         public.order_funds_state(o.id)
  FROM public.orders o
  LEFT JOIN public.vendors v ON v.id = o.vendor_id
  WHERE o.return_status <> 'none'
    AND (p_status IS NULL OR o.return_status = p_status)
  ORDER BY o.return_requested_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_returns(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_returns(TEXT) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════
--  20260821_preuve_de_remise
-- ═══════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
--  PREUVE DE REMISE — le code de livraison
--
--  La rétention de 48 h protège le client d'un vendeur qui marque « livré »
--  sans livrer. Elle ne protège personne dans l'autre sens : un client qui a
--  bien reçu peut affirmer le contraire, geler l'argent, et c'est la parole de
--  l'un contre celle de l'autre.
--
--  Un code règle ça. Quatre chiffres, générés au départ de la course, connus
--  du seul client. Le livreur ne peut clore qu'en les saisissant.
--
--      remise AVEC code  → la réception est PROUVÉE.
--                          « je n'ai rien reçu » devient irrecevable ;
--                          un défaut produit reste contestable.
--      remise SANS code  → la réception n'est pas prouvée.
--                          En cas de litige, le doute profite au client.
--
--  Le code ne raccourcit pas la fenêtre de 48 h : il tranche la question
--  « ai-je reçu ? », pas la question « le produit est-il conforme ? ». Les
--  deux sont distinctes et méritent chacune leur réponse.
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
       AND p.proname IN ('admin_returns', 'advance_course', 'ensure_delivery_code', 'my_active_deliveries', 'my_delivered_orders', 'request_return')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;


ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_code    TEXT,
  ADD COLUMN IF NOT EXISTS code_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_proof   TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS return_kind      TEXT;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_proof_valid;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_proof_valid
  CHECK (delivery_proof IN ('none', 'code'));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_return_kind_valid;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_return_kind_valid
  CHECK (return_kind IS NULL
         OR return_kind IN ('not_received', 'damaged', 'wrong_item', 'other'));

COMMENT ON COLUMN public.orders.delivery_proof IS
  'code = le livreur a saisi le code du client, la réception est prouvée. '
  'none = remise non prouvée, le doute profite au client en cas de litige.';

-- ════════════════════════════════════════════════════════════════════════════
--  LE CODE
--  Quatre chiffres suffisent : il faut le deviner en une tentative, devant
--  quelqu'un qui a le colis en main. Un tirage plus long ne se retient pas.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ensure_delivery_code(p_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_code TEXT;
BEGIN
  SELECT o.delivery_code INTO v_code FROM public.orders o WHERE o.id = p_order_id;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;

  v_code := LPAD((FLOOR(RANDOM() * 10000))::INT::TEXT, 4, '0');
  UPDATE public.orders o SET delivery_code = v_code WHERE o.id = p_order_id;
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_delivery_code(UUID) FROM anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  LE FIL DE LA COURSE, AVEC LE CODE À L'ARRIVÉE
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.advance_course(
  p_order_id UUID,
  p_step     TEXT,
  p_lat      DOUBLE PRECISION DEFAULT NULL,
  p_lng      DOUBLE PRECISION DEFAULT NULL,
  p_code     TEXT DEFAULT NULL
)
RETURNS TABLE (
  status            TEXT,
  course_started_at TIMESTAMPTZ,
  picked_up_at      TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  origin_lat        DOUBLE PRECISION,
  origin_lng        DOUBLE PRECISION,
  delivery_proof    TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor  UUID; v_courier UUID; v_cuser UUID;
  v_started TIMESTAMPTZ; v_picked TIMESTAMPTZ; v_status TEXT; v_code TEXT;
  v_lat DOUBLE PRECISION; v_lng DOUBLE PRECISION; r public.delivery_rates;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  IF p_step NOT IN ('start', 'pickup', 'finish') THEN
    RAISE EXCEPTION 'Étape inconnue : %', p_step;
  END IF;

  SELECT o.vendor_id, o.courier_id, o.course_started_at, o.picked_up_at,
         o.status, o.delivery_code
    INTO v_vendor, v_courier, v_started, v_picked, v_status, v_code
  FROM public.orders o WHERE o.id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;

  SELECT c.user_id INTO v_cuser FROM public.couriers c WHERE c.id = v_courier;

  IF NOT (public.is_super_admin()
          OR public.owns_vendor(v_vendor)
          OR v_cuser = auth.uid()) THEN
    RAISE EXCEPTION 'Cette course ne vous est pas accessible';
  END IF;

  IF v_status IN ('cancelled', 'payment_failed') THEN
    RAISE EXCEPTION 'Cette commande est annulée';
  END IF;
  IF v_status = 'delivered' THEN
    RAISE EXCEPTION 'Cette course est déjà terminée';
  END IF;
  IF v_courier IS NULL THEN
    RAISE EXCEPTION 'Attribue d''abord la course à un livreur';
  END IF;
  IF p_step IN ('pickup', 'finish') AND v_started IS NULL THEN
    RAISE EXCEPTION 'La course n''a pas encore démarré';
  END IF;
  IF p_step = 'finish' AND v_picked IS NULL THEN
    RAISE EXCEPTION 'Marque d''abord le colis comme récupéré';
  END IF;

  IF p_step = 'start' THEN
    SELECT * INTO r FROM public.delivery_rates dr WHERE dr.id;
    v_lat := COALESCE(p_lat, r.hub_lat);
    v_lng := COALESCE(p_lng, r.hub_lng);
    PERFORM public.ensure_delivery_code(p_order_id);

    UPDATE public.orders o
       SET course_started_at = COALESCE(o.course_started_at, NOW()),
           origin_lat        = COALESCE(o.origin_lat, v_lat),
           origin_lng        = COALESCE(o.origin_lng, v_lng),
           status            = 'in_transit'
     WHERE o.id = p_order_id;

  ELSIF p_step = 'pickup' THEN
    UPDATE public.orders o
       SET picked_up_at = COALESCE(o.picked_up_at, NOW()),
           status       = 'in_transit'
     WHERE o.id = p_order_id;

  ELSE
    -- Un code saisi doit être le bon. Un code absent est permis — le client
    -- peut être injoignable — mais la remise n'est alors pas prouvée, et le
    -- livreur en assume la conséquence en cas de litige.
    IF p_code IS NOT NULL AND BTRIM(p_code) <> '' THEN
      IF v_code IS NULL OR BTRIM(p_code) <> v_code THEN
        RAISE EXCEPTION 'Code incorrect. Demande au client le code affiché dans son suivi.';
      END IF;
      UPDATE public.orders o
         SET status = 'delivered', code_verified_at = NOW(), delivery_proof = 'code'
       WHERE o.id = p_order_id;
    ELSE
      UPDATE public.orders o
         SET status = 'delivered', delivery_proof = 'none'
       WHERE o.id = p_order_id;
    END IF;
  END IF;

  RETURN QUERY
  SELECT o.status::TEXT, o.course_started_at, o.picked_up_at, o.delivered_at,
         o.origin_lat, o.origin_lng, o.delivery_proof::TEXT
  FROM public.orders o WHERE o.id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_course(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.advance_course(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  LE RETOUR, AVEC SA NATURE
--
--  « Jamais reçu » n'est pas « produit cassé ». La première affirmation est
--  vérifiable, la seconde ne l'est pas. On les sépare, et on refuse la
--  première quand le code a été saisi.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.request_return(
  p_order_id UUID,
  p_reason   TEXT,
  p_kind     TEXT DEFAULT 'other'
)
RETURNS TABLE (return_status TEXT, deadline TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID; v_status TEXT; v_delivered TIMESTAMPTZ;
  v_ret TEXT; v_window INTEGER; v_deadline TIMESTAMPTZ;
  v_verified TIMESTAMPTZ; v_confirmed TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF COALESCE(BTRIM(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Explique la raison du retour';
  END IF;
  IF COALESCE(p_kind, 'other') NOT IN ('not_received', 'damaged', 'wrong_item', 'other') THEN
    RAISE EXCEPTION 'Motif inconnu';
  END IF;

  SELECT o.user_id, o.status, o.delivered_at, o.return_status,
         o.code_verified_at, o.client_confirmed_at
    INTO v_user, v_status, v_delivered, v_ret, v_verified, v_confirmed
  FROM public.orders o WHERE o.id = p_order_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_user IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cette commande n''est pas la vôtre';
  END IF;
  IF v_status <> 'delivered' THEN
    RAISE EXCEPTION 'Le retour n''est possible qu''une fois la commande livrée';
  END IF;
  IF v_ret <> 'none' THEN
    RAISE EXCEPTION 'Une demande de retour existe déjà pour cette commande';
  END IF;
  IF v_confirmed IS NOT NULL THEN
    RAISE EXCEPTION 'Tu as déjà confirmé la bonne réception de cette commande';
  END IF;

  -- Le code n'a pu être saisi que par quelqu'un qui l'avait en main.
  IF p_kind = 'not_received' AND v_verified IS NOT NULL THEN
    RAISE EXCEPTION 'Le code de livraison a été saisi lors de la remise : la réception est établie. Choisis le motif qui correspond au problème réel.';
  END IF;

  SELECT pp.return_window_hours INTO v_window FROM public.platform_policy pp WHERE pp.id;
  v_deadline := COALESCE(v_delivered, NOW()) + (v_window || ' hours')::INTERVAL;
  IF NOW() > v_deadline THEN
    RAISE EXCEPTION 'Le délai de % h est dépassé : le retour n''est plus possible', v_window;
  END IF;

  UPDATE public.orders o
     SET return_status       = 'requested',
         return_kind         = COALESCE(p_kind, 'other'),
         return_reason       = BTRIM(p_reason),
         return_requested_at = NOW(),
         funds_released_at   = NULL
   WHERE o.id = p_order_id;

  RETURN QUERY SELECT 'requested'::TEXT, v_deadline;
END;
$$;

REVOKE ALL ON FUNCTION public.request_return(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_return(UUID, TEXT, TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  CE QUE LE CLIENT DOIT AVOIR SOUS LES YEUX
--  Son code, et rien d'autre : il le lit au livreur au moment de la remise.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.my_active_deliveries()
RETURNS TABLE (
  id            UUID,
  order_number  TEXT,
  shop_name     TEXT,
  status        TEXT,
  total_amount  NUMERIC,
  delivery_code TEXT,
  started_at    TIMESTAMPTZ,
  picked_up_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  RETURN QUERY
  SELECT o.id, o.order_number::TEXT, v.shop_name::TEXT, o.status::TEXT,
         o.total_amount::NUMERIC, o.delivery_code::TEXT,
         o.course_started_at, o.picked_up_at
  FROM public.orders o
  LEFT JOIN public.vendors v ON v.id = o.vendor_id
  WHERE o.user_id = auth.uid()
    AND o.status NOT IN ('delivered', 'cancelled', 'payment_failed')
    AND o.delivery_code IS NOT NULL
  ORDER BY o.created_at DESC
  LIMIT 20;
END;
$$;

REVOKE ALL ON FUNCTION public.my_active_deliveries() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_active_deliveries() TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  L'ARBITRAGE, AVEC LES FAITS
--
--  L'admin ne tranche pas au feeling : il voit si le code a été saisi, et
--  combien de litiges ce client a déjà ouverts. Un premier litige et un
--  dixième ne se lisent pas de la même façon.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_returns(p_status TEXT DEFAULT 'requested')
RETURNS TABLE (
  id              UUID,
  order_number    TEXT,
  shop_name       TEXT,
  vendor_id       UUID,
  client_name     TEXT,
  client_phone    TEXT,
  total_amount    NUMERIC,
  delivered_at    TIMESTAMPTZ,
  requested_at    TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  return_status   TEXT,
  return_kind     TEXT,
  return_reason   TEXT,
  return_note     TEXT,
  funds_state     TEXT,
  delivery_proof  TEXT,
  client_disputes INTEGER,   -- litiges ouverts par ce client, tous vendeurs
  client_rejected INTEGER,   -- …dont combien ont été jugés infondés
  vendor_disputes INTEGER    -- litiges subis par cette boutique
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;

  RETURN QUERY
  SELECT o.id, o.order_number::TEXT, v.shop_name::TEXT, o.vendor_id,
         o.client_name::TEXT, o.client_phone::TEXT, o.total_amount::NUMERIC,
         o.delivered_at, o.return_requested_at, o.return_resolved_at,
         o.return_status::TEXT, o.return_kind::TEXT,
         o.return_reason::TEXT, o.return_note::TEXT,
         public.order_funds_state(o.id), o.delivery_proof::TEXT,
         (SELECT COUNT(*) FROM public.orders x
           WHERE x.user_id = o.user_id AND x.return_status <> 'none')::INTEGER,
         (SELECT COUNT(*) FROM public.orders x
           WHERE x.user_id = o.user_id AND x.return_status = 'rejected')::INTEGER,
         (SELECT COUNT(*) FROM public.orders x
           WHERE x.vendor_id = o.vendor_id AND x.return_status <> 'none')::INTEGER
  FROM public.orders o
  LEFT JOIN public.vendors v ON v.id = o.vendor_id
  WHERE o.return_status <> 'none'
    AND (p_status IS NULL OR o.return_status = p_status)
  ORDER BY o.return_requested_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_returns(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_returns(TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  LE PROFIL DU CLIENT EXPOSE LA PREUVE
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.my_delivered_orders()
RETURNS TABLE (
  id              UUID,
  order_number    TEXT,
  shop_name       TEXT,
  vendor_id       UUID,
  total_amount    NUMERIC,
  delivered_at    TIMESTAMPTZ,
  reviewed_at     TIMESTAMPTZ,
  confirmed_at    TIMESTAMPTZ,
  return_status   TEXT,
  return_reason   TEXT,
  return_deadline TIMESTAMPTZ,
  can_return      BOOLEAN,
  delivery_proof  TEXT,
  items           JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_window INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  SELECT pp.return_window_hours INTO v_window FROM public.platform_policy pp WHERE pp.id;

  RETURN QUERY
  SELECT o.id, o.order_number::TEXT, v.shop_name::TEXT, o.vendor_id,
         o.total_amount::NUMERIC, o.delivered_at, o.reviewed_at,
         o.client_confirmed_at, o.return_status::TEXT, o.return_reason::TEXT,
         COALESCE(o.delivered_at, o.created_at) + (v_window || ' hours')::INTERVAL,
         (o.return_status = 'none'
          AND o.client_confirmed_at IS NULL
          AND COALESCE(o.delivered_at, o.created_at)
              + (v_window || ' hours')::INTERVAL > NOW()),
         o.delivery_proof::TEXT,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
                    'product_id', oi.product_id,
                    'name',       oi.product_name,
                    'img',        oi.product_img,
                    'quantity',   oi.quantity))
           FROM public.order_items oi WHERE oi.order_id = o.id
         ), '[]'::JSONB)
  FROM public.orders o
  LEFT JOIN public.vendors v ON v.id = o.vendor_id
  WHERE o.user_id = auth.uid() AND o.status = 'delivered'
  ORDER BY o.delivered_at DESC NULLS LAST
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.my_delivered_orders() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_delivered_orders() TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════
--  20260822_livreurs_kyc_et_fiche_de_remise
-- ═══════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
--  DOSSIER LIVREUR (KYC) & FICHE DE REMISE
--
--  1. UN LIVREUR N'EST PLUS UNE SIMPLE LIGNE DE CARNET
--     Quelqu'un à qui on confie des colis et parfois du cash mérite un
--     dossier : pièce d'identité recto-verso, photo du visage, véhicule.
--     Le dossier est déposé par le candidat, examiné par un admin, et ce
--     n'est qu'à l'approbation que la fiche livreur est créée.
--
--  2. LE CAS DU CLIENT QUI NE PEUT PAS VALIDER
--     Le code de livraison suppose un client qui a son téléphone, du réseau,
--     et son compte sous la main. Ça ne couvre pas tout : téléphone déchargé,
--     commande reçue par un voisin, client qui ne sait pas lire un écran.
--     La fiche de remise prend le relais — nom, pièce d'identité, signature,
--     photo du colis remis — et vaut preuve au même titre que le code.
--
--         proof = 'code'  → code saisi par le client
--         proof = 'slip'  → fiche signée avec pièce d'identité et photo
--         proof = 'none'  → rien : le doute profite au client
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
       AND p.proname IN ('admin_courier_applications', 'admin_pending_proofs', 'admin_release_funds', 'admin_returns', 'advance_course', 'approve_courier_application', 'reject_courier_application', 'request_return')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;


-- ════════════════════════════════════════════════════════════════════════════
--  1. DOSSIER DE CANDIDATURE LIVREUR
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.courier_applications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- NULL = candidature chez Buyticle. Sinon, livreur d'une boutique précise.
  vendor_id     UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  phone         TEXT NOT NULL,
  email         TEXT,
  city          TEXT DEFAULT 'Douala',
  vehicle_type  TEXT,                     -- moto | voiture | tricycle | velo | pieds
  vehicle_plate TEXT,
  id_type       TEXT,                     -- cni | passeport | permis
  id_number     TEXT,
  id_front_url  TEXT,
  id_back_url   TEXT,
  selfie_url    TEXT,
  licence_url   TEXT,                     -- permis de conduire, si véhicule
  status        TEXT NOT NULL DEFAULT 'pending',
  review_note   TEXT,
  reviewed_by   UUID REFERENCES auth.users(id),
  reviewed_at   TIMESTAMPTZ,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.courier_applications DROP CONSTRAINT IF EXISTS courier_apps_status_valid;
ALTER TABLE public.courier_applications
  ADD CONSTRAINT courier_apps_status_valid
  CHECK (status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS courier_apps_status_idx ON public.courier_applications(status);
CREATE INDEX IF NOT EXISTS courier_apps_user_idx   ON public.courier_applications(user_id);

ALTER TABLE public.courier_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS courier_apps_insert ON public.courier_applications;
DROP POLICY IF EXISTS courier_apps_select ON public.courier_applications;
DROP POLICY IF EXISTS courier_apps_update ON public.courier_applications;

-- Dépôt : le formulaire tourne parfois juste après signUp, avant que l'e-mail
-- soit confirmé — donc parfois sans session. Même choix que pour les vendeurs.
CREATE POLICY courier_apps_insert ON public.courier_applications
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY courier_apps_select ON public.courier_applications
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_super_admin()
    OR (vendor_id IS NOT NULL AND public.owns_vendor(vendor_id))
  );

CREATE POLICY courier_apps_update ON public.courier_applications
  FOR UPDATE USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ── Approbation : c'est ici que la fiche livreur naît ─────────────────────
CREATE OR REPLACE FUNCTION public.approve_courier_application(
  p_app_id UUID,
  p_note   TEXT DEFAULT NULL
)
RETURNS public.couriers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE a public.courier_applications; c public.couriers;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;

  SELECT * INTO a FROM public.courier_applications WHERE id = p_app_id;
  IF NOT FOUND            THEN RAISE EXCEPTION 'Dossier introuvable'; END IF;
  IF a.status = 'approved' THEN RAISE EXCEPTION 'Ce dossier est déjà approuvé'; END IF;

  INSERT INTO public.couriers (vendor_id, user_id, full_name, phone, avatar_url, created_by)
  VALUES (a.vendor_id, a.user_id, a.full_name, a.phone, a.selfie_url, auth.uid())
  RETURNING * INTO c;

  UPDATE public.courier_applications
     SET status = 'approved', review_note = COALESCE(NULLIF(BTRIM(p_note), ''), review_note),
         reviewed_by = auth.uid(), reviewed_at = NOW()
   WHERE id = p_app_id;

  -- Le drapeau ouvre la console de livraison à ce compte.
  IF a.user_id IS NOT NULL THEN
    UPDATE public.profiles SET is_driver = TRUE WHERE id = a.user_id;
  END IF;

  RETURN c;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_courier_application(
  p_app_id UUID,
  p_note   TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  IF COALESCE(BTRIM(p_note), '') = '' THEN
    RAISE EXCEPTION 'Explique le motif du refus : le candidat le lira';
  END IF;

  UPDATE public.courier_applications
     SET status = 'rejected', review_note = BTRIM(p_note),
         reviewed_by = auth.uid(), reviewed_at = NOW()
   WHERE id = p_app_id AND status <> 'approved';

  IF NOT FOUND THEN RAISE EXCEPTION 'Dossier introuvable ou déjà approuvé'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_courier_application(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.reject_courier_application(UUID, TEXT)  FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_courier_application(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_courier_application(UUID, TEXT)  TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  2. FICHE DE REMISE
--
--  Une fiche vaut preuve parce qu'elle porte trois choses qu'on ne fabrique
--  pas depuis un canapé : une identité, une signature, et une photo du colis
--  à l'endroit et à l'heure de la remise.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.delivery_slips (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  courier_id       UUID REFERENCES public.couriers(id) ON DELETE SET NULL,
  created_by       UUID REFERENCES auth.users(id),
  -- Qui a réceptionné. Pas forcément le client : un voisin, un gardien…
  recipient_name   TEXT NOT NULL,
  recipient_phone  TEXT,
  recipient_id_type   TEXT,               -- cni | passeport | permis | autre
  recipient_id_number TEXT,
  is_third_party   BOOLEAN NOT NULL DEFAULT FALSE,
  relationship     TEXT,                  -- lien avec le client si tiers
  -- Les pièces. `signature_url` et `parcel_photo_url` pour une fiche remplie
  -- à l'écran ; `paper_slip_url` quand la fiche est papier et qu'on la
  -- photographie avec le colis.
  signature_url    TEXT,
  parcel_photo_url TEXT,
  paper_slip_url   TEXT,
  -- Où et quand, tels que le téléphone du livreur les a vus.
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.delivery_slips IS
  'Preuve de remise quand le code n''a pas pu être saisi : identité du '
  'réceptionnaire, signature, photo du colis remis.';

ALTER TABLE public.delivery_slips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_slips_read  ON public.delivery_slips;
DROP POLICY IF EXISTS delivery_slips_admin ON public.delivery_slips;

-- Une fiche contient un numéro de pièce d'identité : elle n'est pas publique.
-- La voient l'admin, la boutique concernée, le livreur, et le client lui-même.
CREATE POLICY delivery_slips_read ON public.delivery_slips
  FOR SELECT USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND (o.user_id = auth.uid()
             OR (o.vendor_id IS NOT NULL AND public.owns_vendor(o.vendor_id))
             OR o.driver_id = auth.uid())
    )
  );

-- L'écriture passe par `advance_course` seul : une fiche sans course clôturée
-- n'aurait aucun sens.
CREATE POLICY delivery_slips_admin ON public.delivery_slips
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- La preuve accepte un troisième niveau.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_proof_valid;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_proof_valid
  CHECK (delivery_proof IN ('none', 'code', 'slip'));

-- ════════════════════════════════════════════════════════════════════════════
--  3. CLORE AVEC UN CODE, OU AVEC UNE FICHE
--
--  p_slip attend :
--    { "recipient_name": "…", "recipient_phone": "…",
--      "recipient_id_type": "cni", "recipient_id_number": "…",
--      "is_third_party": false, "relationship": "…",
--      "signature_url": "…", "parcel_photo_url": "…", "paper_slip_url": "…",
--      "lat": 4.05, "lng": 9.76, "note": "…" }
--
--  Une fiche n'est retenue comme preuve que si elle porte une identité ET au
--  moins une image. Une fiche à moitié remplie ne vaut pas mieux que rien, et
--  on préfère le dire tout de suite plutôt qu'au moment du litige.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.advance_course(
  p_order_id UUID,
  p_step     TEXT,
  p_lat      DOUBLE PRECISION DEFAULT NULL,
  p_lng      DOUBLE PRECISION DEFAULT NULL,
  p_code     TEXT DEFAULT NULL,
  p_slip     JSONB DEFAULT NULL
)
RETURNS TABLE (
  status            TEXT,
  course_started_at TIMESTAMPTZ,
  picked_up_at      TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  origin_lat        DOUBLE PRECISION,
  origin_lng        DOUBLE PRECISION,
  delivery_proof    TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor  UUID; v_courier UUID; v_cuser UUID;
  v_started TIMESTAMPTZ; v_picked TIMESTAMPTZ; v_status TEXT; v_code TEXT;
  v_lat DOUBLE PRECISION; v_lng DOUBLE PRECISION; r public.delivery_rates;
  v_name TEXT; v_idnum TEXT; v_has_image BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  IF p_step NOT IN ('start', 'pickup', 'finish') THEN
    RAISE EXCEPTION 'Étape inconnue : %', p_step;
  END IF;

  SELECT o.vendor_id, o.courier_id, o.course_started_at, o.picked_up_at,
         o.status, o.delivery_code
    INTO v_vendor, v_courier, v_started, v_picked, v_status, v_code
  FROM public.orders o WHERE o.id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;

  SELECT c.user_id INTO v_cuser FROM public.couriers c WHERE c.id = v_courier;

  IF NOT (public.is_super_admin()
          OR public.owns_vendor(v_vendor)
          OR v_cuser = auth.uid()) THEN
    RAISE EXCEPTION 'Cette course ne vous est pas accessible';
  END IF;

  IF v_status IN ('cancelled', 'payment_failed') THEN
    RAISE EXCEPTION 'Cette commande est annulée';
  END IF;
  IF v_status = 'delivered' THEN
    RAISE EXCEPTION 'Cette course est déjà terminée';
  END IF;
  IF v_courier IS NULL THEN
    RAISE EXCEPTION 'Attribue d''abord la course à un livreur';
  END IF;
  IF p_step IN ('pickup', 'finish') AND v_started IS NULL THEN
    RAISE EXCEPTION 'La course n''a pas encore démarré';
  END IF;
  IF p_step = 'finish' AND v_picked IS NULL THEN
    RAISE EXCEPTION 'Marque d''abord le colis comme récupéré';
  END IF;

  IF p_step = 'start' THEN
    SELECT * INTO r FROM public.delivery_rates dr WHERE dr.id;
    v_lat := COALESCE(p_lat, r.hub_lat);
    v_lng := COALESCE(p_lng, r.hub_lng);
    PERFORM public.ensure_delivery_code(p_order_id);

    UPDATE public.orders o
       SET course_started_at = COALESCE(o.course_started_at, NOW()),
           origin_lat        = COALESCE(o.origin_lat, v_lat),
           origin_lng        = COALESCE(o.origin_lng, v_lng),
           status            = 'in_transit'
     WHERE o.id = p_order_id;

  ELSIF p_step = 'pickup' THEN
    UPDATE public.orders o
       SET picked_up_at = COALESCE(o.picked_up_at, NOW()),
           status       = 'in_transit'
     WHERE o.id = p_order_id;

  ELSE
    -- a) Le code, quand le client peut le donner : la preuve la plus simple.
    IF p_code IS NOT NULL AND BTRIM(p_code) <> '' THEN
      IF v_code IS NULL OR BTRIM(p_code) <> v_code THEN
        RAISE EXCEPTION 'Code incorrect. Demande au client le code affiché dans son suivi.';
      END IF;
      UPDATE public.orders o
         SET status = 'delivered', code_verified_at = NOW(), delivery_proof = 'code'
       WHERE o.id = p_order_id;

    -- b) La fiche, quand il ne le peut pas.
    ELSIF p_slip IS NOT NULL THEN
      v_name  := NULLIF(BTRIM(p_slip ->> 'recipient_name'), '');
      v_idnum := NULLIF(BTRIM(p_slip ->> 'recipient_id_number'), '');
      v_has_image := COALESCE(NULLIF(BTRIM(p_slip ->> 'parcel_photo_url'), ''),
                              NULLIF(BTRIM(p_slip ->> 'paper_slip_url'), '')) IS NOT NULL;

      IF v_name IS NULL THEN
        RAISE EXCEPTION 'Note le nom de la personne qui reçoit le colis';
      END IF;
      IF v_idnum IS NULL THEN
        RAISE EXCEPTION 'Note le numéro de pièce d''identité du réceptionnaire';
      END IF;
      IF NOT v_has_image THEN
        RAISE EXCEPTION 'Ajoute une photo : le colis remis, ou la fiche papier signée';
      END IF;

      INSERT INTO public.delivery_slips (
        order_id, courier_id, created_by,
        recipient_name, recipient_phone, recipient_id_type, recipient_id_number,
        is_third_party, relationship,
        signature_url, parcel_photo_url, paper_slip_url, lat, lng, note)
      VALUES (
        p_order_id, v_courier, auth.uid(),
        v_name,
        NULLIF(BTRIM(p_slip ->> 'recipient_phone'), ''),
        COALESCE(NULLIF(BTRIM(p_slip ->> 'recipient_id_type'), ''), 'cni'),
        v_idnum,
        COALESCE((p_slip ->> 'is_third_party')::BOOLEAN, FALSE),
        NULLIF(BTRIM(p_slip ->> 'relationship'), ''),
        NULLIF(BTRIM(p_slip ->> 'signature_url'), ''),
        NULLIF(BTRIM(p_slip ->> 'parcel_photo_url'), ''),
        NULLIF(BTRIM(p_slip ->> 'paper_slip_url'), ''),
        COALESCE((p_slip ->> 'lat')::DOUBLE PRECISION, p_lat),
        COALESCE((p_slip ->> 'lng')::DOUBLE PRECISION, p_lng),
        NULLIF(BTRIM(p_slip ->> 'note'), ''))
      ON CONFLICT (order_id) DO NOTHING;

      UPDATE public.orders o
         SET status = 'delivered', delivery_proof = 'slip'
       WHERE o.id = p_order_id;

    -- c) Ni l'un ni l'autre : la remise n'est pas prouvée.
    ELSE
      UPDATE public.orders o
         SET status = 'delivered', delivery_proof = 'none'
       WHERE o.id = p_order_id;
    END IF;
  END IF;

  RETURN QUERY
  SELECT o.status::TEXT, o.course_started_at, o.picked_up_at, o.delivered_at,
         o.origin_lat, o.origin_lng, o.delivery_proof::TEXT
  FROM public.orders o WHERE o.id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_course(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.advance_course(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, JSONB) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  4. « JAMAIS REÇU » FACE À UNE FICHE SIGNÉE
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.request_return(
  p_order_id UUID,
  p_reason   TEXT,
  p_kind     TEXT DEFAULT 'other'
)
RETURNS TABLE (return_status TEXT, deadline TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID; v_status TEXT; v_delivered TIMESTAMPTZ;
  v_ret TEXT; v_window INTEGER; v_deadline TIMESTAMPTZ;
  v_proof TEXT; v_confirmed TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF COALESCE(BTRIM(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Explique la raison du retour';
  END IF;
  IF COALESCE(p_kind, 'other') NOT IN ('not_received', 'damaged', 'wrong_item', 'other') THEN
    RAISE EXCEPTION 'Motif inconnu';
  END IF;

  SELECT o.user_id, o.status, o.delivered_at, o.return_status,
         o.delivery_proof, o.client_confirmed_at
    INTO v_user, v_status, v_delivered, v_ret, v_proof, v_confirmed
  FROM public.orders o WHERE o.id = p_order_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_user IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cette commande n''est pas la vôtre';
  END IF;
  IF v_status <> 'delivered' THEN
    RAISE EXCEPTION 'Le retour n''est possible qu''une fois la commande livrée';
  END IF;
  IF v_ret <> 'none' THEN
    RAISE EXCEPTION 'Une demande de retour existe déjà pour cette commande';
  END IF;
  IF v_confirmed IS NOT NULL THEN
    RAISE EXCEPTION 'Tu as déjà confirmé la bonne réception de cette commande';
  END IF;

  IF p_kind = 'not_received' AND v_proof = 'code' THEN
    RAISE EXCEPTION 'Le code de livraison a été saisi lors de la remise : la réception est établie. Choisis le motif qui correspond au problème réel.';
  END IF;
  IF p_kind = 'not_received' AND v_proof = 'slip' THEN
    RAISE EXCEPTION 'Une fiche de remise signée existe pour cette commande. Si elle a été signée par quelqu''un d''autre que toi, ouvre le litige avec le motif « Autre » en l''expliquant.';
  END IF;

  SELECT pp.return_window_hours INTO v_window FROM public.platform_policy pp WHERE pp.id;
  v_deadline := COALESCE(v_delivered, NOW()) + (v_window || ' hours')::INTERVAL;
  IF NOW() > v_deadline THEN
    RAISE EXCEPTION 'Le délai de % h est dépassé : le retour n''est plus possible', v_window;
  END IF;

  UPDATE public.orders o
     SET return_status       = 'requested',
         return_kind         = COALESCE(p_kind, 'other'),
         return_reason       = BTRIM(p_reason),
         return_requested_at = NOW(),
         funds_released_at   = NULL
   WHERE o.id = p_order_id;

  RETURN QUERY SELECT 'requested'::TEXT, v_deadline;
END;
$$;

REVOKE ALL ON FUNCTION public.request_return(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_return(UUID, TEXT, TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  5. L'ARBITRAGE VOIT LA FICHE
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_returns(p_status TEXT DEFAULT 'requested')
RETURNS TABLE (
  id              UUID,
  order_number    TEXT,
  shop_name       TEXT,
  vendor_id       UUID,
  client_name     TEXT,
  client_phone    TEXT,
  total_amount    NUMERIC,
  delivered_at    TIMESTAMPTZ,
  requested_at    TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  return_status   TEXT,
  return_kind     TEXT,
  return_reason   TEXT,
  return_note     TEXT,
  funds_state     TEXT,
  delivery_proof  TEXT,
  client_disputes INTEGER,
  client_rejected INTEGER,
  vendor_disputes INTEGER,
  slip            JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;

  RETURN QUERY
  SELECT o.id, o.order_number::TEXT, v.shop_name::TEXT, o.vendor_id,
         o.client_name::TEXT, o.client_phone::TEXT, o.total_amount::NUMERIC,
         o.delivered_at, o.return_requested_at, o.return_resolved_at,
         o.return_status::TEXT, o.return_kind::TEXT,
         o.return_reason::TEXT, o.return_note::TEXT,
         public.order_funds_state(o.id), o.delivery_proof::TEXT,
         (SELECT COUNT(*) FROM public.orders x
           WHERE x.user_id = o.user_id AND x.return_status <> 'none')::INTEGER,
         (SELECT COUNT(*) FROM public.orders x
           WHERE x.user_id = o.user_id AND x.return_status = 'rejected')::INTEGER,
         (SELECT COUNT(*) FROM public.orders x
           WHERE x.vendor_id = o.vendor_id AND x.return_status <> 'none')::INTEGER,
         (SELECT to_jsonb(s) FROM public.delivery_slips s WHERE s.order_id = o.id)
  FROM public.orders o
  LEFT JOIN public.vendors v ON v.id = o.vendor_id
  WHERE o.return_status <> 'none'
    AND (p_status IS NULL OR o.return_status = p_status)
  ORDER BY o.return_requested_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_returns(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_returns(TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  6. LES DOSSIERS VUS DE L'ADMIN
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_courier_applications(p_status TEXT DEFAULT 'pending')
RETURNS SETOF public.courier_applications
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  RETURN QUERY
  SELECT * FROM public.courier_applications ca
  WHERE p_status IS NULL OR ca.status = p_status
  ORDER BY ca.submitted_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_courier_applications(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_courier_applications(TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  7. STOCKAGE DES PREUVES
--     Privé : ces images portent des visages, des pièces d'identité et des
--     adresses. Elles se consultent par URL signée, jamais en clair.
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('delivery-proofs', 'delivery-proofs', FALSE, 10485760)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Delivery proofs insert" ON storage.objects;
DROP POLICY IF EXISTS "Delivery proofs read"   ON storage.objects;

CREATE POLICY "Delivery proofs insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'delivery-proofs' AND auth.role() = 'authenticated'
  );

CREATE POLICY "Delivery proofs read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'delivery-proofs' AND auth.role() = 'authenticated'
  );

-- ════════════════════════════════════════════════════════════════════════════
--  8. LIBÉRER AVANT L'HEURE, SUR PREUVE VALIDÉE
--
--  Les 48 h existent parce qu'on ne sait pas si la remise a eu lieu. Quand
--  une fiche signée est sous les yeux de l'admin — pièce d'identité, signature,
--  photo du colis — le doute est levé : attendre n'apporte plus rien et prive
--  la boutique de sa trésorerie sans raison.
--
--  L'admin valide, l'argent part. Un litige ouvert bloque toujours : celui-là
--  se règle par `resolve_return`, pas par un raccourci.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_release_funds(
  p_order_id UUID,
  p_note     TEXT DEFAULT NULL
)
RETURNS TABLE (funds_state TEXT, released_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_status TEXT; v_ret TEXT;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;

  SELECT o.status, o.return_status INTO v_status, v_ret
  FROM public.orders o WHERE o.id = p_order_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_status <> 'delivered' THEN
    RAISE EXCEPTION 'Cette commande n''est pas marquée livrée';
  END IF;
  IF v_ret IN ('requested', 'approved', 'returned') THEN
    RAISE EXCEPTION 'Un litige est ouvert : tranche-le d''abord';
  END IF;

  UPDATE public.orders o
     SET funds_released_at = COALESCE(o.funds_released_at, NOW()),
         return_note       = COALESCE(NULLIF(BTRIM(p_note), ''), o.return_note)
   WHERE o.id = p_order_id;

  RETURN QUERY
  SELECT public.order_funds_state(p_order_id), o.funds_released_at
  FROM public.orders o WHERE o.id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_release_funds(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_release_funds(UUID, TEXT) TO authenticated;

-- ── La file d'attente des remises à examiner ─────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_pending_proofs()
RETURNS TABLE (
  id             UUID,
  order_number   TEXT,
  shop_name      TEXT,
  client_name    TEXT,
  client_phone   TEXT,
  total_amount   NUMERIC,
  delivered_at   TIMESTAMPTZ,
  delivery_proof TEXT,
  courier_name   TEXT,
  hours_left     NUMERIC,
  slip           JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_hold INTEGER;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  SELECT pp.funds_hold_hours INTO v_hold FROM public.platform_policy pp WHERE pp.id;

  RETURN QUERY
  SELECT o.id, o.order_number::TEXT, v.shop_name::TEXT,
         o.client_name::TEXT, o.client_phone::TEXT, o.total_amount::NUMERIC,
         o.delivered_at, o.delivery_proof::TEXT, c.full_name::TEXT,
         ROUND(EXTRACT(EPOCH FROM (
           o.delivered_at + (v_hold || ' hours')::INTERVAL - NOW())) / 3600, 1),
         (SELECT to_jsonb(s) FROM public.delivery_slips s WHERE s.order_id = o.id)
  FROM public.orders o
  LEFT JOIN public.vendors  v ON v.id = o.vendor_id
  LEFT JOIN public.couriers c ON c.id = o.courier_id
  WHERE o.status = 'delivered'
    AND o.return_status = 'none'
    AND o.funds_released_at IS NULL
    AND o.client_confirmed_at IS NULL
    AND o.delivered_at + (v_hold || ' hours')::INTERVAL > NOW()
  ORDER BY o.delivered_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_pending_proofs() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_pending_proofs() TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════
--  20260823_abonnements_vendeur
-- ═══════════════════════════════════════════════════════════════════════

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
