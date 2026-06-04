-- CJ Dropshipping fulfillment columns on order_items
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS selected_variant_id  VARCHAR,
  ADD COLUMN IF NOT EXISTS selected_variant_sku VARCHAR,
  ADD COLUMN IF NOT EXISTS cj_product_id        VARCHAR,
  ADD COLUMN IF NOT EXISTS delivery_city        VARCHAR;
