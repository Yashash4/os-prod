-- Add Nithish as Sales rep + grant Sales role access to all sales pipeline modules

-- 1. Create Nithish's auth user and public.users entry
DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_sales_role_id uuid;
BEGIN
  SELECT id INTO v_sales_role_id FROM roles WHERE name = 'Sales';

  -- Create auth user (email confirmed, random temp password — user sets own via forgot password)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    'nithishsheshagiri@gmail.com',
    crypt(gen_random_uuid()::text, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', 'Nithish', 'role_id', v_sales_role_id::text),
    now(),
    now(),
    '', '', '', ''
  );

  -- Trigger (on_auth_user_created) auto-creates the public.users row.
  -- Force-set name + role in case the trigger ran before role_id was resolvable.
  UPDATE public.users
  SET full_name = 'Nithish', role_id = v_sales_role_id
  WHERE id = v_user_id;
END $$;

-- 2. Grant Sales role access to all sales pipeline modules
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r
JOIN modules m ON m.slug = ANY(ARRAY[
  'sales', 'ghl', 'ghl-calendar', 'ghl-contacts', 'ghl-opportunities',
  'pipeline', 'meetings', 'sales-reps',
  'rep-meet-management', 'rep-sales-management', 'rep-analytics',
  'rep-calendar', 'rep-meeting-sheet',
  'sales-dashboard', 'pipeline-settings',
  'onboarding', 'onboarding-management', 'onboarding-analytics'
])
WHERE r.name = 'Sales'
ON CONFLICT DO NOTHING;

-- 3. Grant Sales role read/create/edit permissions on those modules (no approve, no delete)
INSERT INTO role_module_permissions (role_id, module_id, can_read, can_create, can_edit, can_approve, can_export)
SELECT r.id, m.id, true, true, true, false, true
FROM roles r
JOIN modules m ON m.slug = ANY(ARRAY[
  'sales', 'ghl', 'ghl-calendar', 'ghl-contacts', 'ghl-opportunities',
  'pipeline', 'meetings', 'sales-reps',
  'rep-meet-management', 'rep-sales-management', 'rep-analytics',
  'rep-calendar', 'rep-meeting-sheet',
  'sales-dashboard', 'pipeline-settings',
  'onboarding', 'onboarding-management', 'onboarding-analytics'
])
WHERE r.name = 'Sales'
ON CONFLICT DO NOTHING;
