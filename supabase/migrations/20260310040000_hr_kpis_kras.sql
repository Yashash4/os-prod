-- HR KPIs, KPI Entries, and KRAs: additional indexes
-- NOTE: Tables hr_kpis, hr_kpi_entries, hr_kras are defined in 20260310000000_hr_module.sql
-- This migration only adds indexes that were missing from the original.

CREATE INDEX IF NOT EXISTS idx_hr_kpi_entries_employee ON hr_kpi_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_kras_period           ON hr_kras(review_period);
