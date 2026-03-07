-- Add GHL native fields to call_booked_tracking
ALTER TABLE sales_call_booked_tracking
  ADD COLUMN IF NOT EXISTS ghl_status TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_id TEXT,
  ADD COLUMN IF NOT EXISTS contact_id TEXT;

-- Add same fields to optin and payment done tracking for consistency
ALTER TABLE sales_optin_tracking
  ADD COLUMN IF NOT EXISTS ghl_status TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_id TEXT,
  ADD COLUMN IF NOT EXISTS contact_id TEXT;

ALTER TABLE sales_payment_done_tracking
  ADD COLUMN IF NOT EXISTS ghl_status TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_id TEXT,
  ADD COLUMN IF NOT EXISTS contact_id TEXT;
