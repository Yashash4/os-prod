-- Fix infinite recursion on roles table.
-- The is_admin() function joins users+roles, but roles RLS also calls is_admin().

-- Drop all existing policies on roles table
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'roles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY %I ON roles', pol.policyname);
  END LOOP;
END $$;

-- Simple policies: everyone can read roles (they're just definitions)
CREATE POLICY "Authenticated can read roles"
  ON roles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage roles"
  ON roles FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Also fix role_modules table if it has similar recursion
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'role_modules' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY %I ON role_modules', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Authenticated can read role_modules"
  ON role_modules FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role manages role_modules"
  ON role_modules FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Fix modules table too
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'modules' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY %I ON modules', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Authenticated can read modules"
  ON modules FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role manages modules"
  ON modules FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
