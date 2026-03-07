-- Maverick Meet Management table
-- Stores Maverick's own tracking data for meetings, linked to call_booked_tracking via opportunity_id

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TYPE maverick_meet_status AS ENUM (
    'pending',
    'scheduled',
    'completed',
    'follow_up',
    'converted',
    'dropped'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS maverick_meet_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT NOT NULL UNIQUE,
  meet_status maverick_meet_status DEFAULT 'pending',
  meet_notes TEXT,
  meet_date TIMESTAMPTZ,
  follow_up_date TIMESTAMPTZ,
  outcome TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE maverick_meet_tracking ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view maverick meet tracking"
    ON maverick_meet_tracking FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert maverick meet tracking"
    ON maverick_meet_tracking FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update maverick meet tracking"
    ON maverick_meet_tracking FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_maverick_meet_opp ON maverick_meet_tracking(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_maverick_meet_status ON maverick_meet_tracking(meet_status);

DROP TRIGGER IF EXISTS set_updated_at_maverick_meet ON maverick_meet_tracking;
CREATE TRIGGER set_updated_at_maverick_meet
  BEFORE UPDATE ON maverick_meet_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at();
