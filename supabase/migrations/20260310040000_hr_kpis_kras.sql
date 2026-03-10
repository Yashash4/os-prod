-- HR KPIs, KPI Entries, and KRAs tables

-- KPI definitions
CREATE TABLE IF NOT EXISTS hr_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  department_id UUID REFERENCES hr_departments(id) ON DELETE SET NULL,
  designation_id UUID REFERENCES hr_designations(id) ON DELETE SET NULL,
  unit TEXT NOT NULL DEFAULT 'count',  -- count, currency_paise, percentage, hours
  target_value NUMERIC DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'monthly',  -- daily, weekly, monthly, quarterly
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE hr_kpis ENABLE ROW LEVEL SECURITY;

-- KPI entries (actual values logged per employee per period)
CREATE TABLE IF NOT EXISTS hr_kpi_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID NOT NULL REFERENCES hr_kpis(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  period TEXT NOT NULL,            -- e.g. "2026-03"
  actual_value NUMERIC DEFAULT 0,
  target_value NUMERIC DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(kpi_id, employee_id, period)
);

ALTER TABLE hr_kpi_entries ENABLE ROW LEVEL SECURITY;

-- KRAs (Key Result Areas per employee per review period)
CREATE TABLE IF NOT EXISTS hr_kras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  weightage NUMERIC DEFAULT 0,
  review_period TEXT NOT NULL,      -- e.g. "Q1-2026"
  self_rating INT,
  manager_rating INT,
  status TEXT NOT NULL DEFAULT 'active',  -- active, review_pending, reviewed
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE hr_kras ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hr_kpi_entries_period ON hr_kpi_entries(period);
CREATE INDEX IF NOT EXISTS idx_hr_kpi_entries_employee ON hr_kpi_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_kras_employee ON hr_kras(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_kras_period ON hr_kras(review_period);
