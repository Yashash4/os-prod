-- Trigger: auto-sync auth.users → public.users
--
-- When a user is created directly from the Supabase dashboard (or any source
-- other than the app's /api/admin/users route), this trigger creates the
-- corresponding row in public.users automatically.
--
-- Role assignment from Supabase dashboard:
--   When creating a user in the Supabase Auth UI, expand "User Metadata" and
--   add: { "full_name": "Jane Doe", "role_id": "<uuid-of-role>" }
--   The trigger will pick up both values. role_id defaults to NULL if omitted.
--
-- To assign/change a role after creation:
--   Edit public.users.role_id directly in Supabase Table Editor, or use the
--   APEX OS Admin > People panel.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id uuid;
BEGIN
  -- Safely parse role_id from metadata (NULL if missing or not a valid UUID)
  BEGIN
    v_role_id := (NEW.raw_user_meta_data->>'role_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_role_id := NULL;
  END;

  INSERT INTO public.users (id, email, full_name, role_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    v_role_id
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if present (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();
