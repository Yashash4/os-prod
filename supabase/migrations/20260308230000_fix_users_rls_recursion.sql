-- Fix infinite recursion in users table RLS policies.
-- The is_admin() function queries users table, which triggers RLS, which calls is_admin() again.

-- 1. Fix is_admin() to bypass RLS using SECURITY DEFINER
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  _is_admin BOOLEAN;
BEGIN
  SELECT r.is_admin INTO _is_admin
  FROM users u
  JOIN roles r ON r.id = u.role_id
  WHERE u.id = auth.uid();
  RETURN COALESCE(_is_admin, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Drop all existing policies on users table and recreate simple ones
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY %I ON users', pol.policyname);
  END LOOP;
END $$;

-- 3. Simple policies: authenticated users can read all users, update own profile
CREATE POLICY "Authenticated can read all users"
  ON users FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Service role full access"
  ON users FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Also ensure admins can insert/delete (for inviting users)
CREATE POLICY "Admins can insert users"
  ON users FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete users"
  ON users FOR DELETE TO authenticated
  USING (is_admin());
