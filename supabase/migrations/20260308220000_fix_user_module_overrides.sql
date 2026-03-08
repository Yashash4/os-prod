-- Fix: recreate user_module_overrides if it doesn't exist or has broken policies

-- Create is_admin function if not exists
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

-- Recreate table if missing
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

-- Drop old policies if they exist, then recreate
DROP POLICY IF EXISTS "Users can read own overrides" ON user_module_overrides;
DROP POLICY IF EXISTS "Admins can manage all overrides" ON user_module_overrides;

CREATE POLICY "Users can read own overrides"
  ON user_module_overrides FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all overrides"
  ON user_module_overrides FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE INDEX IF NOT EXISTS idx_user_module_overrides_user ON user_module_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_user_module_overrides_module ON user_module_overrides(module_id);

-- Grant access to PostgREST
GRANT ALL ON user_module_overrides TO authenticated;
GRANT ALL ON user_module_overrides TO service_role;
