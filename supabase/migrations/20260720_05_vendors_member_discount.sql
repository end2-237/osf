-- ════════════════════════════════════════════════════════════════════════════
-- VENDORS — colonnes complémentaires
-- member_discount_enabled : active la remise membre −20% sur la boutique.
-- Lue par SearchPage, Store, le panier et le Dashboard (toggle vendeur).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS member_discount_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS city                    TEXT,
  ADD COLUMN IF NOT EXISTS category                TEXT,
  ADD COLUMN IF NOT EXISTS plan                    TEXT DEFAULT 'starter';
