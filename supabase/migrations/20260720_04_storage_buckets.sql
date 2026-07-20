-- ════════════════════════════════════════════════════════════════════════════
-- STORAGE BUCKETS — kyc-documents (pièces d'identité + selfie) et profiles (avatars)
-- ════════════════════════════════════════════════════════════════════════════

-- ─── kyc-documents ───
-- PRIVÉ : les pièces d'identité ne doivent PAS être publiques.
-- Register.jsx doit stocker le CHEMIN de l'objet, et le SuperAdmin générer une
-- URL signée (createSignedUrl) pour les consulter. Voir la note en bas.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('kyc-documents', 'kyc-documents', false, 5242880)  -- 5 MB
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit;

-- Dépôt autorisé (le formulaire d'inscription peut tourner sans session).
DROP POLICY IF EXISTS "KYC upload" ON storage.objects;
CREATE POLICY "KYC upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'kyc-documents');

-- Lecture : propriétaire (dossier = user_id) ou super-admin, jamais public.
-- Convention de chemin : vendor-kyc/<user_id>/<timestamp>/<fichier>
DROP POLICY IF EXISTS "KYC read owner or admin" ON storage.objects;
CREATE POLICY "KYC read owner or admin" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'kyc-documents'
    AND (
      (storage.foldername(name))[2] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin)
    )
  );

-- ─── profiles (avatars) ───
-- PUBLIC : les avatars s'affichent partout via getPublicUrl().
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('profiles', 'profiles', true, 2097152)  -- 2 MB
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "Avatars lecture publique" ON storage.objects;
CREATE POLICY "Avatars lecture publique" ON storage.objects
  FOR SELECT USING (bucket_id = 'profiles');

DROP POLICY IF EXISTS "Avatars upload authentifie" ON storage.objects;
CREATE POLICY "Avatars upload authentifie" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'profiles' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Avatars update authentifie" ON storage.objects;
CREATE POLICY "Avatars update authentifie" ON storage.objects
  FOR UPDATE USING (bucket_id = 'profiles' AND auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────────────────────
-- NOTE SÉCURITÉ — Register.jsx utilise aujourd'hui getPublicUrl() sur
-- kyc-documents, qui est privé : l'URL renvoyée ne sera pas lisible.
-- Deux options :
--   (A) recommandé — stocker le chemin d'objet dans vendor_applications et
--       afficher via createSignedUrl() dans le SuperAdmin ;
--   (B) rapide mais NON sécurisé — passer le bucket en public=true ci-dessus
--       (les pièces d'identité deviennent accessibles à qui a l'URL).
-- Garde (A) : c'est de la donnée personnelle sensible.
-- ────────────────────────────────────────────────────────────────────────────
