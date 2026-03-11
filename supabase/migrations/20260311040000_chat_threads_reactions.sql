-- =============================================
-- Chat: Threads, Reactions, Edit/Delete support
-- =============================================

-- Add parent_id for threaded replies
alter table chat_messages add column if not exists parent_id uuid references chat_messages(id) on delete cascade;
-- Add reply_count cache on parent messages
alter table chat_messages add column if not exists reply_count integer default 0;
-- Add edited_at for edit tracking
alter table chat_messages add column if not exists edited_at timestamptz;
-- Add is_deleted soft-delete
alter table chat_messages add column if not exists is_deleted boolean default false;

create index if not exists idx_chat_messages_parent on chat_messages(parent_id, created_at);

-- Emoji reactions
create table if not exists chat_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references chat_messages(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  emoji text not null,
  created_at timestamptz default now(),
  unique(message_id, user_id, emoji)
);

create index if not exists idx_chat_reactions_message on chat_reactions(message_id);

alter table chat_reactions enable row level security;
create policy "Authenticated users can view reactions"
  on chat_reactions for select using (auth.uid() is not null);
create policy "Authenticated users can insert reactions"
  on chat_reactions for insert with check (auth.uid() is not null);
create policy "Users can delete own reactions"
  on chat_reactions for delete using (auth.uid() = user_id);
