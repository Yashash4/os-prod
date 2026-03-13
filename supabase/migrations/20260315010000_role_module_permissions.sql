-- Phase 0.3: role_module_permissions table
-- Action-level permissions per role per module (replaces simple ON/OFF in role_modules)
-- No can_delete column — delete is admin-only in code, never in the matrix

CREATE TABLE IF NOT EXISTS role_module_permissions (
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

ALTER TABLE role_module_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can read/write all
CREATE POLICY "Admins can manage role_module_permissions"
  ON role_module_permissions FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Authenticated users can read their own role's permissions
CREATE POLICY "Users can read own role permissions"
  ON role_module_permissions FOR SELECT TO authenticated
  USING (
    role_id IN (
      SELECT u.role_id FROM users u WHERE u.id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_role_module_permissions_role ON role_module_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_module_permissions_module ON role_module_permissions(module_id);

-- Migrate existing data from role_modules:
-- For every existing role_modules row, create a role_module_permissions row with can_read = true
INSERT INTO role_module_permissions (role_id, module_id, can_read, can_create, can_edit, can_approve, can_export)
SELECT rm.role_id, rm.module_id, true, false, false, false, false
FROM role_modules rm
ON CONFLICT (role_id, module_id) DO NOTHING;

-- Grants
GRANT SELECT ON role_module_permissions TO authenticated;
GRANT ALL ON role_module_permissions TO service_role;
