-- =============================================
-- CHAT PHASE 1 — New tables + column additions
-- =============================================

-- 1. Add columns to chat_channels
ALTER TABLE chat_channels
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_announcement BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS slow_mode_seconds INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS posting_permission TEXT DEFAULT 'everyone'
    CHECK (posting_permission IN ('everyone', 'admins'));

-- 2. Add columns to chat_messages
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS link_previews JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_silent BOOLEAN DEFAULT false;

-- 3. Chat drafts (auto-save unsent messages)
CREATE TABLE IF NOT EXISTS chat_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  attachments JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

ALTER TABLE chat_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own drafts" ON chat_drafts
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 4. Chat pins
CREATE TABLE IF NOT EXISTS chat_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_pins_channel ON chat_pins(channel_id, created_at DESC);

ALTER TABLE chat_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view pins" ON chat_pins
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM chat_members WHERE chat_members.channel_id = chat_pins.channel_id AND chat_members.user_id = auth.uid()
  ));
CREATE POLICY "Members can pin" ON chat_pins
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM chat_members WHERE chat_members.channel_id = chat_pins.channel_id AND chat_members.user_id = auth.uid()
  ));
CREATE POLICY "Pin creator or admin can unpin" ON chat_pins
  FOR DELETE TO authenticated
  USING (pinned_by = auth.uid() OR is_admin());

-- 5. Chat saved/bookmarked messages
CREATE TABLE IF NOT EXISTS chat_saved (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_saved_user ON chat_saved(user_id, created_at DESC);

ALTER TABLE chat_saved ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own saved" ON chat_saved
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 6. Read cursors (per user per channel last-read tracking)
CREATE TABLE IF NOT EXISTS chat_read_cursors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

ALTER TABLE chat_read_cursors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own cursors" ON chat_read_cursors
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 7. Chat presence (online status + typing + custom status)
CREATE TABLE IF NOT EXISTS chat_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'away', 'offline')),
  custom_text TEXT,
  custom_emoji TEXT,
  expires_at TIMESTAMPTZ,
  typing_in UUID REFERENCES chat_channels(id) ON DELETE SET NULL,
  last_seen_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE chat_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read presence" ON chat_presence
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage own presence" ON chat_presence
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Enable Realtime for presence (typing indicators)
ALTER PUBLICATION supabase_realtime ADD TABLE chat_presence;

-- 8. Chat notification preferences
CREATE TABLE IF NOT EXISTS chat_notification_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'all' CHECK (level IN ('all', 'mentions')),
  keywords TEXT[] DEFAULT '{}',
  UNIQUE(user_id, channel_id)
);

ALTER TABLE chat_notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own prefs" ON chat_notification_prefs
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 9. Chat reminders
CREATE TABLE IF NOT EXISTS chat_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  remind_at TIMESTAMPTZ NOT NULL,
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_reminders_pending ON chat_reminders(remind_at) WHERE notified = false;

ALTER TABLE chat_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own reminders" ON chat_reminders
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 10. Grants for new tables
GRANT ALL ON chat_drafts TO authenticated;
GRANT ALL ON chat_drafts TO service_role;
GRANT ALL ON chat_pins TO authenticated;
GRANT ALL ON chat_pins TO service_role;
GRANT ALL ON chat_saved TO authenticated;
GRANT ALL ON chat_saved TO service_role;
GRANT ALL ON chat_read_cursors TO authenticated;
GRANT ALL ON chat_read_cursors TO service_role;
GRANT ALL ON chat_presence TO authenticated;
GRANT ALL ON chat_presence TO service_role;
GRANT ALL ON chat_notification_prefs TO authenticated;
GRANT ALL ON chat_notification_prefs TO service_role;
GRANT ALL ON chat_reminders TO authenticated;
GRANT ALL ON chat_reminders TO service_role;
