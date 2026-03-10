-- Insert HR module and sub-modules into modules table
INSERT INTO modules (name, slug, description, icon, path, parent_slug) VALUES
  ('HR', 'hr', 'Employee profiles, KPIs, salary & payroll', 'Briefcase', '/m/hr', NULL),
  ('Dashboard', 'hr-dashboard', 'HR overview and headcount stats', 'LayoutDashboard', '/m/hr/dashboard', 'hr'),
  ('Employees', 'hr-employees', 'Employee directory and profiles', 'Users', '/m/hr/employees', 'hr'),
  ('Departments', 'hr-departments', 'Department management', 'Building2', '/m/hr/departments', 'hr'),
  ('Designations', 'hr-designations', 'Job titles and levels', 'BadgeCheck', '/m/hr/designations', 'hr'),
  ('KPIs & KRAs', 'hr-kpis', 'Performance indicators and result areas', 'Target', '/m/hr/kpis', 'hr'),
  ('Salary', 'hr-salary', 'Salary records and commission rules', 'IndianRupee', '/m/hr/salary', 'hr'),
  ('Payroll Tracker', 'hr-payroll', 'Monthly payroll cycle tracking', 'Wallet', '/m/hr/payroll', 'hr')
ON CONFLICT (slug) DO NOTHING;

-- Grant HR modules to all admin roles (is_admin = true)
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r, modules m
WHERE r.is_admin = true
  AND m.slug IN ('hr', 'hr-dashboard', 'hr-employees', 'hr-departments', 'hr-designations', 'hr-kpis', 'hr-salary', 'hr-payroll')
ON CONFLICT (role_id, module_id) DO NOTHING;
