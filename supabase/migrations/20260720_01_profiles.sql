-- ════════════════════════════════════════════════════════════════════════════
-- PROFILES — profil applicatif lié à auth.users
-- Utilisé par : AuthContext (is_super_admin), Register (parrainage/loyauté),
-- ProfilePage (réglages), Navbar, etc.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.profiles (
  id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name          TEXT,
  phone              TEXT,
  bio                TEXT,
  city               TEXT DEFAULT 'Douala',
  birthday           DATE,
  gender             TEXT,
  instagram          TEXT,
  whatsapp           TEXT,
  avatar_url         TEXT,
  loyalty_points     INTEGER DEFAULT 0,
  referral_code      TEXT UNIQUE,
  is_super_admin     BOOLEAN DEFAULT false,
  notification_prefs JSONB DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Colonnes ajoutées si la table existait déjà (idempotent)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name          TEXT,
  ADD COLUMN IF NOT EXISTS phone              TEXT,
  ADD COLUMN IF NOT EXISTS bio                TEXT,
  ADD COLUMN IF NOT EXISTS city               TEXT DEFAULT 'Douala',
  ADD COLUMN IF NOT EXISTS birthday           DATE,
  ADD COLUMN IF NOT EXISTS gender             TEXT,
  ADD COLUMN IF NOT EXISTS instagram          TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp           TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url         TEXT,
  ADD COLUMN IF NOT EXISTS loyalty_points     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_code      TEXT,
  ADD COLUMN IF NOT EXISTS is_super_admin     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at         TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);

-- ─── Création automatique du profil à chaque inscription ───
-- Sans ça, les nouveaux comptes n'ont pas de ligne profiles et les
-- updates loyauté/parrainage tombent dans le vide.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name',
             NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Rattrape les utilisateurs déjà existants sans profil
INSERT INTO public.profiles (id, full_name)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', '')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ─── RLS ───
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Lecture publique : nécessaire pour la validation d'un code de parrainage
-- (avant même l'inscription) et l'affichage nom/avatar des acheteurs.
DROP POLICY IF EXISTS "Profiles lecture publique" ON public.profiles;
CREATE POLICY "Profiles lecture publique" ON public.profiles
  FOR SELECT USING (true);

-- Chaque utilisateur crée/modifie uniquement sa propre ligne.
DROP POLICY IF EXISTS "Profiles insert self" ON public.profiles;
CREATE POLICY "Profiles insert self" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles update self" ON public.profiles;
CREATE POLICY "Profiles update self" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Note : is_super_admin ne doit être positionné qu'à la main dans le
-- dashboard Supabase — aucune policy ne permet de se l'auto-attribuer.
