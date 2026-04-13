-- ============================================================================
-- APEX OS — Complete Production Database Schema
-- Owner: FOUNDATION agent
-- ============================================================================
-- Design principles:
--   - UUID PKs with gen_random_uuid()
--   - created_at + updated_at on every table
--   - created_by on every user-facing table
--   - ON DELETE policy on every FK
--   - Indexes on every FK column + common WHERE columns
--   - BIGINT for all monetary values (stored in paise, 100 paise = 1 INR)
--   - ENUM types for fixed value sets
--   - snake_case naming, domain-prefixed tables
-- ============================================================================

-- ============================================================================
-- 0. UTILITY: updated_at trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. ENUM TYPES
-- ============================================================================

-- Core
CREATE TYPE data_visibility_enum AS ENUM ('all', 'team', 'self');
CREATE TYPE access_type_enum AS ENUM ('grant', 'revoke');
CREATE TYPE permission_action_enum AS ENUM ('read', 'create', 'edit', 'approve', 'export');

-- HR
CREATE TYPE employment_type_enum AS ENUM ('full_time', 'part_time', 'contract', 'intern');
CREATE TYPE employee_status_enum AS ENUM ('active', 'on_leave', 'notice_period', 'exited');
CREATE TYPE designation_level_enum AS ENUM ('intern', 'junior', 'mid', 'senior', 'lead', 'manager', 'head', 'director');
CREATE TYPE leave_status_enum AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE salary_cycle_status_enum AS ENUM ('pending', 'calculated', 'approved', 'paid');
CREATE TYPE kpi_unit_enum AS ENUM ('count', 'currency_paise', 'percentage', 'hours');
CREATE TYPE kpi_frequency_enum AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'yearly');
CREATE TYPE kra_status_enum AS ENUM ('active', 'review_pending', 'reviewed', 'archived');
CREATE TYPE review_period_enum AS ENUM ('Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'FY');
CREATE TYPE commission_type_enum AS ENUM ('percentage', 'flat_per_unit', 'slab');
CREATE TYPE attendance_status_enum AS ENUM ('present', 'absent', 'half_day', 'work_from_home', 'on_leave');
CREATE TYPE document_type_enum AS ENUM ('offer_letter', 'id_proof', 'address_proof', 'education', 'experience', 'salary_slip', 'tax_form', 'contract', 'other');

-- Finance
CREATE TYPE expense_status_enum AS ENUM ('pending', 'approved', 'rejected');

-- Tasks
CREATE TYPE task_status_enum AS ENUM ('todo', 'in_progress', 'review', 'done', 'cancelled');
CREATE TYPE task_priority_enum AS ENUM ('low', 'medium', 'high', 'urgent');

-- Sales
CREATE TYPE sales_opportunity_status_enum AS ENUM ('pending_review', 'call_done', 'right_fit', 'not_a_fit', 'needs_followup', 'onboarded', 'declined');
CREATE TYPE collection_status_enum AS ENUM ('pending', 'partial', 'full');
CREATE TYPE onboarding_status_enum AS ENUM ('not_started', 'scheduled', 'in_progress', 'completed');
CREATE TYPE meet_status_enum AS ENUM ('pending', 'completed', 'cancelled', 'no_show');
CREATE TYPE meeting_outcome_enum AS ENUM ('converted', 'no_conversion', 'pending', 'follow_up');
CREATE TYPE optin_status_enum AS ENUM ('new', 'contacted', 'interested', 'call_booked', 'payment_pending', 'payment_done', 'not_interested', 'no_response');
CREATE TYPE payment_done_status_enum AS ENUM ('new', 'contacted', 'call_scheduled', 'call_completed', 'no_response', 'rescheduled', 'not_reachable');

-- Payments
CREATE TYPE follow_up_status_enum AS ENUM ('pending', 'contacted', 'resolved', 'written_off', 'retry_sent');
CREATE TYPE invoice_follow_up_status_enum AS ENUM ('pending', 'contacted', 'partial_paid', 'paid', 'written_off', 'disputed');
CREATE TYPE period_type_enum AS ENUM ('daily', 'weekly', 'monthly');

-- Chat
CREATE TYPE channel_type_enum AS ENUM ('channel', 'dm', 'group');
CREATE TYPE presence_status_enum AS ENUM ('online', 'away', 'offline');

-- Content / Marketing
CREATE TYPE content_status_enum AS ENUM ('draft', 'in_progress', 'review', 'approved', 'published', 'archived');
CREATE TYPE social_platform_enum AS ENUM ('instagram', 'linkedin', 'youtube', 'twitter', 'facebook');

-- SEO
CREATE TYPE seo_task_type_enum AS ENUM ('on_page', 'technical', 'content', 'backlink', 'local_seo', 'other');
CREATE TYPE seo_task_status_enum AS ENUM ('todo', 'in_progress', 'done', 'blocked');
CREATE TYPE seo_keyword_status_enum AS ENUM ('tracking', 'improving', 'achieved', 'declined', 'paused');
CREATE TYPE seo_keyword_priority_enum AS ENUM ('high', 'medium', 'low');
CREATE TYPE seo_brief_status_enum AS ENUM ('draft', 'writing', 'review', 'published', 'archived');

-- Meta / Ads
CREATE TYPE meta_campaign_action_enum AS ENUM ('scale_up', 'scale_down', 'pause', 'restart', 'adjust_audience', 'adjust_creative', 'no_change', 'kill');
CREATE TYPE meta_creative_status_enum AS ENUM ('active', 'watch', 'fatigued', 'retired', 'top_performer');
CREATE TYPE meta_lead_quality_enum AS ENUM ('hot', 'warm', 'cold', 'junk');
CREATE TYPE meta_conversion_status_enum AS ENUM ('new', 'contacted', 'qualified', 'converted', 'lost');
CREATE TYPE anomaly_status_enum AS ENUM ('new', 'acknowledged', 'resolved', 'false_positive');

-- Notifications
CREATE TYPE notification_type_enum AS ENUM ('info', 'success', 'warning', 'error');

-- Email
CREATE TYPE email_send_status_enum AS ENUM ('queued', 'sent', 'failed', 'bounced');


-- ============================================================================
-- 2. CORE TABLES: Auth, Roles, Modules, Permissions
-- ============================================================================

-- Scope levels (admin, manager, employee, client)
CREATE TABLE scope_levels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  rank        INT NOT NULL,
  data_visibility data_visibility_enum NOT NULL,
  can_delete  BOOLEAN NOT NULL DEFAULT false,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Roles
CREATE TABLE roles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL UNIQUE,
  description    TEXT NOT NULL DEFAULT '',
  is_admin       BOOLEAN NOT NULL DEFAULT false,
  scope_level_id UUID REFERENCES scope_levels(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users (extends Supabase auth.users)
CREATE TABLE users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  full_name  TEXT NOT NULL,
  avatar_url TEXT,
  role_id    UUID REFERENCES roles(id) ON DELETE SET NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Modules (all 124 modules)
CREATE TABLE modules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT 'Folder',
  parent_slug TEXT,
  path        TEXT NOT NULL,
  "order"     INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Role-Module mapping (which roles can access which modules)
CREATE TABLE role_modules (
  role_id   UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, module_id)
);

-- User module overrides (per-user grant/revoke on top of role permissions)
CREATE TABLE user_module_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id   UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  access_type access_type_enum NOT NULL,
  granted_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_id)
);

-- Role-Module permissions (action-level permissions per role per module)
CREATE TABLE role_module_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module_id  UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  can_read   BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit   BOOLEAN NOT NULL DEFAULT false,
  can_approve BOOLEAN NOT NULL DEFAULT false,
  can_export BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role_id, module_id)
);

-- User permission overrides (per-user action-level overrides)
CREATE TABLE user_permission_overrides (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id  UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  action     permission_action_enum NOT NULL,
  granted    BOOLEAN NOT NULL DEFAULT false,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_id, action)
);


-- ============================================================================
-- 3. AUDIT LOGS
-- ============================================================================

CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tier            INT NOT NULL CHECK (tier IN (1, 2)),
  action          TEXT NOT NULL,
  module          TEXT NOT NULL DEFAULT '',
  breadcrumb_path TEXT NOT NULL DEFAULT '',
  entity_type     TEXT,
  entity_id       TEXT,
  details         JSONB DEFAULT '{}',
  before_value    JSONB,
  after_value     JSONB,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- 4. NOTIFICATIONS
-- ============================================================================

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  type        notification_type_enum NOT NULL DEFAULT 'info',
  module_slug TEXT,
  entity_id   TEXT,
  link        TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- 5. HR MODULE
-- ============================================================================

-- Departments
CREATE TABLE hr_departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  head_employee_id UUID, -- FK added after hr_employees creation
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Designations
CREATE TABLE hr_designations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  level         designation_level_enum NOT NULL DEFAULT 'mid',
  department_id UUID REFERENCES hr_departments(id) ON DELETE SET NULL,
  role_id       UUID REFERENCES roles(id) ON DELETE SET NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Employees
CREATE TABLE hr_employees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name       TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  department_id   UUID REFERENCES hr_departments(id) ON DELETE SET NULL,
  designation_id  UUID REFERENCES hr_designations(id) ON DELETE SET NULL,
  employment_type employment_type_enum NOT NULL DEFAULT 'full_time',
  join_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  exit_date       DATE,
  status          employee_status_enum NOT NULL DEFAULT 'active',
  reporting_to    UUID REFERENCES hr_employees(id) ON DELETE SET NULL,
  is_sales_rep    BOOLEAN NOT NULL DEFAULT false,
  avatar_url      TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Now add the deferred FK on hr_departments.head_employee_id
ALTER TABLE hr_departments
  ADD CONSTRAINT fk_dept_head
  FOREIGN KEY (head_employee_id) REFERENCES hr_employees(id) ON DELETE SET NULL;

-- Leave types
CREATE TABLE hr_leave_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  days_per_year INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leave requests
CREATE TABLE hr_leave_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES hr_leave_types(id) ON DELETE RESTRICT,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  days          NUMERIC(4,1) NOT NULL,
  reason        TEXT NOT NULL DEFAULT '',
  status        leave_status_enum NOT NULL DEFAULT 'pending',
  approved_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at   TIMESTAMPTZ,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leave balances
CREATE TABLE hr_leave_balances (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES hr_leave_types(id) ON DELETE RESTRICT,
  year          INT NOT NULL,
  total         NUMERIC(5,1) NOT NULL DEFAULT 0,
  used          NUMERIC(5,1) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, leave_type_id, year)
);

-- Holidays
CREATE TABLE hr_holidays (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  date        DATE NOT NULL,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Salaries
CREATE TABLE hr_salaries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  base_salary    BIGINT NOT NULL, -- paise
  effective_from DATE NOT NULL,
  effective_to   DATE,
  notes          TEXT NOT NULL DEFAULT '',
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Salary cycles (monthly payroll)
CREATE TABLE hr_salary_cycles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  cycle_month       TEXT NOT NULL, -- YYYY-MM
  base_amount       BIGINT NOT NULL DEFAULT 0, -- paise
  commission_amount BIGINT NOT NULL DEFAULT 0, -- paise
  deductions        BIGINT NOT NULL DEFAULT 0, -- paise
  net_amount        BIGINT NOT NULL DEFAULT 0, -- paise
  status            salary_cycle_status_enum NOT NULL DEFAULT 'pending',
  paid_date         DATE,
  notes             TEXT NOT NULL DEFAULT '',
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, cycle_month)
);

-- KPIs (Key Performance Indicators)
CREATE TABLE hr_kpis (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  department_id  UUID REFERENCES hr_departments(id) ON DELETE SET NULL,
  designation_id UUID REFERENCES hr_designations(id) ON DELETE SET NULL,
  unit           kpi_unit_enum NOT NULL DEFAULT 'count',
  target_value   NUMERIC(12,2) NOT NULL DEFAULT 0,
  frequency      kpi_frequency_enum NOT NULL DEFAULT 'monthly',
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- KPI entries (actual values per employee per period)
CREATE TABLE hr_kpi_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id       UUID NOT NULL REFERENCES hr_kpis(id) ON DELETE CASCADE,
  employee_id  UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  period       TEXT NOT NULL, -- YYYY-MM
  actual_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  target_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes        TEXT NOT NULL DEFAULT '',
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(kpi_id, employee_id, period)
);

-- KRAs (Key Result Areas)
CREATE TABLE hr_kras (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  weightage      NUMERIC(5,2) NOT NULL DEFAULT 0, -- percentage
  review_period  review_period_enum NOT NULL DEFAULT 'FY',
  self_rating    NUMERIC(3,1),
  manager_rating NUMERIC(3,1),
  status         kra_status_enum NOT NULL DEFAULT 'active',
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Commission rules
CREATE TABLE hr_commission_rules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID REFERENCES hr_employees(id) ON DELETE CASCADE,
  designation_id UUID REFERENCES hr_designations(id) ON DELETE CASCADE,
  rule_name      TEXT NOT NULL,
  type           commission_type_enum NOT NULL,
  value          NUMERIC(12,4), -- for percentage or flat
  slab_config    JSONB, -- [{min, max, rate}, ...]
  metric         TEXT NOT NULL DEFAULT 'sales',
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HR Settings (key-value store for module config)
CREATE TABLE hr_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT NOT NULL UNIQUE,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Attendance
CREATE TABLE hr_attendance (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  check_in     TIMESTAMPTZ,
  check_out    TIMESTAMPTZ,
  status       attendance_status_enum NOT NULL DEFAULT 'present',
  hours_worked NUMERIC(4,1),
  notes        TEXT NOT NULL DEFAULT '',
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);

-- Employee documents
CREATE TABLE hr_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  document_type document_type_enum NOT NULL DEFAULT 'other',
  file_url      TEXT NOT NULL,
  file_size     INT,
  uploaded_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes         TEXT NOT NULL DEFAULT '',
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- 6. FINANCE MODULE
-- ============================================================================

-- Expense categories
CREATE TABLE finance_expense_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  icon       TEXT NOT NULL DEFAULT 'Receipt',
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Expenses
CREATE TABLE finance_expenses (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id        UUID REFERENCES finance_expense_categories(id) ON DELETE SET NULL,
  title              TEXT NOT NULL,
  amount             BIGINT NOT NULL, -- paise
  date               DATE NOT NULL DEFAULT CURRENT_DATE,
  paid_by            TEXT NOT NULL DEFAULT '',
  receipt_url        TEXT,
  notes              TEXT NOT NULL DEFAULT '',
  is_recurring       BOOLEAN NOT NULL DEFAULT false,
  recurring_interval TEXT, -- monthly, quarterly, yearly
  status             expense_status_enum NOT NULL DEFAULT 'pending',
  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budgets
CREATE TABLE finance_budgets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  department_id  UUID REFERENCES hr_departments(id) ON DELETE SET NULL,
  month          DATE NOT NULL,
  planned_amount BIGINT NOT NULL DEFAULT 0, -- paise
  actual_amount  BIGINT NOT NULL DEFAULT 0, -- paise
  notes          TEXT NOT NULL DEFAULT '',
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- 7. TASKS MODULE
-- ============================================================================

-- Projects
CREATE TABLE task_projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'active',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks
CREATE TABLE tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES task_projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      task_status_enum NOT NULL DEFAULT 'todo',
  priority    task_priority_enum NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date    DATE,
  "order"     INT NOT NULL DEFAULT 0,
  tags        TEXT[] DEFAULT '{}',
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Task comments
CREATE TABLE task_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- 8. SALES MODULE
-- ============================================================================

-- Sales opportunities (master record from GHL sync)
CREATE TABLE sales_opportunities (
  id              TEXT PRIMARY KEY, -- GHL opportunity_id
  contact_name    TEXT NOT NULL DEFAULT '',
  contact_email   TEXT NOT NULL DEFAULT '',
  contact_phone   TEXT NOT NULL DEFAULT '',
  pipeline_id     TEXT NOT NULL DEFAULT '',
  pipeline_name   TEXT NOT NULL DEFAULT '',
  stage_name      TEXT NOT NULL DEFAULT '',
  source          TEXT NOT NULL DEFAULT '',
  status          sales_opportunity_status_enum NOT NULL DEFAULT 'pending_review',
  rating          INT,
  comments        TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT '',
  contact_id      TEXT NOT NULL DEFAULT '',
  assigned_to     TEXT, -- GHL user ID (not a Supabase UUID — used for client-side rep filtering)
  ghl_status      TEXT, -- raw GHL status
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales deal tracking (per opportunity, per rep)
CREATE TABLE sales_deals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id    TEXT NOT NULL REFERENCES sales_opportunities(id) ON DELETE CASCADE,
  sales_rep_id      UUID REFERENCES hr_employees(id) ON DELETE SET NULL,
  closed_date       DATE,
  fees_quoted       BIGINT NOT NULL DEFAULT 0, -- paise
  fees_collected    BIGINT NOT NULL DEFAULT 0, -- paise
  pending_amount    BIGINT NOT NULL DEFAULT 0, -- paise
  payment_mode      TEXT NOT NULL DEFAULT '',
  invoice_number    TEXT,
  collection_status collection_status_enum NOT NULL DEFAULT 'pending',
  onboarding_status onboarding_status_enum NOT NULL DEFAULT 'not_started',
  notes             TEXT NOT NULL DEFAULT '',
  contact_email     TEXT NOT NULL DEFAULT '',
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(opportunity_id, sales_rep_id)
);

-- Sales meeting tracking (per opportunity, per rep)
CREATE TABLE sales_meetings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  TEXT NOT NULL REFERENCES sales_opportunities(id) ON DELETE CASCADE,
  sales_rep_id    UUID REFERENCES hr_employees(id) ON DELETE SET NULL,
  meet_status     meet_status_enum NOT NULL DEFAULT 'pending',
  meet_notes      TEXT NOT NULL DEFAULT '',
  meet_date       TIMESTAMPTZ,
  follow_up_date  DATE,
  outcome         TEXT NOT NULL DEFAULT '',
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(opportunity_id, sales_rep_id)
);

-- Meeting analysis sheet
CREATE TABLE sales_meeting_analysis (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_rep_id      UUID REFERENCES hr_employees(id) ON DELETE SET NULL,
  opportunity_id    TEXT REFERENCES sales_opportunities(id) ON DELETE SET NULL,
  contact_id        TEXT NOT NULL DEFAULT '',
  calendar_event_id TEXT,
  meet_date         TIMESTAMPTZ,
  contact_name      TEXT NOT NULL DEFAULT '',
  contact_email     TEXT NOT NULL DEFAULT '',
  contact_phone     TEXT NOT NULL DEFAULT '',
  meeting_link      TEXT,
  recording_url     TEXT,
  meeting_duration  INT,
  score             INT,
  next_steps        TEXT NOT NULL DEFAULT '',
  follow_up_date    DATE,
  notes             TEXT NOT NULL DEFAULT '',
  outcome           meeting_outcome_enum NOT NULL DEFAULT 'pending',
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Onboarding tracking
CREATE TABLE sales_onboarding (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id    TEXT REFERENCES sales_opportunities(id) ON DELETE SET NULL,
  contact_name      TEXT NOT NULL DEFAULT '',
  contact_email     TEXT NOT NULL DEFAULT '',
  contact_phone     TEXT NOT NULL DEFAULT '',
  source_rep_id     UUID REFERENCES hr_employees(id) ON DELETE SET NULL,
  fees_quoted       BIGINT NOT NULL DEFAULT 0, -- paise
  fees_collected    BIGINT NOT NULL DEFAULT 0, -- paise
  onboarding_status onboarding_status_enum NOT NULL DEFAULT 'scheduled',
  checklist         JSONB NOT NULL DEFAULT '[]', -- [{id, label, done}]
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Opt-in tracking
CREATE TABLE sales_optins (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id   TEXT REFERENCES sales_opportunities(id) ON DELETE SET NULL,
  contact_name     TEXT NOT NULL DEFAULT '',
  contact_email    TEXT NOT NULL DEFAULT '',
  contact_phone    TEXT NOT NULL DEFAULT '',
  pipeline_name    TEXT NOT NULL DEFAULT '',
  stage_name       TEXT NOT NULL DEFAULT '',
  source           TEXT NOT NULL DEFAULT '',
  monetary_value   BIGINT NOT NULL DEFAULT 0, -- paise
  status           optin_status_enum NOT NULL DEFAULT 'new',
  notes            TEXT NOT NULL DEFAULT '',
  last_contacted_at TIMESTAMPTZ,
  assigned_to      TEXT, -- GHL user ID
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payment-done tracking
CREATE TABLE sales_payment_done (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id     TEXT REFERENCES sales_opportunities(id) ON DELETE SET NULL,
  contact_name       TEXT NOT NULL DEFAULT '',
  contact_email      TEXT NOT NULL DEFAULT '',
  contact_phone      TEXT NOT NULL DEFAULT '',
  pipeline_name      TEXT NOT NULL DEFAULT '',
  stage_name         TEXT NOT NULL DEFAULT '',
  source             TEXT NOT NULL DEFAULT '',
  status             payment_done_status_enum NOT NULL DEFAULT 'new',
  notes              TEXT NOT NULL DEFAULT '',
  last_contacted_at  TIMESTAMPTZ,
  call_scheduled_at  TIMESTAMPTZ,
  assigned_to        TEXT, -- GHL user ID
  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- 9. PAYMENTS MODULE
-- ============================================================================

-- Daily collection log
CREATE TABLE payments_daily_collection (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_name TEXT NOT NULL,
  amount       BIGINT NOT NULL, -- paise
  payment_mode TEXT NOT NULL DEFAULT '',
  reference_id TEXT,
  bank_confirmed BOOLEAN NOT NULL DEFAULT false,
  reconciled   BOOLEAN NOT NULL DEFAULT false,
  notes        TEXT NOT NULL DEFAULT '',
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Failed payment tracking
CREATE TABLE payments_failed_tracking (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_payment_id TEXT NOT NULL UNIQUE,
  contact_name        TEXT NOT NULL DEFAULT '',
  contact_email       TEXT NOT NULL DEFAULT '',
  contact_phone       TEXT NOT NULL DEFAULT '',
  amount              BIGINT NOT NULL, -- paise
  original_status     TEXT NOT NULL DEFAULT '',
  follow_up_status    follow_up_status_enum NOT NULL DEFAULT 'pending',
  contacted_at        TIMESTAMPTZ,
  resolved_at         TIMESTAMPTZ,
  retry_payment_link_id  TEXT,
  retry_payment_link_url TEXT,
  notes               TEXT NOT NULL DEFAULT '',
  assigned_to         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invoice follow-ups
CREATE TABLE payments_invoice_follow_ups (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_invoice_id TEXT NOT NULL UNIQUE,
  customer_name       TEXT NOT NULL DEFAULT '',
  customer_email      TEXT NOT NULL DEFAULT '',
  customer_phone      TEXT NOT NULL DEFAULT '',
  amount_due          BIGINT NOT NULL DEFAULT 0, -- paise
  due_date            DATE,
  follow_up_status    invoice_follow_up_status_enum NOT NULL DEFAULT 'pending',
  follow_up_count     INT NOT NULL DEFAULT 0,
  last_contacted_at   TIMESTAMPTZ,
  next_follow_up_date DATE,
  notes               TEXT NOT NULL DEFAULT '',
  assigned_to         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Revenue targets
CREATE TABLE payments_revenue_targets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type   period_type_enum NOT NULL,
  period_start  DATE NOT NULL,
  target_amount BIGINT NOT NULL, -- paise
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payment amount groups (for analytics bucketing)
CREATE TABLE payments_amount_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  min_amount BIGINT, -- paise, nullable for "below X"
  max_amount BIGINT, -- paise, nullable for "above X"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- 10. CHAT MODULE
-- ============================================================================

-- Chat channels
CREATE TABLE chat_channels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  type            channel_type_enum NOT NULL DEFAULT 'channel',
  is_private      BOOLEAN NOT NULL DEFAULT false,
  is_announcement BOOLEAN NOT NULL DEFAULT false,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chat channel members
CREATE TABLE chat_channel_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member', -- admin, member
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  UNIQUE(channel_id, user_id)
);

-- Chat messages
CREATE TABLE chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id      UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL DEFAULT '',
  attachment_url  TEXT,
  attachment_type TEXT,
  parent_id       UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  reply_count     INT NOT NULL DEFAULT 0,
  is_deleted      BOOLEAN NOT NULL DEFAULT false,
  edited_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chat reactions
CREATE TABLE chat_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Chat pins
CREATE TABLE chat_pins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  pinned_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel_id, message_id)
);

-- Chat drafts
CREATE TABLE chat_drafts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Chat read cursors
CREATE TABLE chat_read_cursors (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id           UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Chat reminders
CREATE TABLE chat_reminders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id   UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  remind_at    TIMESTAMPTZ NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chat saved messages
CREATE TABLE chat_saved_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_id)
);

-- Chat presence
CREATE TABLE chat_presence (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status       presence_status_enum NOT NULL DEFAULT 'offline',
  custom_text  TEXT,
  custom_emoji TEXT,
  typing_in    UUID REFERENCES chat_channels(id) ON DELETE SET NULL,
  expires_at   TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chat notification preferences
CREATE TABLE chat_notification_prefs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  muted      BOOLEAN NOT NULL DEFAULT false,
  mute_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, channel_id)
);


-- ============================================================================
-- 11. MARKETING / CONTENT MODULE
-- ============================================================================

-- Content ads
CREATE TABLE content_ads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  platform        TEXT NOT NULL DEFAULT '',
  ad_type         TEXT NOT NULL DEFAULT '',
  status          content_status_enum NOT NULL DEFAULT 'draft',
  media_url       TEXT,
  copy_text       TEXT NOT NULL DEFAULT '',
  target_audience TEXT NOT NULL DEFAULT '',
  budget          BIGINT NOT NULL DEFAULT 0, -- paise
  start_date      DATE,
  end_date        DATE,
  assigned_to     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes           TEXT NOT NULL DEFAULT '',
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Content social posts
CREATE TABLE content_social_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform     social_platform_enum NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  status       content_status_enum NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  media_url    TEXT,
  post_url     TEXT,
  assigned_to  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes        TEXT NOT NULL DEFAULT '',
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Content SOP tracker
CREATE TABLE content_sop_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  platform    social_platform_enum NOT NULL,
  status      content_status_enum NOT NULL DEFAULT 'draft',
  due_date    DATE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes       TEXT NOT NULL DEFAULT '',
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Video editing projects
CREATE TABLE content_video_projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  status      content_status_enum NOT NULL DEFAULT 'draft',
  platform    TEXT NOT NULL DEFAULT '',
  due_date    DATE,
  editor_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  footage_url TEXT,
  final_url   TEXT,
  notes       TEXT NOT NULL DEFAULT '',
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- 12. SEO MODULE
-- ============================================================================

-- SEO keyword tracker
CREATE TABLE seo_keyword_tracker (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword          TEXT NOT NULL,
  url              TEXT,
  current_position INT,
  target_position  INT,
  search_volume    INT,
  status           seo_keyword_status_enum NOT NULL DEFAULT 'tracking',
  priority         seo_keyword_priority_enum NOT NULL DEFAULT 'medium',
  notes            TEXT NOT NULL DEFAULT '',
  assigned_to      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SEO task log
CREATE TABLE seo_task_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  task_type   seo_task_type_enum NOT NULL DEFAULT 'other',
  status      seo_task_status_enum NOT NULL DEFAULT 'todo',
  page_url    TEXT,
  keyword     TEXT,
  due_date    DATE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes       TEXT NOT NULL DEFAULT '',
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SEO competitor tracker
CREATE TABLE seo_competitor_tracker (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_domain   TEXT NOT NULL,
  keyword             TEXT NOT NULL,
  our_position        INT,
  competitor_position INT,
  gap                 INT, -- competitor_position - our_position
  notes               TEXT NOT NULL DEFAULT '',
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SEO content briefs
CREATE TABLE seo_content_briefs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  target_keyword    TEXT NOT NULL DEFAULT '',
  target_url        TEXT,
  status            seo_brief_status_enum NOT NULL DEFAULT 'draft',
  word_count_target INT,
  word_count_actual INT,
  assigned_to       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes             TEXT NOT NULL DEFAULT '',
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SEO page health
CREATE TABLE seo_page_health (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url             TEXT NOT NULL,
  status_code     INT,
  load_time_ms    INT,
  mobile_score    INT,
  desktop_score   INT,
  issues          JSONB DEFAULT '[]',
  last_checked_at TIMESTAMPTZ,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SEO daily metrics
CREATE TABLE seo_daily_metrics (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date               DATE NOT NULL UNIQUE,
  organic_clicks     INT NOT NULL DEFAULT 0,
  organic_impressions INT NOT NULL DEFAULT 0,
  avg_position       NUMERIC(5,2),
  indexed_pages      INT,
  notes              TEXT NOT NULL DEFAULT '',
  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- 13. META / ADS MODULE
-- ============================================================================

-- Meta campaign tracker (internal decision log)
CREATE TABLE meta_campaign_tracker (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   TEXT NOT NULL,
  campaign_name TEXT NOT NULL DEFAULT '',
  log_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  action        meta_campaign_action_enum NOT NULL DEFAULT 'no_change',
  notes         TEXT NOT NULL DEFAULT '',
  decided_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Meta creative tracker
CREATE TABLE meta_creative_tracker (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id         TEXT NOT NULL,
  ad_name       TEXT NOT NULL DEFAULT '',
  campaign_name TEXT NOT NULL DEFAULT '',
  status        meta_creative_status_enum NOT NULL DEFAULT 'active',
  fatigue_score INT,
  notes         TEXT NOT NULL DEFAULT '',
  reviewed_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Meta budget plans
CREATE TABLE meta_budget_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   TEXT NOT NULL DEFAULT '',
  campaign_name TEXT NOT NULL DEFAULT '',
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  planned_budget BIGINT NOT NULL DEFAULT 0, -- paise
  actual_spend  BIGINT NOT NULL DEFAULT 0, -- paise
  notes         TEXT NOT NULL DEFAULT '',
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Meta conversion log
CREATE TABLE meta_conversion_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  campaign_id       TEXT NOT NULL DEFAULT '',
  campaign_name     TEXT NOT NULL DEFAULT '',
  lead_name         TEXT NOT NULL DEFAULT '',
  lead_phone        TEXT NOT NULL DEFAULT '',
  lead_email        TEXT NOT NULL DEFAULT '',
  lead_quality      meta_lead_quality_enum NOT NULL DEFAULT 'cold',
  conversion_status meta_conversion_status_enum NOT NULL DEFAULT 'new',
  revenue_amount    BIGINT NOT NULL DEFAULT 0, -- paise
  notes             TEXT NOT NULL DEFAULT '',
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Meta spend forecast
CREATE TABLE meta_spend_forecast (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month           DATE NOT NULL,
  campaign_id     TEXT NOT NULL DEFAULT '',
  campaign_name   TEXT NOT NULL DEFAULT '',
  projected_spend BIGINT NOT NULL DEFAULT 0, -- paise
  projected_roas  NUMERIC(6,2),
  notes           TEXT NOT NULL DEFAULT '',
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Meta anomaly alerts
CREATE TABLE meta_anomaly_alerts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    TEXT NOT NULL DEFAULT '',
  campaign_name  TEXT NOT NULL DEFAULT '',
  metric         TEXT NOT NULL,
  expected_value NUMERIC(12,2),
  actual_value   NUMERIC(12,2),
  deviation_pct  NUMERIC(6,2),
  detected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status         anomaly_status_enum NOT NULL DEFAULT 'new',
  notes          TEXT NOT NULL DEFAULT '',
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- 14. ANALYTICS MODULE
-- ============================================================================

-- Analytics daily sheet
CREATE TABLE analytics_daily_sheet (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_date       DATE NOT NULL UNIQUE,
  meta_spend       NUMERIC(12,2) NOT NULL DEFAULT 0,
  meta_leads       INT NOT NULL DEFAULT 0,
  meta_cpl         NUMERIC(12,2) NOT NULL DEFAULT 0,
  meetings_booked  INT NOT NULL DEFAULT 0,
  meetings_done    INT NOT NULL DEFAULT 0,
  showups          INT NOT NULL DEFAULT 0,
  converted        INT NOT NULL DEFAULT 0,
  amount_collected NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes            TEXT NOT NULL DEFAULT '',
  extra_data       JSONB DEFAULT '{}',
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Analytics cohort metrics
CREATE TABLE analytics_cohort_metrics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date              DATE NOT NULL UNIQUE,
  ad_spend          NUMERIC(12,2) NOT NULL DEFAULT 0,
  impressions       INT NOT NULL DEFAULT 0,
  clicks            INT NOT NULL DEFAULT 0,
  reach             INT NOT NULL DEFAULT 0,
  optins            INT NOT NULL DEFAULT 0,
  meetings_booked   INT NOT NULL DEFAULT 0,
  calls_completed   INT NOT NULL DEFAULT 0,
  show_ups          INT NOT NULL DEFAULT 0,
  admissions        INT NOT NULL DEFAULT 0,
  revenue_collected NUMERIC(12,2) NOT NULL DEFAULT 0,
  payments          INT NOT NULL DEFAULT 0,
  last_synced_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- 15. AUTOMATIONS MODULE
-- ============================================================================

-- Email templates
CREATE TABLE email_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  subject    TEXT NOT NULL DEFAULT '',
  html_body  TEXT NOT NULL DEFAULT '',
  variables  JSONB NOT NULL DEFAULT '[]', -- list of variable names
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sent emails log
CREATE TABLE sent_emails (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  recipient_name  TEXT NOT NULL DEFAULT '',
  subject         TEXT NOT NULL,
  variables       JSONB DEFAULT '{}',
  status          email_send_status_enum NOT NULL DEFAULT 'queued',
  sent_at         TIMESTAMPTZ,
  error           TEXT,
  resend_id       TEXT, -- Resend API message ID
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- 16. INDEXES
-- ============================================================================

-- Core
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_modules_parent ON modules(parent_slug);
CREATE INDEX idx_modules_order ON modules("order");
CREATE INDEX idx_roles_scope_level ON roles(scope_level_id);
CREATE INDEX idx_user_module_overrides_user ON user_module_overrides(user_id);
CREATE INDEX idx_user_module_overrides_module ON user_module_overrides(module_id);
CREATE INDEX idx_role_module_permissions_role ON role_module_permissions(role_id);
CREATE INDEX idx_role_module_permissions_module ON role_module_permissions(module_id);
CREATE INDEX idx_user_permission_overrides_user ON user_permission_overrides(user_id);
CREATE INDEX idx_user_permission_overrides_module ON user_permission_overrides(module_id);

-- Audit logs
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_tier ON audit_logs(tier);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_module ON audit_logs(module);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- HR
CREATE INDEX idx_hr_employees_user ON hr_employees(user_id);
CREATE INDEX idx_hr_employees_department ON hr_employees(department_id);
CREATE INDEX idx_hr_employees_designation ON hr_employees(designation_id);
CREATE INDEX idx_hr_employees_reporting_to ON hr_employees(reporting_to);
CREATE INDEX idx_hr_employees_status ON hr_employees(status);
CREATE INDEX idx_hr_employees_sales_rep ON hr_employees(is_sales_rep);
CREATE INDEX idx_hr_designations_department ON hr_designations(department_id);
CREATE INDEX idx_hr_designations_role ON hr_designations(role_id);
CREATE INDEX idx_hr_departments_head ON hr_departments(head_employee_id);
CREATE INDEX idx_hr_leave_requests_employee ON hr_leave_requests(employee_id);
CREATE INDEX idx_hr_leave_requests_type ON hr_leave_requests(leave_type_id);
CREATE INDEX idx_hr_leave_requests_status ON hr_leave_requests(status);
CREATE INDEX idx_hr_leave_balances_employee ON hr_leave_balances(employee_id);
CREATE INDEX idx_hr_leave_balances_type ON hr_leave_balances(leave_type_id);
CREATE INDEX idx_hr_salaries_employee ON hr_salaries(employee_id);
CREATE INDEX idx_hr_salary_cycles_employee ON hr_salary_cycles(employee_id);
CREATE INDEX idx_hr_salary_cycles_month ON hr_salary_cycles(cycle_month);
CREATE INDEX idx_hr_kpis_department ON hr_kpis(department_id);
CREATE INDEX idx_hr_kpis_designation ON hr_kpis(designation_id);
CREATE INDEX idx_hr_kpi_entries_kpi ON hr_kpi_entries(kpi_id);
CREATE INDEX idx_hr_kpi_entries_employee ON hr_kpi_entries(employee_id);
CREATE INDEX idx_hr_kras_employee ON hr_kras(employee_id);
CREATE INDEX idx_hr_commission_rules_employee ON hr_commission_rules(employee_id);
CREATE INDEX idx_hr_commission_rules_designation ON hr_commission_rules(designation_id);
CREATE INDEX idx_hr_attendance_employee ON hr_attendance(employee_id);
CREATE INDEX idx_hr_attendance_date ON hr_attendance(date);
CREATE INDEX idx_hr_attendance_status ON hr_attendance(status);
CREATE INDEX idx_hr_attendance_created_by ON hr_attendance(created_by);
CREATE INDEX idx_hr_documents_employee ON hr_documents(employee_id);
CREATE INDEX idx_hr_documents_type ON hr_documents(document_type);
CREATE INDEX idx_hr_documents_uploaded_by ON hr_documents(uploaded_by);
CREATE INDEX idx_hr_documents_created_by ON hr_documents(created_by);

-- Finance
CREATE INDEX idx_finance_expenses_category ON finance_expenses(category_id);
CREATE INDEX idx_finance_expenses_date ON finance_expenses(date);
CREATE INDEX idx_finance_expenses_status ON finance_expenses(status);
CREATE INDEX idx_finance_expenses_created_by ON finance_expenses(created_by);
CREATE INDEX idx_finance_budgets_department ON finance_budgets(department_id);
CREATE INDEX idx_finance_budgets_month ON finance_budgets(month);
CREATE INDEX idx_finance_budgets_created_by ON finance_budgets(created_by);

-- Tasks
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_task_comments_task ON task_comments(task_id);
CREATE INDEX idx_task_comments_user ON task_comments(user_id);

-- Sales
CREATE INDEX idx_sales_opportunities_assigned ON sales_opportunities(assigned_to);
CREATE INDEX idx_sales_opportunities_status ON sales_opportunities(status);
CREATE INDEX idx_sales_deals_opportunity ON sales_deals(opportunity_id);
CREATE INDEX idx_sales_deals_rep ON sales_deals(sales_rep_id);
CREATE INDEX idx_sales_meetings_opportunity ON sales_meetings(opportunity_id);
CREATE INDEX idx_sales_meetings_rep ON sales_meetings(sales_rep_id);
CREATE INDEX idx_sales_meeting_analysis_rep ON sales_meeting_analysis(sales_rep_id);
CREATE INDEX idx_sales_meeting_analysis_opportunity ON sales_meeting_analysis(opportunity_id);
CREATE UNIQUE INDEX idx_sales_meeting_analysis_event ON sales_meeting_analysis(calendar_event_id) WHERE calendar_event_id IS NOT NULL;
CREATE INDEX idx_sales_onboarding_opportunity ON sales_onboarding(opportunity_id);
CREATE INDEX idx_sales_onboarding_rep ON sales_onboarding(source_rep_id);
CREATE UNIQUE INDEX idx_sales_optins_opportunity ON sales_optins(opportunity_id);
CREATE INDEX idx_sales_optins_assigned ON sales_optins(assigned_to);
CREATE UNIQUE INDEX idx_sales_payment_done_opportunity ON sales_payment_done(opportunity_id);
CREATE INDEX idx_sales_payment_done_assigned ON sales_payment_done(assigned_to);

-- Payments
CREATE INDEX idx_payments_daily_collection_date ON payments_daily_collection(log_date);
CREATE INDEX idx_payments_daily_collection_created_by ON payments_daily_collection(created_by);
CREATE INDEX idx_payments_failed_tracking_status ON payments_failed_tracking(follow_up_status);
CREATE INDEX idx_payments_failed_tracking_created_by ON payments_failed_tracking(created_by);
CREATE INDEX idx_payments_invoice_follow_ups_status ON payments_invoice_follow_ups(follow_up_status);
CREATE INDEX idx_payments_invoice_follow_ups_created_by ON payments_invoice_follow_ups(created_by);
CREATE INDEX idx_payments_revenue_targets_period ON payments_revenue_targets(period_start);
CREATE INDEX idx_payments_revenue_targets_created_by ON payments_revenue_targets(created_by);

-- Chat
CREATE INDEX idx_chat_channel_members_channel ON chat_channel_members(channel_id);
CREATE INDEX idx_chat_channel_members_user ON chat_channel_members(user_id);
CREATE INDEX idx_chat_messages_channel ON chat_messages(channel_id);
CREATE INDEX idx_chat_messages_user ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_parent ON chat_messages(parent_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at DESC);
CREATE INDEX idx_chat_reactions_message ON chat_reactions(message_id);
CREATE INDEX idx_chat_pins_channel ON chat_pins(channel_id);
CREATE INDEX idx_chat_drafts_channel ON chat_drafts(channel_id);
CREATE INDEX idx_chat_drafts_user ON chat_drafts(user_id);
CREATE INDEX idx_chat_read_cursors_channel ON chat_read_cursors(channel_id);
CREATE INDEX idx_chat_read_cursors_user ON chat_read_cursors(user_id);
CREATE INDEX idx_chat_reminders_user ON chat_reminders(user_id);
CREATE INDEX idx_chat_reminders_remind_at ON chat_reminders(remind_at);
CREATE INDEX idx_chat_saved_messages_user ON chat_saved_messages(user_id);
CREATE INDEX idx_chat_notification_prefs_user ON chat_notification_prefs(user_id);
CREATE INDEX idx_chat_notification_prefs_channel ON chat_notification_prefs(channel_id);

-- Content / Marketing
CREATE INDEX idx_content_ads_status ON content_ads(status);
CREATE INDEX idx_content_ads_assigned ON content_ads(assigned_to);
CREATE INDEX idx_content_ads_created_by ON content_ads(created_by);
CREATE INDEX idx_content_social_posts_platform ON content_social_posts(platform);
CREATE INDEX idx_content_social_posts_status ON content_social_posts(status);
CREATE INDEX idx_content_social_posts_created_by ON content_social_posts(created_by);
CREATE INDEX idx_content_sop_entries_status ON content_sop_entries(status);
CREATE INDEX idx_content_sop_entries_created_by ON content_sop_entries(created_by);
CREATE INDEX idx_content_video_projects_status ON content_video_projects(status);
CREATE INDEX idx_content_video_projects_created_by ON content_video_projects(created_by);

-- SEO
CREATE INDEX idx_seo_keyword_tracker_status ON seo_keyword_tracker(status);
CREATE INDEX idx_seo_keyword_tracker_created_by ON seo_keyword_tracker(created_by);
CREATE INDEX idx_seo_task_log_status ON seo_task_log(status);
CREATE INDEX idx_seo_task_log_assigned ON seo_task_log(assigned_to);
CREATE INDEX idx_seo_task_log_created_by ON seo_task_log(created_by);
CREATE INDEX idx_seo_competitor_tracker_created_by ON seo_competitor_tracker(created_by);
CREATE INDEX idx_seo_content_briefs_status ON seo_content_briefs(status);
CREATE INDEX idx_seo_content_briefs_created_by ON seo_content_briefs(created_by);
CREATE INDEX idx_seo_page_health_created_by ON seo_page_health(created_by);
CREATE INDEX idx_seo_daily_metrics_date ON seo_daily_metrics(date);

-- Meta
CREATE INDEX idx_meta_campaign_tracker_campaign ON meta_campaign_tracker(campaign_id);
CREATE INDEX idx_meta_campaign_tracker_date ON meta_campaign_tracker(log_date);
CREATE INDEX idx_meta_creative_tracker_ad ON meta_creative_tracker(ad_id);
CREATE INDEX idx_meta_creative_tracker_status ON meta_creative_tracker(status);
CREATE INDEX idx_meta_budget_plans_campaign ON meta_budget_plans(campaign_id);
CREATE INDEX idx_meta_budget_plans_created_by ON meta_budget_plans(created_by);
CREATE INDEX idx_meta_conversion_log_date ON meta_conversion_log(date);
CREATE INDEX idx_meta_conversion_log_campaign ON meta_conversion_log(campaign_id);
CREATE INDEX idx_meta_conversion_log_created_by ON meta_conversion_log(created_by);
CREATE INDEX idx_meta_spend_forecast_month ON meta_spend_forecast(month);
CREATE INDEX idx_meta_anomaly_alerts_campaign ON meta_anomaly_alerts(campaign_id);
CREATE INDEX idx_meta_anomaly_alerts_status ON meta_anomaly_alerts(status);

-- Analytics
CREATE INDEX idx_analytics_daily_sheet_date ON analytics_daily_sheet(sheet_date);
CREATE INDEX idx_analytics_cohort_metrics_month ON analytics_cohort_metrics(cohort_month);

-- Automations
CREATE INDEX idx_email_templates_slug ON email_templates(slug);
CREATE INDEX idx_sent_emails_template ON sent_emails(template_id);
CREATE INDEX idx_sent_emails_recipient ON sent_emails(recipient_email);
CREATE INDEX idx_sent_emails_status ON sent_emails(status);
CREATE INDEX idx_sent_emails_created_by ON sent_emails(created_by);


-- ============================================================================
-- 17. UPDATED_AT TRIGGERS
-- ============================================================================

CREATE TRIGGER trg_scope_levels_updated_at BEFORE UPDATE ON scope_levels FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_modules_updated_at BEFORE UPDATE ON modules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_role_module_permissions_updated_at BEFORE UPDATE ON role_module_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hr_departments_updated_at BEFORE UPDATE ON hr_departments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hr_designations_updated_at BEFORE UPDATE ON hr_designations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hr_employees_updated_at BEFORE UPDATE ON hr_employees FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hr_leave_types_updated_at BEFORE UPDATE ON hr_leave_types FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hr_leave_requests_updated_at BEFORE UPDATE ON hr_leave_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hr_leave_balances_updated_at BEFORE UPDATE ON hr_leave_balances FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hr_holidays_updated_at BEFORE UPDATE ON hr_holidays FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hr_salaries_updated_at BEFORE UPDATE ON hr_salaries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hr_salary_cycles_updated_at BEFORE UPDATE ON hr_salary_cycles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hr_kpis_updated_at BEFORE UPDATE ON hr_kpis FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hr_kpi_entries_updated_at BEFORE UPDATE ON hr_kpi_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hr_kras_updated_at BEFORE UPDATE ON hr_kras FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hr_commission_rules_updated_at BEFORE UPDATE ON hr_commission_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hr_settings_updated_at BEFORE UPDATE ON hr_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hr_attendance_updated_at BEFORE UPDATE ON hr_attendance FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hr_documents_updated_at BEFORE UPDATE ON hr_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_finance_expense_categories_updated_at BEFORE UPDATE ON finance_expense_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_finance_expenses_updated_at BEFORE UPDATE ON finance_expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_finance_budgets_updated_at BEFORE UPDATE ON finance_budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_task_projects_updated_at BEFORE UPDATE ON task_projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_task_comments_updated_at BEFORE UPDATE ON task_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sales_opportunities_updated_at BEFORE UPDATE ON sales_opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sales_deals_updated_at BEFORE UPDATE ON sales_deals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sales_meetings_updated_at BEFORE UPDATE ON sales_meetings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sales_meeting_analysis_updated_at BEFORE UPDATE ON sales_meeting_analysis FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sales_onboarding_updated_at BEFORE UPDATE ON sales_onboarding FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sales_optins_updated_at BEFORE UPDATE ON sales_optins FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sales_payment_done_updated_at BEFORE UPDATE ON sales_payment_done FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_payments_daily_collection_updated_at BEFORE UPDATE ON payments_daily_collection FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_payments_failed_tracking_updated_at BEFORE UPDATE ON payments_failed_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_payments_invoice_follow_ups_updated_at BEFORE UPDATE ON payments_invoice_follow_ups FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_payments_revenue_targets_updated_at BEFORE UPDATE ON payments_revenue_targets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_chat_channels_updated_at BEFORE UPDATE ON chat_channels FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_chat_messages_updated_at BEFORE UPDATE ON chat_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_chat_drafts_updated_at BEFORE UPDATE ON chat_drafts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_chat_notification_prefs_updated_at BEFORE UPDATE ON chat_notification_prefs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_content_ads_updated_at BEFORE UPDATE ON content_ads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_content_social_posts_updated_at BEFORE UPDATE ON content_social_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_content_sop_entries_updated_at BEFORE UPDATE ON content_sop_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_content_video_projects_updated_at BEFORE UPDATE ON content_video_projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_seo_keyword_tracker_updated_at BEFORE UPDATE ON seo_keyword_tracker FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_seo_task_log_updated_at BEFORE UPDATE ON seo_task_log FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_seo_competitor_tracker_updated_at BEFORE UPDATE ON seo_competitor_tracker FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_seo_content_briefs_updated_at BEFORE UPDATE ON seo_content_briefs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_seo_page_health_updated_at BEFORE UPDATE ON seo_page_health FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_seo_daily_metrics_updated_at BEFORE UPDATE ON seo_daily_metrics FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_meta_campaign_tracker_updated_at BEFORE UPDATE ON meta_campaign_tracker FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_meta_creative_tracker_updated_at BEFORE UPDATE ON meta_creative_tracker FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_meta_budget_plans_updated_at BEFORE UPDATE ON meta_budget_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_meta_conversion_log_updated_at BEFORE UPDATE ON meta_conversion_log FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_meta_spend_forecast_updated_at BEFORE UPDATE ON meta_spend_forecast FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_meta_anomaly_alerts_updated_at BEFORE UPDATE ON meta_anomaly_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_analytics_daily_sheet_updated_at BEFORE UPDATE ON analytics_daily_sheet FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_analytics_cohort_metrics_updated_at BEFORE UPDATE ON analytics_cohort_metrics FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_email_templates_updated_at BEFORE UPDATE ON email_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================================
-- 18. ROW LEVEL SECURITY (safety net — API routes use supabaseAdmin)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE scope_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_module_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_module_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_salary_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_kpi_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_kras ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_meeting_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_optins ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_payment_done ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments_daily_collection ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments_failed_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments_invoice_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments_revenue_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments_amount_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_read_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_saved_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_notification_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_sop_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_video_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_keyword_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_task_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_competitor_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_content_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_page_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_campaign_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_creative_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_budget_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_conversion_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_spend_forecast ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_anomaly_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily_sheet ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_cohort_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_emails ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS. These policies are a safety net for browser client access.
-- Authenticated users can read reference tables
CREATE POLICY "auth_read_scope_levels" ON scope_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_roles" ON roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_modules" ON modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_role_modules" ON role_modules FOR SELECT TO authenticated USING (true);

-- Users can read their own profile
CREATE POLICY "users_read_own" ON users FOR SELECT TO authenticated USING (auth.uid() = id);

-- Users can read their own notifications
CREATE POLICY "notifications_read_own" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Service role has full access (all API routes use supabaseAdmin)
-- No additional policies needed — supabaseAdmin bypasses RLS entirely


-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
