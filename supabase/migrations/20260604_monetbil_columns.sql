-- Monetbil payment integration: new columns on orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS monetbil_tx_id    VARCHAR,
  ADD COLUMN IF NOT EXISTS paid_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cj_order_id       VARCHAR,
  ADD COLUMN IF NOT EXISTS cj_order_status   VARCHAR DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS tracking_number   VARCHAR,
  ADD COLUMN IF NOT EXISTS tracking_carrier  VARCHAR,
  ADD COLUMN IF NOT EXISTS fulfilled_at      TIMESTAMPTZ;

-- New order statuses: pending_payment, paid, payment_failed
-- (no constraint change needed if status column is plain VARCHAR/TEXT)
