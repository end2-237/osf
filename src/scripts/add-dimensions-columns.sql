-- Migration: add physical dimensions to products table
-- Run in Supabase SQL Editor

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS length_cm      NUMERIC,   -- product length (cm)
  ADD COLUMN IF NOT EXISTS width_cm       NUMERIC,   -- product width  (cm)
  ADD COLUMN IF NOT EXISTS height_cm      NUMERIC,   -- product height (cm)
  ADD COLUMN IF NOT EXISTS pack_l_cm      NUMERIC,   -- packaging length (cm) — used for shipping calc
  ADD COLUMN IF NOT EXISTS pack_w_cm      NUMERIC,   -- packaging width  (cm)
  ADD COLUMN IF NOT EXISTS pack_h_cm      NUMERIC,   -- packaging height (cm)
  ADD COLUMN IF NOT EXISTS ship_weight_g  NUMERIC;   -- logistics/shipping weight (g)

-- Volumetric weight helper (DHL formula: L×W×H / 5000)
-- Example usage: SELECT id, name, (pack_l_cm * pack_w_cm * pack_h_cm / 5000) AS vol_weight_kg FROM products;

-- Index for shipping cost queries
CREATE INDEX IF NOT EXISTS idx_products_dimensions ON products(pack_l_cm, pack_w_cm, pack_h_cm, ship_weight_g);
