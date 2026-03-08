-- Add optins and payments columns to cohort_daily_metrics
ALTER TABLE cohort_daily_metrics
  ADD COLUMN IF NOT EXISTS optins INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payments INTEGER DEFAULT 0;
