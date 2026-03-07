-- Call Booked Tracking table
-- Goal: understand if the client is the right fit for us

DO $$ BEGIN
  CREATE TYPE call_booked_status AS ENUM (
    'pending_review',
    'call_done',
    'right_fit',
    'not_a_fit',
    'needs_followup',
    'onboarded',
    'declined'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS sales_call_booked_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  pipeline_name TEXT,
  stage_name TEXT,
  source TEXT,
  status call_booked_status DEFAULT 'pending_review',
  rating INT CHECK (rating >= 1 AND rating <= 5),
  comments TEXT,
  notes TEXT,
  assigned_to TEXT,
  call_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sales_call_booked_tracking ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view call booked tracking"
    ON sales_call_booked_tracking FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert call booked tracking"
    ON sales_call_booked_tracking FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update call booked tracking"
    ON sales_call_booked_tracking FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_call_booked_tracking_opp ON sales_call_booked_tracking(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_call_booked_tracking_status ON sales_call_booked_tracking(status);
CREATE INDEX IF NOT EXISTS idx_call_booked_tracking_rating ON sales_call_booked_tracking(rating);

DROP TRIGGER IF EXISTS set_updated_at_call_booked_tracking ON sales_call_booked_tracking;
CREATE TRIGGER set_updated_at_call_booked_tracking
  BEFORE UPDATE ON sales_call_booked_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at();
