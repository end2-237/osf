-- Verrou court : en cas de table occupée, on échoue vite au lieu de bloquer.
SET lock_timeout = '5s';

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
