-- Ensure user_module_overrides table exists (fixes crash in /api/modules/effective)
CREATE TABLE IF NOT EXISTS user_module_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL CHECK (access_type IN ('grant', 'revoke')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_id)
);

ALTER TABLE user_module_overrides ENABLE ROW LEVEL SECURITY;
