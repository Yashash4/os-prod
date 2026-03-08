-- Jobin Meet Tracking table
-- Same schema as maverick_meet_tracking for Jobin's workspace

CREATE TABLE IF NOT EXISTS jobin_meet_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT NOT NULL UNIQUE,
  meet_status TEXT,
  meet_notes TEXT,
  meet_date TIMESTAMPTZ,
  follow_up_date TIMESTAMPTZ,
  outcome TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE jobin_meet_tracking ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view jobin meet tracking"
    ON jobin_meet_tracking FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert jobin meet tracking"
    ON jobin_meet_tracking FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update jobin meet tracking"
    ON jobin_meet_tracking FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobin_meet_opp ON jobin_meet_tracking(opportunity_id);

DROP TRIGGER IF EXISTS set_updated_at_jobin_meet ON jobin_meet_tracking;
CREATE TRIGGER set_updated_at_jobin_meet
  BEFORE UPDATE ON jobin_meet_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at();
