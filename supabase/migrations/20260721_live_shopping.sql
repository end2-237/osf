-- ════════════════════════════════════════════════════════════════════════════
-- LIVE SHOPPING — shows en direct, enchères, chat, follow, favoris
-- Realtime activé sur live_shows / live_products / live_messages / live_bids.
-- Le nombre de vues réel est géré côté client via Realtime Presence.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── SHOWS ───
CREATE TABLE IF NOT EXISTS public.live_shows (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  host_user_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  category      TEXT,
  cover_url     TEXT,
  status        TEXT DEFAULT 'scheduled',   -- scheduled | live | ended
  viewer_count  INTEGER DEFAULT 0,          -- pic de vues (persisté), live = presence
  likes         INTEGER DEFAULT 0,
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  scheduled_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_live_shows_status ON public.live_shows(status);
CREATE INDEX IF NOT EXISTS idx_live_shows_vendor ON public.live_shows(vendor_id);

-- ─── PRODUITS PRÉSENTÉS (une carte à l'écran) ───
CREATE TABLE IF NOT EXISTS public.live_products (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id          UUID REFERENCES public.live_shows(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  img              TEXT,
  size             TEXT,
  description      TEXT,
  mode             TEXT DEFAULT 'auction',  -- auction | fixed
  start_price      NUMERIC DEFAULT 0,
  current_bid      NUMERIC DEFAULT 0,
  bid_step         NUMERIC DEFAULT 500,
  next_bid         NUMERIC DEFAULT 0,
  buy_now          NUMERIC,
  high_bidder_id   UUID,
  high_bidder_name TEXT,
  status           TEXT DEFAULT 'active',   -- active | sold | ended
  sold_to          UUID,
  sold_to_name     TEXT,
  sold_price       NUMERIC,
  sold_at          TIMESTAMPTZ,
  is_featured      BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_live_products_show ON public.live_products(show_id);

-- ─── ENCHÈRES ───
CREATE TABLE IF NOT EXISTS public.live_bids (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id     UUID REFERENCES public.live_shows(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES public.live_products(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id),
  user_name   TEXT,
  amount      NUMERIC NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_live_bids_product ON public.live_bids(product_id);

-- ─── MESSAGES / COMMENTAIRES (avec image possible) ───
CREATE TABLE IF NOT EXISTS public.live_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id     UUID REFERENCES public.live_shows(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id),
  user_name   TEXT,
  text        TEXT,
  image_url   TEXT,
  kind        TEXT DEFAULT 'chat',   -- chat | bid | sold | join
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_live_messages_show ON public.live_messages(show_id, created_at);

-- ─── FOLLOW (abonnement à un créateur/vendeur) ───
CREATE TABLE IF NOT EXISTS public.follows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id    UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (follower_id, vendor_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_vendor ON public.follows(vendor_id);

-- ─── FAVORIS DE LIVES ───
CREATE TABLE IF NOT EXISTS public.live_saves (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  show_id     UUID REFERENCES public.live_shows(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, show_id)
);

-- ════════════════════════════════════════════════════════════════════════════
-- RPC : placer une enchère (atomique, contourne la RLS)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.place_live_bid(p_product_id UUID, p_user_name TEXT)
RETURNS public.live_products
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prod public.live_products%ROWTYPE; new_amount NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise pour enchérir'; END IF;
  SELECT * INTO prod FROM live_products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable'; END IF;
  IF prod.status <> 'active' THEN RAISE EXCEPTION 'Enchère clôturée'; END IF;

  new_amount := GREATEST(prod.next_bid, prod.current_bid + prod.bid_step);
  UPDATE live_products
     SET current_bid = new_amount,
         next_bid    = new_amount + bid_step,
         high_bidder_id = auth.uid(),
         high_bidder_name = p_user_name
   WHERE id = p_product_id
   RETURNING * INTO prod;

  INSERT INTO live_bids (show_id, product_id, user_id, user_name, amount)
  VALUES (prod.show_id, p_product_id, auth.uid(), p_user_name, new_amount);

  INSERT INTO live_messages (show_id, user_id, user_name, text, kind)
  VALUES (prod.show_id, auth.uid(), p_user_name, 'a enchéri ' || new_amount || ' F', 'bid');

  RETURN prod;
END; $$;
GRANT EXECUTE ON FUNCTION public.place_live_bid(UUID, TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- RPC : achat immédiat (marque vendu + message "vendu")
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.buy_live_product(p_product_id UUID, p_user_name TEXT)
RETURNS public.live_products
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prod public.live_products%ROWTYPE; price NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  SELECT * INTO prod FROM live_products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable'; END IF;
  IF prod.status = 'sold' THEN RAISE EXCEPTION 'Déjà vendu'; END IF;

  price := COALESCE(prod.buy_now, prod.current_bid);
  UPDATE live_products
     SET status = 'sold', sold_to = auth.uid(), sold_to_name = p_user_name,
         sold_price = price, sold_at = NOW()
   WHERE id = p_product_id
   RETURNING * INTO prod;

  INSERT INTO live_messages (show_id, user_id, user_name, text, kind)
  VALUES (prod.show_id, auth.uid(), p_user_name, 'a acheté ' || prod.name || ' 🎉', 'sold');

  RETURN prod;
END; $$;
GRANT EXECUTE ON FUNCTION public.buy_live_product(UUID, TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.live_shows    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_bids     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_saves    ENABLE ROW LEVEL SECURITY;

-- Lecture publique de tout le contenu live
DROP POLICY IF EXISTS "live_shows read"    ON public.live_shows;
CREATE POLICY "live_shows read"    ON public.live_shows    FOR SELECT USING (true);
DROP POLICY IF EXISTS "live_products read" ON public.live_products;
CREATE POLICY "live_products read" ON public.live_products FOR SELECT USING (true);
DROP POLICY IF EXISTS "live_bids read"     ON public.live_bids;
CREATE POLICY "live_bids read"     ON public.live_bids     FOR SELECT USING (true);
DROP POLICY IF EXISTS "live_messages read" ON public.live_messages;
CREATE POLICY "live_messages read" ON public.live_messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "follows read"       ON public.follows;
CREATE POLICY "follows read"       ON public.follows       FOR SELECT USING (true);

-- Le vendeur gère ses shows/produits
DROP POLICY IF EXISTS "live_shows host write" ON public.live_shows;
CREATE POLICY "live_shows host write" ON public.live_shows
  FOR ALL USING (auth.uid() = host_user_id) WITH CHECK (auth.uid() = host_user_id);

DROP POLICY IF EXISTS "live_products host write" ON public.live_products;
CREATE POLICY "live_products host write" ON public.live_products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM live_shows s WHERE s.id = show_id AND s.host_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM live_shows s WHERE s.id = show_id AND s.host_user_id = auth.uid())
  );

-- Chat : un utilisateur connecté poste sous sa propre identité
DROP POLICY IF EXISTS "live_messages insert" ON public.live_messages;
CREATE POLICY "live_messages insert" ON public.live_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Follow / favoris : chacun gère les siens
DROP POLICY IF EXISTS "follows write" ON public.follows;
CREATE POLICY "follows write" ON public.follows
  FOR ALL USING (auth.uid() = follower_id) WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "live_saves all" ON public.live_saves;
CREATE POLICY "live_saves all" ON public.live_saves
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- REALTIME
-- ════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.live_shows;    EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.live_products; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.live_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.live_bids;     EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- STORAGE : médias live (couvertures + images de commentaires) — public
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('live-media', 'live-media', true, 5242880)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "live-media read" ON storage.objects;
CREATE POLICY "live-media read" ON storage.objects
  FOR SELECT USING (bucket_id = 'live-media');

DROP POLICY IF EXISTS "live-media upload" ON storage.objects;
CREATE POLICY "live-media upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'live-media');
