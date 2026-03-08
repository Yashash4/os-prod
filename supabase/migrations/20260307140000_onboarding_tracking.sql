-- Onboarding Tracking table
-- Tracks client onboarding after won deals are closed

CREATE TABLE IF NOT EXISTS onboarding_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  source_rep TEXT,
  fees_quoted NUMERIC(12,2) DEFAULT 0,
  fees_collected NUMERIC(12,2) DEFAULT 0,
  onboarding_status TEXT DEFAULT 'scheduled',
  assigned_onboarder TEXT,
  meeting_date DATE,
  meeting_notes TEXT,
  brand_rating INTEGER CHECK (brand_rating >= 1 AND brand_rating <= 5),
  brand_description TEXT,
  client_notes TEXT,
  checklist JSONB DEFAULT '[]'::jsonb,
  follow_up_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE onboarding_tracking ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view onboarding tracking"
    ON onboarding_tracking FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert onboarding tracking"
    ON onboarding_tracking FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update onboarding tracking"
    ON onboarding_tracking FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_onboarding_opp ON onboarding_tracking(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_status ON onboarding_tracking(onboarding_status);
CREATE INDEX IF NOT EXISTS idx_onboarding_rep ON onboarding_tracking(source_rep);

DROP TRIGGER IF EXISTS set_updated_at_onboarding ON onboarding_tracking;
CREATE TRIGGER set_updated_at_onboarding
  BEFORE UPDATE ON onboarding_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at();
