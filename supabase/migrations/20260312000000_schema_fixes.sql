-- =============================================
-- Schema Fixes
-- 1. updated_at triggers for all tables that have the column but no trigger
-- 2. Fix expenses.status default (approved → pending)
-- 3. Re-grant HR Settings module to admin roles (is_admin column doesn't exist)
-- 4. Add updated_at to projects and budgets
-- 5. Add missing indexes
-- =============================================

-- ── 1. updated_at triggers ───────────────────────────────────

CREATE TRIGGER set_updated_at_hr_departments
  BEFORE UPDATE ON hr_departments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_hr_employees
  BEFORE UPDATE ON hr_employees FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_hr_commission_rules
  BEFORE UPDATE ON hr_commission_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_hr_salary_cycles
  BEFORE UPDATE ON hr_salary_cycles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_hr_kpi_entries
  BEFORE UPDATE ON hr_kpi_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_hr_kras
  BEFORE UPDATE ON hr_kras FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_tasks
  BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 2. Fix expenses.status default ───────────────────────────

ALTER TABLE expenses ALTER COLUMN status SET DEFAULT 'pending';

-- ── 3. Re-grant HR Settings to admin roles ────────────────────
-- hr_settings_bridge.sql used r.is_admin which doesn't exist on the roles table.
-- Re-run using role name instead.

INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r, modules m
WHERE r.name IN ('CTO', 'Admin') AND m.slug = 'hr-settings'
ON CONFLICT (role_id, module_id) DO NOTHING;

-- ── 4. Add updated_at to projects and budgets ─────────────────

ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE budgets  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE TRIGGER set_updated_at_projects
  BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_budgets
  BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 5. Missing indexes ────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tasks_project    ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned   ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date    ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_status  ON expenses(status);
