-- ════════════════════════════════════════════════════════════════════════════
-- VENDOR_APPLICATIONS — dossiers de candidature vendeur (KYC)
-- Écrit par Register.jsx (handleVendorSubmit), examiné par un super-admin,
-- puis promu en ligne `vendors` via approve_vendor_application().
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.vendor_applications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  shop_name     TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  phone         TEXT NOT NULL,
  city          TEXT DEFAULT 'Douala',
  category      TEXT,
  description   TEXT,
  plan          TEXT DEFAULT 'starter',   -- starter | pro | elite
  id_type       TEXT,                     -- cni | passport | permis
  id_front_url  TEXT,
  id_back_url   TEXT,
  selfie_url    TEXT,
  status        TEXT DEFAULT 'pending',   -- pending | approved | rejected
  review_note   TEXT,
  reviewed_by   UUID REFERENCES auth.users(id),
  reviewed_at   TIMESTAMPTZ,
  submitted_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_apps_status  ON public.vendor_applications(status);
CREATE INDEX IF NOT EXISTS idx_vendor_apps_user    ON public.vendor_applications(user_id);

-- ─── RLS ───
ALTER TABLE public.vendor_applications ENABLE ROW LEVEL SECURITY;

-- Dépôt d'un dossier : autorisé (le formulaire peut s'exécuter juste après
-- signUp, avant confirmation email, donc parfois sans session active).
DROP POLICY IF EXISTS "Vendor apps insert" ON public.vendor_applications;
CREATE POLICY "Vendor apps insert" ON public.vendor_applications
  FOR INSERT WITH CHECK (true);

-- Lecture : le candidat voit son dossier, le super-admin voit tout.
DROP POLICY IF EXISTS "Vendor apps select" ON public.vendor_applications;
CREATE POLICY "Vendor apps select" ON public.vendor_applications
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin)
  );

-- Modification (validation/refus) : super-admin uniquement.
DROP POLICY IF EXISTS "Vendor apps update admin" ON public.vendor_applications;
CREATE POLICY "Vendor apps update admin" ON public.vendor_applications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin)
  );

-- ─── Approbation : crée la ligne vendors et marque le dossier approuvé ───
-- SECURITY DEFINER pour contourner la RLS "écriture admin" de vendors.
-- À appeler depuis le SuperAdmin : supabase.rpc('approve_vendor_application', { p_app_id })
CREATE OR REPLACE FUNCTION public.approve_vendor_application(p_app_id UUID)
RETURNS public.vendors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app       public.vendor_applications%ROWTYPE;
  new_vendor public.vendors%ROWTYPE;
BEGIN
  -- Seul un super-admin peut approuver
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin) THEN
    RAISE EXCEPTION 'Réservé aux super-admins';
  END IF;

  SELECT * INTO app FROM public.vendor_applications WHERE id = p_app_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dossier introuvable';
  END IF;
  IF app.status = 'approved' THEN
    RAISE EXCEPTION 'Dossier déjà approuvé';
  END IF;

  INSERT INTO public.vendors (user_id, email, full_name, phone, shop_name, is_active)
  VALUES (
    app.user_id,
    (SELECT email FROM auth.users WHERE id = app.user_id),
    app.full_name, app.phone, app.shop_name, true
  )
  RETURNING * INTO new_vendor;

  UPDATE public.vendor_applications
     SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW()
   WHERE id = p_app_id;

  RETURN new_vendor;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_vendor_application(UUID) TO authenticated;

-- ─── Refus d'un dossier ───
CREATE OR REPLACE FUNCTION public.reject_vendor_application(p_app_id UUID, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin) THEN
    RAISE EXCEPTION 'Réservé aux super-admins';
  END IF;
  UPDATE public.vendor_applications
     SET status = 'rejected', review_note = p_note, reviewed_by = auth.uid(), reviewed_at = NOW()
   WHERE id = p_app_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_vendor_application(UUID, TEXT) TO authenticated;

-- Rappel : la table vendors possède un trigger `limit_vendors` (max 5 vendeurs
-- actifs). Si tu passes à un vrai marketplace multi-vendeurs, supprime-le :
--   DROP TRIGGER IF EXISTS limit_vendors ON public.vendors;
