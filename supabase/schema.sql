-- ============================================
-- APEX OS - Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Modules table
CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  path TEXT NOT NULL,
  parent_slug TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. User profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. User roles (many-to-many)
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- 5. Role-Module permissions (many-to-many)
CREATE TABLE IF NOT EXISTS role_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  access_level TEXT DEFAULT 'read',  -- 'read', 'write', 'admin'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role_id, module_id)
);

-- 6. Audit logs (Tier 1 & 2)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  action TEXT NOT NULL,           -- 'login', 'create', 'update', 'delete', 'role_change', etc.
  tier INT NOT NULL DEFAULT 2,    -- 1 = critical, 2 = important
  module TEXT,                    -- which module: 'sales', 'ghl', 'admin', etc.
  breadcrumb TEXT,                -- full path: 'APEX OS > Sales > GHL > Calendar'
  entity_type TEXT,               -- 'opportunity', 'calendar_event', 'role', 'user', etc.
  entity_id TEXT,
  before_value JSONB,             -- state before change
  after_value JSONB,              -- state after change
  metadata JSONB,                 -- any extra data
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Everyone can read roles & modules
CREATE POLICY "Roles are viewable by authenticated users"
  ON roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Modules are viewable by authenticated users"
  ON modules FOR SELECT TO authenticated USING (true);

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- Users can see their own roles
CREATE POLICY "Users can view own roles"
  ON user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Role-module permissions readable by authenticated
CREATE POLICY "Role modules viewable by authenticated"
  ON role_modules FOR SELECT TO authenticated USING (true);

-- Audit logs: users can read logs from their module access
CREATE POLICY "Users can view audit logs"
  ON audit_logs FOR SELECT TO authenticated USING (true);

-- Admin-only write policies (CTO role)
-- These use a helper function to check if user has admin/CTO role

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('CTO', 'Admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Admins can manage roles"
  ON roles FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admins can manage modules"
  ON modules FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admins can manage user roles"
  ON user_roles FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admins can manage role modules"
  ON role_modules FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admins can insert audit logs"
  ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================
-- Seed data: Default roles & modules
-- ============================================

INSERT INTO roles (name, description) VALUES
  ('CTO', 'Full access to all modules and admin panel'),
  ('Manager', 'Access to assigned modules with write access'),
  ('Sales', 'Access to Sales module'),
  ('Intern', 'Limited read-only access')
ON CONFLICT (name) DO NOTHING;

INSERT INTO modules (name, slug, description, icon, path, parent_slug, sort_order) VALUES
  ('Sales', 'sales', 'Sales pipeline and CRM', 'TrendingUp', '/m/sales', NULL, 1),
  ('GHL', 'ghl', 'GoHighLevel integration', 'Zap', '/m/sales/ghl', 'sales', 1),
  ('GHL Dashboard', 'ghl-dashboard', 'GHL analytics dashboard', 'BarChart3', '/m/sales/ghl', 'ghl', 1),
  ('GHL Calendar', 'ghl-calendar', 'Appointments and bookings', 'Calendar', '/m/sales/ghl/calendar', 'ghl', 2),
  ('GHL Opportunities', 'ghl-opportunities', 'Pipeline and deals', 'Target', '/m/sales/ghl/opportunities', 'ghl', 3)
ON CONFLICT (slug) DO NOTHING;

-- Give CTO access to all modules
INSERT INTO role_modules (role_id, module_id, access_level)
SELECT r.id, m.id, 'admin'
FROM roles r, modules m
WHERE r.name = 'CTO'
ON CONFLICT (role_id, module_id) DO NOTHING;

-- Give Sales role read access to sales modules
INSERT INTO role_modules (role_id, module_id, access_level)
SELECT r.id, m.id, 'read'
FROM roles r, modules m
WHERE r.name = 'Sales'
ON CONFLICT (role_id, module_id) DO NOTHING;

-- ============================================
-- Indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_modules_role ON role_modules(role_id);
CREATE INDEX IF NOT EXISTS idx_role_modules_module ON role_modules(module_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tier ON audit_logs(tier);
CREATE INDEX IF NOT EXISTS idx_modules_slug ON modules(slug);
CREATE INDEX IF NOT EXISTS idx_modules_parent ON modules(parent_slug);

-- ============================================
-- Updated_at trigger
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_roles
  BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_modules
  BEFORE UPDATE ON modules FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_user_profiles
  BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
