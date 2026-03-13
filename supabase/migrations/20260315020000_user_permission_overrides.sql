-- Phase 0.4: user_permission_overrides table
-- Per-user action-level overrides on top of role_module_permissions
-- Allows granting or revoking specific actions for individual users

CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('read', 'create', 'edit', 'approve', 'export')),
  granted BOOLEAN NOT NULL DEFAULT false,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_id, action)
);

ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- Admins can read/write all
CREATE POLICY "Admins can manage user_permission_overrides"
  ON user_permission_overrides FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Users can read their own overrides
CREATE POLICY "Users can read own permission overrides"
  ON user_permission_overrides FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user ON user_permission_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_module ON user_permission_overrides(module_id);

-- Grants
GRANT SELECT ON user_permission_overrides TO authenticated;
GRANT ALL ON user_permission_overrides TO service_role;
