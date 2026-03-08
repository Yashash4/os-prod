-- User module overrides (per-user grant/revoke on top of role permissions)

CREATE TABLE IF NOT EXISTS user_module_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL CHECK (access_type IN ('grant', 'revoke')),
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_id)
);

ALTER TABLE user_module_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own overrides"
  ON user_module_overrides FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all overrides"
  ON user_module_overrides FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE INDEX idx_user_module_overrides_user ON user_module_overrides(user_id);
CREATE INDEX idx_user_module_overrides_module ON user_module_overrides(module_id);
