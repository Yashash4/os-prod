-- Sales Opt-in Tracking table
-- Tracks status of opt-in contacts for call booking workflow

-- Ensure update_updated_at function exists
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TYPE optin_status AS ENUM (
    'new',
    'contacted',
    'interested',
    'call_booked',
    'payment_pending',
    'payment_done',
    'not_interested',
    'no_response'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS sales_optin_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  pipeline_name TEXT,
  stage_name TEXT,
  source TEXT,
  monetary_value NUMERIC DEFAULT 0,
  status optin_status DEFAULT 'new',
  notes TEXT,
  assigned_to TEXT,
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sales_optin_tracking ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view optin tracking"
    ON sales_optin_tracking FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert optin tracking"
    ON sales_optin_tracking FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update optin tracking"
    ON sales_optin_tracking FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_optin_tracking_opp ON sales_optin_tracking(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_optin_tracking_status ON sales_optin_tracking(status);

DROP TRIGGER IF EXISTS set_updated_at_optin_tracking ON sales_optin_tracking;
CREATE TRIGGER set_updated_at_optin_tracking
  BEFORE UPDATE ON sales_optin_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Register Sales Setting module (sort_order may not exist in all environments)
INSERT INTO modules (name, slug, description, icon, path, parent_slug)
VALUES ('Sales Setting', 'sales-setting', 'Sales tracking sheets and settings', 'Settings', '/m/sales/settings', 'sales')
ON CONFLICT (slug) DO NOTHING;
