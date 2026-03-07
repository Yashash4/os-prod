-- Payment Done Tracking table
-- Tracks people who paid, goal is to get them to book a call

DO $$ BEGIN
  CREATE TYPE payment_done_status AS ENUM (
    'new',
    'contacted',
    'call_scheduled',
    'call_completed',
    'no_response',
    'rescheduled',
    'not_reachable'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS sales_payment_done_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  pipeline_name TEXT,
  stage_name TEXT,
  source TEXT,
  status payment_done_status DEFAULT 'new',
  notes TEXT,
  assigned_to TEXT,
  last_contacted_at TIMESTAMPTZ,
  call_scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sales_payment_done_tracking ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view payment done tracking"
    ON sales_payment_done_tracking FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert payment done tracking"
    ON sales_payment_done_tracking FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update payment done tracking"
    ON sales_payment_done_tracking FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_done_tracking_opp ON sales_payment_done_tracking(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_payment_done_tracking_status ON sales_payment_done_tracking(status);

DROP TRIGGER IF EXISTS set_updated_at_payment_done_tracking ON sales_payment_done_tracking;
CREATE TRIGGER set_updated_at_payment_done_tracking
  BEFORE UPDATE ON sales_payment_done_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at();
