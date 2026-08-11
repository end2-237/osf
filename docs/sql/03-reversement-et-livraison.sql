-- Verrou court : en cas de table occupée, on échoue vite au lieu de bloquer.
SET lock_timeout = '5s';

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
