-- APEX OS Database Schema
-- Run this in your Supabase SQL Editor

-- Helper function: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = auth.uid()
    AND r.is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Scope levels (admin, manager, employee, client)
CREATE TABLE scope_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  rank INT NOT NULL,
  data_visibility TEXT NOT NULL CHECK (data_visibility IN ('all', 'team', 'self')),
  can_delete BOOLEAN NOT NULL DEFAULT false,
  is_system BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Roles table
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  is_admin BOOLEAN DEFAULT false,
  scope_level_id UUID REFERENCES scope_levels(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role_id UUID REFERENCES roles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Modules table
CREATE TABLE modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT 'Folder',
  parent_slug TEXT,
  path TEXT NOT NULL,
  "order" INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Role-Module mapping (which roles can access which modules)
CREATE TABLE role_modules (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, module_id)
);

-- User module overrides (per-user grant/revoke on top of role permissions)
CREATE TABLE user_module_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL CHECK (access_type IN ('grant', 'revoke')),
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_id)
);

-- Role-Module permissions (action-level: read/create/edit/approve/export per role per module)
CREATE TABLE role_module_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  can_read BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_approve BOOLEAN NOT NULL DEFAULT false,
  can_export BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role_id, module_id)
);

-- User permission overrides (per-user action-level overrides on top of role permissions)
CREATE TABLE user_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('read', 'create', 'edit', 'approve', 'export')),
  granted BOOLEAN NOT NULL DEFAULT false,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_id, action)
);

-- Audit logs (tier 1 & 2 only)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  tier INT NOT NULL CHECK (tier IN (1, 2)),
  action TEXT NOT NULL,
  module TEXT DEFAULT '',
  breadcrumb_path TEXT DEFAULT '',
  details JSONB DEFAULT '{}',
  before_value JSONB,
  after_value JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_tier ON audit_logs(tier);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_modules_parent ON modules(parent_slug);
CREATE INDEX idx_scope_levels_slug ON scope_levels(slug);
CREATE INDEX idx_roles_scope_level ON roles(scope_level_id);
CREATE INDEX idx_user_module_overrides_user ON user_module_overrides(user_id);
CREATE INDEX idx_user_module_overrides_module ON user_module_overrides(module_id);
CREATE INDEX idx_role_module_permissions_role ON role_module_permissions(role_id);
CREATE INDEX idx_role_module_permissions_module ON role_module_permissions(module_id);
CREATE INDEX idx_user_permission_overrides_user ON user_permission_overrides(user_id);
CREATE INDEX idx_user_permission_overrides_module ON user_permission_overrides(module_id);

-- Row Level Security
ALTER TABLE scope_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_module_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_module_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Scope levels: all authenticated can read, admins can manage
CREATE POLICY "Authenticated users can read scope_levels" ON scope_levels
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage scope_levels" ON scope_levels
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Admins can read all users
CREATE POLICY "Admins can read all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.is_admin = true
    )
  );

-- Admins can update users
CREATE POLICY "Admins can update users" ON users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.is_admin = true
    )
  );

-- Everyone can read roles
CREATE POLICY "Anyone can read roles" ON roles
  FOR SELECT USING (true);

-- Everyone can read active modules
CREATE POLICY "Anyone can read modules" ON modules
  FOR SELECT USING (true);

-- Everyone can read role_modules
CREATE POLICY "Anyone can read role_modules" ON role_modules
  FOR SELECT USING (true);

-- user_module_overrides: users read own, admins manage all
CREATE POLICY "Users can read own overrides" ON user_module_overrides
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage all overrides" ON user_module_overrides
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- role_module_permissions: users read own role, admins manage all
CREATE POLICY "Users can read own role permissions" ON role_module_permissions
  FOR SELECT TO authenticated
  USING (role_id IN (SELECT u.role_id FROM users u WHERE u.id = auth.uid()));
CREATE POLICY "Admins can manage role_module_permissions" ON role_module_permissions
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- user_permission_overrides: users read own, admins manage all
CREATE POLICY "Users can read own permission overrides" ON user_permission_overrides
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage user_permission_overrides" ON user_permission_overrides
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Admins can manage roles, modules, role_modules
CREATE POLICY "Admins can manage roles" ON roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.is_admin = true
    )
  );

CREATE POLICY "Admins can manage modules" ON modules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.is_admin = true
    )
  );

CREATE POLICY "Admins can manage role_modules" ON role_modules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.is_admin = true
    )
  );

-- Audit logs: users can read their own, admins can read all
CREATE POLICY "Users can read own logs" ON audit_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.is_admin = true
    )
  );

-- Anyone authenticated can insert logs
CREATE POLICY "Authenticated users can insert logs" ON audit_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Seed: Scope levels
INSERT INTO scope_levels (name, slug, rank, data_visibility, can_delete, is_system, description) VALUES
  ('Admin', 'admin', 1, 'all', true, true, 'Full access to all data, can delete records'),
  ('Manager', 'manager', 2, 'team', false, true, 'Can see direct reports data via reporting_to hierarchy'),
  ('Employee', 'employee', 3, 'self', false, true, 'Can only see own data'),
  ('Client', 'client', 4, 'self', false, true, 'Limited read access to own data only');

-- Seed: Default roles
INSERT INTO roles (name, description, is_admin) VALUES
  ('CTO', 'Chief Technology Officer - full access', true),
  ('Manager', 'Department manager', false),
  ('Sales', 'Sales team member', false),
  ('Intern', 'Intern - limited access', false);

-- Seed: Modules
INSERT INTO modules (name, slug, description, icon, parent_slug, path, "order") VALUES
  ('Sales', 'sales', 'Sales pipeline, CRM, and revenue tracking', 'TrendingUp', NULL, '/m/sales', 1),
  ('GHL', 'ghl', 'GoHighLevel integration', 'Zap', 'sales', '/m/sales/ghl', 1),
  ('Calendar', 'calendar', 'Appointments and bookings', 'Calendar', 'ghl', '/m/sales/ghl/calendar', 1),
  ('Opportunities', 'opportunities', 'Pipeline and deals', 'Target', 'ghl', '/m/sales/ghl/opportunities', 2);

-- Seed: Give CTO access to all modules
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r, modules m
WHERE r.name = 'CTO';

-- Seed: Migrate role_modules → role_module_permissions (can_read = true for existing access)
INSERT INTO role_module_permissions (role_id, module_id, can_read, can_create, can_edit, can_approve, can_export)
SELECT rm.role_id, rm.module_id, true, false, false, false, false
FROM role_modules rm
ON CONFLICT (role_id, module_id) DO NOTHING;

-- Grants for new tables
GRANT SELECT ON scope_levels TO authenticated;
GRANT ALL ON scope_levels TO service_role;
GRANT ALL ON user_module_overrides TO authenticated;
GRANT ALL ON user_module_overrides TO service_role;
GRANT SELECT ON role_module_permissions TO authenticated;
GRANT ALL ON role_module_permissions TO service_role;
GRANT SELECT ON user_permission_overrides TO authenticated;
GRANT ALL ON user_permission_overrides TO service_role;
