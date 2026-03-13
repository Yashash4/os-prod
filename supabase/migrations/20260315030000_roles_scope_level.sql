-- Phase 0.5: Add scope_level_id FK to roles table
-- Nullable — null means auto-detect scope from hr_employees hierarchy

ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS scope_level_id UUID REFERENCES scope_levels(id);

CREATE INDEX IF NOT EXISTS idx_roles_scope_level ON roles(scope_level_id);
