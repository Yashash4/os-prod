-- APEX OS Database Schema
-- Run this in your Supabase SQL Editor

-- Roles table
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  is_admin BOOLEAN DEFAULT false,
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

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

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
