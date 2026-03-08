-- Rename Campaign Tracker module to Cohort Tracker
UPDATE modules SET
  name = 'Cohort Tracker',
  slug = 'analytics-cohort',
  description = 'Admissions cohort funnel and automated daily KPI tracking',
  path = '/m/analytics/cohort-tracker'
WHERE slug = 'analytics-campaign';

-- Update role_modules references (slug change means module_id stays same, no action needed)

-- Create cohort_daily_metrics table for automated nightly data collection
CREATE TABLE IF NOT EXISTS cohort_daily_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  -- Meta Ads data (auto-fetched)
  ad_spend NUMERIC(12,2) DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  -- Sales pipeline data (auto-fetched)
  meetings_booked INTEGER DEFAULT 0,
  calls_completed INTEGER DEFAULT 0,
  show_ups INTEGER DEFAULT 0,
  admissions INTEGER DEFAULT 0,
  -- Revenue data (auto-fetched)
  revenue_collected NUMERIC(12,2) DEFAULT 0,
  -- Manual override / notes
  notes TEXT DEFAULT '',
  -- Metadata
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index on date for fast lookups
CREATE INDEX IF NOT EXISTS idx_cohort_daily_metrics_date ON cohort_daily_metrics(date);

-- RLS: allow authenticated reads, server-side writes via service role
ALTER TABLE cohort_daily_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON cohort_daily_metrics
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow service role all" ON cohort_daily_metrics
  FOR ALL TO service_role USING (true) WITH CHECK (true);
