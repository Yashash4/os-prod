-- HR Settings Bridge: designation-role mapping + user-employee linking constraints

-- Add role_id to hr_designations (advisory mapping to RBAC role)
ALTER TABLE hr_designations
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL;

-- Partial unique index: prevent two employees from linking to the same auth user
CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_employees_user_id_unique
  ON hr_employees(user_id) WHERE user_id IS NOT NULL;

-- Register HR Settings sub-module
INSERT INTO modules (name, slug, description, icon, path, parent_slug) VALUES
  ('Settings', 'hr-settings', 'HR configuration, user-employee linking, and designation-role mapping', 'Settings', '/m/hr/settings', 'hr')
ON CONFLICT (slug) DO NOTHING;

-- Grant to all admin roles
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r, modules m
WHERE r.is_admin = true AND m.slug = 'hr-settings'
ON CONFLICT (role_id, module_id) DO NOTHING;
