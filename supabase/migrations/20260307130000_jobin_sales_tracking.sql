-- Jobin Sales Tracking table
-- Same schema as maverick_sales_tracking for Jobin's workspace

CREATE TABLE IF NOT EXISTS jobin_sales_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT NOT NULL UNIQUE,
  closed_date TIMESTAMPTZ,
  fees_quoted NUMERIC(12,2) DEFAULT 0,
  fees_collected NUMERIC(12,2) DEFAULT 0,
  pending_amount NUMERIC(12,2) DEFAULT 0,
  payment_mode TEXT,
  invoice_number TEXT,
  collection_status TEXT DEFAULT 'pending',
  onboarding_status TEXT DEFAULT 'not_started',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE jobin_sales_tracking ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view jobin sales tracking"
    ON jobin_sales_tracking FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert jobin sales tracking"
    ON jobin_sales_tracking FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update jobin sales tracking"
    ON jobin_sales_tracking FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobin_sales_opp ON jobin_sales_tracking(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_jobin_sales_collection ON jobin_sales_tracking(collection_status);

DROP TRIGGER IF EXISTS set_updated_at_jobin_sales ON jobin_sales_tracking;
CREATE TRIGGER set_updated_at_jobin_sales
  BEFORE UPDATE ON jobin_sales_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at();
