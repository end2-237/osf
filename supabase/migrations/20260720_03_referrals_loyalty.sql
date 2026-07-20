-- ════════════════════════════════════════════════════════════════════════════
-- REFERRALS + LOYALTY — parrainage et points de fidélité
-- Utilisé par Register.jsx (processReferral) et ProfilePage (OFS Rewards).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.referrals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,            -- referral_bonus | welcome_bonus | redeem | ...
  points        INTEGER NOT NULL,
  reference_id  UUID,
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_user ON public.loyalty_transactions(user_id);

-- ─── RLS ───
ALTER TABLE public.referrals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Lecture de ses propres lignes (le reste passe par le RPC ci-dessous).
DROP POLICY IF EXISTS "Referrals select self" ON public.referrals;
CREATE POLICY "Referrals select self" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "Loyalty select self" ON public.loyalty_transactions;
CREATE POLICY "Loyalty select self" ON public.loyalty_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- ─── RPC parrainage ───
-- Attribue 200 pts au parrain + 50 pts au filleul, en une transaction, côté
-- serveur. Remplace les writes directs du client (qui violent la RLS car ils
-- modifient la ligne d'un autre utilisateur). Idempotent : un filleul ne peut
-- être parrainé qu'une fois.
CREATE OR REPLACE FUNCTION public.process_referral(p_referrer UUID, p_referred UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_referrer IS NULL OR p_referred IS NULL OR p_referrer = p_referred THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = p_referred) THEN
    RETURN; -- déjà parrainé
  END IF;

  INSERT INTO public.referrals (referrer_id, referred_id)
  VALUES (p_referrer, p_referred);

  INSERT INTO public.loyalty_transactions (user_id, type, points, reference_id, description)
  VALUES (p_referrer, 'referral_bonus', 200, p_referred, 'Bonus parrainage - nouvel inscrit');
  UPDATE public.profiles SET loyalty_points = COALESCE(loyalty_points, 0) + 200
   WHERE id = p_referrer;

  INSERT INTO public.loyalty_transactions (user_id, type, points, reference_id, description)
  VALUES (p_referred, 'welcome_bonus', 50, p_referrer, 'Bonus bienvenue - parraine par un membre');
  UPDATE public.profiles SET loyalty_points = COALESCE(loyalty_points, 0) + 50
   WHERE id = p_referred;
END;
$$;

-- anon inclus car l'inscription peut tourner sans session (confirmation email).
GRANT EXECUTE ON FUNCTION public.process_referral(UUID, UUID) TO anon, authenticated;
