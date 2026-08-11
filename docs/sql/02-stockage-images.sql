-- Verrou court : en cas de table occupée, on échoue vite au lieu de bloquer.
SET lock_timeout = '5s';

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
