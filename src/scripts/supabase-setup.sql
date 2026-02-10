-- FREESTYLE ELITE - Supabase Database Schema
-- À exécuter dans votre dashboard Supabase (SQL Editor)

-- 1. EXTENSION UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLE VENDORS (Vendeurs - Max 5)
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Fonction pour limiter à 5 vendeurs
CREATE OR REPLACE FUNCTION check_vendor_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM vendors WHERE is_active = true) >= 5 THEN
    RAISE EXCEPTION 'Maximum de 5 vendeurs atteint';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER limit_vendors
BEFORE INSERT ON vendors
FOR EACH ROW
EXECUTE FUNCTION check_vendor_limit();

-- 3. TABLE PRODUCTS
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'In Stock',
  img TEXT NOT NULL,
  features TEXT[] DEFAULT ARRAY[]::TEXT[],
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLE ORDERS
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number SERIAL UNIQUE,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_address TEXT NOT NULL,
  total_amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  payment_reference TEXT,
  status TEXT DEFAULT 'pending', -- pending, validated, shipped, delivered
  vendor_id UUID REFERENCES vendors(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLE ORDER_ITEMS
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  product_img TEXT,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  selected_size TEXT,
  selected_color TEXT
);

-- 6. TABLE FCM_TOKENS (Pour les notifications)
CREATE TABLE fcm_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ROW LEVEL SECURITY (RLS)

-- Vendors: Lecture publique, écriture seulement par les admins
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vendors lecture publique" ON vendors FOR SELECT USING (true);
CREATE POLICY "Vendors écriture admin" ON vendors FOR ALL USING (auth.uid() IN (SELECT user_id FROM vendors));

-- Products: Lecture publique, écriture par le propriétaire
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products lecture publique" ON products FOR SELECT USING (true);
CREATE POLICY "Products écriture vendeur" ON products FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM vendors WHERE id = products.vendor_id)
);

-- Orders: Lecture par le vendeur concerné
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Orders lecture vendeur" ON orders FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM vendors WHERE id = orders.vendor_id)
);
CREATE POLICY "Orders création publique" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Orders update vendeur" ON orders FOR UPDATE USING (
  auth.uid() IN (SELECT user_id FROM vendors WHERE id = orders.vendor_id)
);

-- Order Items: Lié aux orders
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order items lecture via order" ON order_items FOR SELECT USING (
  order_id IN (
    SELECT id FROM orders WHERE vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "Order items création publique" ON order_items FOR INSERT WITH CHECK (true);

-- FCM Tokens
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "FCM tokens par vendeur" ON fcm_tokens FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM vendors WHERE id = fcm_tokens.vendor_id)
);

-- 8. FONCTIONS UTILES

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. STORAGE BUCKET pour les images
-- À créer manuellement dans Supabase Dashboard > Storage
-- Nom du bucket: "product-images"
-- Public: true
-- Policy: Allow public uploads and reads
