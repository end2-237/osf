-- Shipping mode for transitaire vs DHL direct fulfillment
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_mode VARCHAR DEFAULT 'dhl_direct';
