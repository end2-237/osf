-- ════════════════════════════════════════════════════════════════════════════
-- LIVE — extras : liens créateur, adjudication au meilleur enchérisseur
-- ════════════════════════════════════════════════════════════════════════════

-- Liens sociaux / site pour la bio créateur (profiles a déjà bio, instagram, whatsapp)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS tiktok  TEXT;

-- ─── RPC : adjuger l'enchère au meilleur enchérisseur (hôte only) ───
CREATE OR REPLACE FUNCTION public.award_live_product(p_product_id UUID)
RETURNS public.live_products
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prod public.live_products%ROWTYPE;
BEGIN
  SELECT * INTO prod FROM live_products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable'; END IF;

  -- seul l'hôte du show peut adjuger
  IF NOT EXISTS (SELECT 1 FROM live_shows s WHERE s.id = prod.show_id AND s.host_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Réservé à l''hôte du live';
  END IF;
  IF prod.status = 'sold' THEN RAISE EXCEPTION 'Déjà vendu'; END IF;
  IF prod.high_bidder_id IS NULL THEN RAISE EXCEPTION 'Aucune enchère à adjuger'; END IF;

  UPDATE live_products
     SET status = 'sold', sold_to = prod.high_bidder_id, sold_to_name = prod.high_bidder_name,
         sold_price = prod.current_bid, sold_at = NOW()
   WHERE id = p_product_id
   RETURNING * INTO prod;

  INSERT INTO live_messages (show_id, user_id, user_name, text, kind)
  VALUES (prod.show_id, prod.high_bidder_id, prod.high_bidder_name,
          'remporte ' || prod.name || ' pour ' || prod.current_bid || ' F 🎉', 'sold');

  RETURN prod;
END; $$;
GRANT EXECUTE ON FUNCTION public.award_live_product(UUID) TO authenticated;

-- ─── Filet de sécurité : bucket avatars (photo de profil) ───
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('profiles', 'profiles', true, 2097152)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Avatars lecture publique" ON storage.objects;
CREATE POLICY "Avatars lecture publique" ON storage.objects
  FOR SELECT USING (bucket_id = 'profiles');
DROP POLICY IF EXISTS "Avatars upload authentifie" ON storage.objects;
CREATE POLICY "Avatars upload authentifie" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profiles');
DROP POLICY IF EXISTS "Avatars update authentifie" ON storage.objects;
CREATE POLICY "Avatars update authentifie" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'profiles');
