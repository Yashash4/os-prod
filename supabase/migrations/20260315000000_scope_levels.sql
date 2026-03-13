-- Phase 0.2: scope_levels table
-- Defines the 4 data visibility tiers: admin, manager, employee, client

CREATE TABLE IF NOT EXISTS scope_levels (
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

ALTER TABLE scope_levels ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read scope levels
CREATE POLICY "Authenticated users can read scope_levels"
  ON scope_levels FOR SELECT TO authenticated
  USING (true);

-- Only admins can write scope levels
CREATE POLICY "Admins can manage scope_levels"
  ON scope_levels FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Seed 4 default scope levels
INSERT INTO scope_levels (name, slug, rank, data_visibility, can_delete, is_system, description) VALUES
  ('Admin', 'admin', 1, 'all', true, true, 'Full access to all data, can delete records'),
  ('Manager', 'manager', 2, 'team', false, true, 'Can see direct reports data via reporting_to hierarchy'),
  ('Employee', 'employee', 3, 'self', false, true, 'Can only see own data'),
  ('Client', 'client', 4, 'self', false, true, 'Limited read access to own data only');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scope_levels_slug ON scope_levels(slug);

-- Grants
GRANT SELECT ON scope_levels TO authenticated;
GRANT ALL ON scope_levels TO service_role;
