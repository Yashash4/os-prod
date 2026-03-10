-- Meeting Analysis Sheet: post-meeting tracking for Maverick and Jobin
CREATE TABLE IF NOT EXISTS meeting_analysis_sheet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL,                          -- 'maverick' or 'jobin'
  opportunity_id TEXT,
  contact_id TEXT,
  calendar_event_id TEXT UNIQUE,                -- GHL event ID (dedup key)

  -- Auto-populated from GHL / call_booked
  meet_date TIMESTAMPTZ NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  meeting_link TEXT,

  -- Manual fields filled by sales reps
  recording_url TEXT,
  meeting_duration INT,                         -- minutes
  outcome TEXT,                                 -- interested, not_interested, follow_up, converted, no_show
  next_steps TEXT,
  follow_up_date DATE,
  score INT CHECK (score >= 1 AND score <= 5),
  notes TEXT,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE meeting_analysis_sheet ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can read meeting_analysis_sheet"
  ON meeting_analysis_sheet FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert meeting_analysis_sheet"
  ON meeting_analysis_sheet FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update meeting_analysis_sheet"
  ON meeting_analysis_sheet FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete meeting_analysis_sheet"
  ON meeting_analysis_sheet FOR DELETE TO authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meeting_analysis_owner_date ON meeting_analysis_sheet(owner, meet_date DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_analysis_event ON meeting_analysis_sheet(calendar_event_id);

-- Auto-update updated_at
CREATE TRIGGER set_meeting_analysis_updated_at
  BEFORE UPDATE ON meeting_analysis_sheet
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Register module
INSERT INTO modules (name, slug, description, icon, path, parent_slug) VALUES
  ('Meeting Sheet', 'meeting-analysis-sheet', 'Post-meeting analysis tracker', 'FileSpreadsheet', '/m/sales/pipeline/meetings', 'sales-pipeline')
ON CONFLICT (slug) DO NOTHING;

-- Grant to admin roles
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r, modules m
WHERE r.is_admin = true AND m.slug = 'meeting-analysis-sheet'
ON CONFLICT (role_id, module_id) DO NOTHING;

-- Grant to CTO and CMTO
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r, modules m
WHERE r.name IN ('CTO', 'CMTO') AND m.slug = 'meeting-analysis-sheet'
ON CONFLICT (role_id, module_id) DO NOTHING;
