-- ============================================================
-- Tighten RLS: Tasks, Finance, Chat
-- ============================================================
-- NOTE: All API routes use supabaseAdmin (service-role key),
-- which bypasses RLS entirely. The app-layer requireModuleAccess()
-- checks are the primary enforcement. These RLS policies add
-- defense-in-depth for:
--   1. Direct Supabase dashboard access
--   2. Realtime subscriptions (anon/user-context client)
--   3. Any future user-context queries
-- ============================================================

-- ── Helper: check if current user has module access ──────────────
-- SECURITY DEFINER so it can query role_modules/modules safely.
CREATE OR REPLACE FUNCTION user_has_module_access(module_slug TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role_id UUID;
  _has_access BOOLEAN := false;
BEGIN
  SELECT role_id INTO _role_id
  FROM users
  WHERE id = auth.uid();

  IF _role_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check role-based access
  SELECT EXISTS (
    SELECT 1
    FROM role_modules rm
    JOIN modules m ON m.id = rm.module_id
    WHERE rm.role_id = _role_id
      AND m.slug = module_slug
      AND m.is_active = true
  ) INTO _has_access;

  IF _has_access THEN RETURN true; END IF;

  -- Check user override grant
  SELECT EXISTS (
    SELECT 1
    FROM user_module_overrides umo
    JOIN modules m ON m.id = umo.module_id
    WHERE umo.user_id = auth.uid()
      AND umo.access_type = 'grant'
      AND m.slug = module_slug
      AND m.is_active = true
  ) INTO _has_access;

  RETURN _has_access;
END;
$$;

-- ── TASKS ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated users can insert tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated users can update tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated users can delete tasks" ON tasks;

CREATE POLICY "tasks_select"
  ON tasks FOR SELECT TO authenticated
  USING (user_has_module_access('tasks'));

CREATE POLICY "tasks_insert"
  ON tasks FOR INSERT TO authenticated
  WITH CHECK (user_has_module_access('tasks'));

CREATE POLICY "tasks_update"
  ON tasks FOR UPDATE TO authenticated
  USING (user_has_module_access('tasks'));

CREATE POLICY "tasks_delete"
  ON tasks FOR DELETE TO authenticated
  USING (user_has_module_access('tasks'));

-- ── PROJECTS ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can insert projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can update projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can delete projects" ON projects;

CREATE POLICY "projects_select"
  ON projects FOR SELECT TO authenticated
  USING (user_has_module_access('tasks'));

CREATE POLICY "projects_insert"
  ON projects FOR INSERT TO authenticated
  WITH CHECK (user_has_module_access('tasks'));

CREATE POLICY "projects_update"
  ON projects FOR UPDATE TO authenticated
  USING (user_has_module_access('tasks'));

CREATE POLICY "projects_delete"
  ON projects FOR DELETE TO authenticated
  USING (user_has_module_access('tasks'));

-- ── TASK COMMENTS ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view task comments" ON task_comments;
DROP POLICY IF EXISTS "Authenticated users can insert task comments" ON task_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON task_comments;

CREATE POLICY "task_comments_select"
  ON task_comments FOR SELECT TO authenticated
  USING (user_has_module_access('tasks'));

CREATE POLICY "task_comments_insert"
  ON task_comments FOR INSERT TO authenticated
  WITH CHECK (user_has_module_access('tasks') AND user_id = auth.uid());

CREATE POLICY "task_comments_delete"
  ON task_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── EXPENSES ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON expenses;
DROP POLICY IF EXISTS "Authenticated users can insert expenses" ON expenses;
DROP POLICY IF EXISTS "Authenticated users can update expenses" ON expenses;
DROP POLICY IF EXISTS "Authenticated users can delete expenses" ON expenses;

CREATE POLICY "expenses_select"
  ON expenses FOR SELECT TO authenticated
  USING (user_has_module_access('finance'));

CREATE POLICY "expenses_insert"
  ON expenses FOR INSERT TO authenticated
  WITH CHECK (user_has_module_access('finance'));

CREATE POLICY "expenses_update"
  ON expenses FOR UPDATE TO authenticated
  USING (user_has_module_access('finance'));

CREATE POLICY "expenses_delete"
  ON expenses FOR DELETE TO authenticated
  USING (user_has_module_access('finance'));

-- ── EXPENSE CATEGORIES ───────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view expense categories" ON expense_categories;
DROP POLICY IF EXISTS "Authenticated users can insert expense categories" ON expense_categories;
DROP POLICY IF EXISTS "Authenticated users can update expense categories" ON expense_categories;
DROP POLICY IF EXISTS "Authenticated users can delete expense categories" ON expense_categories;

CREATE POLICY "expense_categories_select"
  ON expense_categories FOR SELECT TO authenticated
  USING (user_has_module_access('finance'));

CREATE POLICY "expense_categories_insert"
  ON expense_categories FOR INSERT TO authenticated
  WITH CHECK (user_has_module_access('finance'));

CREATE POLICY "expense_categories_update"
  ON expense_categories FOR UPDATE TO authenticated
  USING (user_has_module_access('finance'));

CREATE POLICY "expense_categories_delete"
  ON expense_categories FOR DELETE TO authenticated
  USING (user_has_module_access('finance'));

-- ── BUDGETS ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view budgets" ON budgets;
DROP POLICY IF EXISTS "Authenticated users can insert budgets" ON budgets;
DROP POLICY IF EXISTS "Authenticated users can update budgets" ON budgets;
DROP POLICY IF EXISTS "Authenticated users can delete budgets" ON budgets;

CREATE POLICY "budgets_select"
  ON budgets FOR SELECT TO authenticated
  USING (user_has_module_access('finance'));

CREATE POLICY "budgets_insert"
  ON budgets FOR INSERT TO authenticated
  WITH CHECK (user_has_module_access('finance'));

CREATE POLICY "budgets_update"
  ON budgets FOR UPDATE TO authenticated
  USING (user_has_module_access('finance'));

CREATE POLICY "budgets_delete"
  ON budgets FOR DELETE TO authenticated
  USING (user_has_module_access('finance'));

-- ── CHAT CHANNELS ────────────────────────────────────────────────
-- Users can only see channels they are a member of
DROP POLICY IF EXISTS "Authenticated users can view chat channels" ON chat_channels;
DROP POLICY IF EXISTS "Authenticated users can insert chat channels" ON chat_channels;
DROP POLICY IF EXISTS "Authenticated users can update chat channels" ON chat_channels;
DROP POLICY IF EXISTS "Authenticated users can delete chat channels" ON chat_channels;

CREATE POLICY "chat_channels_select"
  ON chat_channels FOR SELECT TO authenticated
  USING (
    user_has_module_access('chat')
    AND EXISTS (
      SELECT 1 FROM chat_members
      WHERE chat_members.channel_id = chat_channels.id
        AND chat_members.user_id = auth.uid()
    )
  );

CREATE POLICY "chat_channels_insert"
  ON chat_channels FOR INSERT TO authenticated
  WITH CHECK (
    user_has_module_access('chat')
    AND created_by = auth.uid()
  );

CREATE POLICY "chat_channels_update"
  ON chat_channels FOR UPDATE TO authenticated
  USING (
    user_has_module_access('chat')
    AND created_by = auth.uid()
  );

CREATE POLICY "chat_channels_delete"
  ON chat_channels FOR DELETE TO authenticated
  USING (
    user_has_module_access('chat')
    AND created_by = auth.uid()
  );

-- ── CHAT MESSAGES ────────────────────────────────────────────────
-- Users can only see/send messages in channels they are a member of
DROP POLICY IF EXISTS "Authenticated users can view chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Authenticated users can insert chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Authenticated users can update chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Authenticated users can delete chat messages" ON chat_messages;

CREATE POLICY "chat_messages_select"
  ON chat_messages FOR SELECT TO authenticated
  USING (
    user_has_module_access('chat')
    AND EXISTS (
      SELECT 1 FROM chat_members
      WHERE chat_members.channel_id = chat_messages.channel_id
        AND chat_members.user_id = auth.uid()
    )
  );

CREATE POLICY "chat_messages_insert"
  ON chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_has_module_access('chat')
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM chat_members
      WHERE chat_members.channel_id = chat_messages.channel_id
        AND chat_members.user_id = auth.uid()
    )
  );

CREATE POLICY "chat_messages_update"
  ON chat_messages FOR UPDATE TO authenticated
  USING (
    user_has_module_access('chat')
    AND user_id = auth.uid()
  );

CREATE POLICY "chat_messages_delete"
  ON chat_messages FOR DELETE TO authenticated
  USING (
    user_has_module_access('chat')
    AND user_id = auth.uid()
  );
