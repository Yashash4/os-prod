ALTER TABLE maverick_sales_tracking
  ADD COLUMN IF NOT EXISTS payment_link_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_link_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_link_sent_at TIMESTAMPTZ;

ALTER TABLE jobin_sales_tracking
  ADD COLUMN IF NOT EXISTS payment_link_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_link_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_link_sent_at TIMESTAMPTZ;
