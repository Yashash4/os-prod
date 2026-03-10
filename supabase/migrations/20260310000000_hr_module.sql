-- HR Module Tables
-- Departments, Designations, Employees, Salaries, Commission Rules,
-- Salary Cycles, KPIs, KPI Entries, KRAs

-- ── Departments ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  head_employee_id UUID, -- FK added after hr_employees exists
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Designations ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_designations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  level TEXT DEFAULT 'mid' CHECK (level IN ('intern','junior','mid','senior','lead','manager','head','director')),
  department_id UUID REFERENCES hr_departments(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Employees ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department_id UUID REFERENCES hr_departments(id) ON DELETE SET NULL,
  designation_id UUID REFERENCES hr_designations(id) ON DELETE SET NULL,
  employment_type TEXT DEFAULT 'full_time' CHECK (employment_type IN ('full_time','part_time','contract','intern')),
  join_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','on_leave','notice_period','exited')),
  exit_date DATE,
  reporting_to UUID REFERENCES hr_employees(id) ON DELETE SET NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Now add the FK for department head
ALTER TABLE hr_departments
  ADD CONSTRAINT hr_departments_head_employee_id_fkey
  FOREIGN KEY (head_employee_id) REFERENCES hr_employees(id) ON DELETE SET NULL;

-- ── Salaries ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  base_salary BIGINT NOT NULL, -- paise
  effective_from DATE NOT NULL,
  effective_to DATE, -- null = current
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Commission Rules ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES hr_employees(id) ON DELETE CASCADE,
  designation_id UUID REFERENCES hr_designations(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percentage','flat_per_unit','slab')),
  value NUMERIC,
  slab_config JSONB,
  metric TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Salary Cycles (Payroll Tracker) ───────────────────────
CREATE TABLE IF NOT EXISTS hr_salary_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  cycle_month TEXT NOT NULL, -- "2026-03"
  base_amount BIGINT DEFAULT 0,
  commission_amount BIGINT DEFAULT 0,
  deductions BIGINT DEFAULT 0,
  net_amount BIGINT DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','calculated','approved','paid')),
  paid_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, cycle_month)
);

-- ── KPIs ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  department_id UUID REFERENCES hr_departments(id) ON DELETE SET NULL,
  designation_id UUID REFERENCES hr_designations(id) ON DELETE SET NULL,
  unit TEXT NOT NULL CHECK (unit IN ('count','currency_paise','percentage','hours')),
  target_value NUMERIC DEFAULT 0,
  frequency TEXT DEFAULT 'monthly' CHECK (frequency IN ('daily','weekly','monthly','quarterly')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── KPI Entries ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_kpi_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID NOT NULL REFERENCES hr_kpis(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- "2026-03"
  actual_value NUMERIC DEFAULT 0,
  target_value NUMERIC DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(kpi_id, employee_id, period)
);

-- ── KRAs ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_kras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  weightage NUMERIC DEFAULT 0,
  review_period TEXT NOT NULL, -- "Q1-2026"
  self_rating NUMERIC CHECK (self_rating >= 1 AND self_rating <= 5),
  manager_rating NUMERIC CHECK (manager_rating >= 1 AND manager_rating <= 5),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','review_pending','reviewed','archived')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── RLS Policies (admin-only access) ──────────────────────
ALTER TABLE hr_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_salary_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_kpi_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_kras ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS. For authenticated admin access via service role key,
-- no explicit policies needed since API routes use supabaseAdmin (service role).
-- Add read-only policies for authenticated users if self-service is needed later.

-- ── Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hr_employees_dept ON hr_employees(department_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_status ON hr_employees(status);
CREATE INDEX IF NOT EXISTS idx_hr_salaries_employee ON hr_salaries(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_salary_cycles_month ON hr_salary_cycles(cycle_month);
CREATE INDEX IF NOT EXISTS idx_hr_kpi_entries_period ON hr_kpi_entries(period);
CREATE INDEX IF NOT EXISTS idx_hr_kras_employee ON hr_kras(employee_id);

-- ── Seed default departments ──────────────────────────────
INSERT INTO hr_departments (name, description) VALUES
  ('Social Media', 'Social media content creation and management'),
  ('Cohort Management', 'Admissions cohort operations and student management'),
  ('Sales', 'Sales pipeline and revenue generation'),
  ('Marketing', 'Ad campaigns, branding, and growth'),
  ('Design', 'Graphic design and creative'),
  ('Operations', 'Day-to-day operations and logistics'),
  ('Finance', 'Accounting, payments, and financial planning')
ON CONFLICT DO NOTHING;
