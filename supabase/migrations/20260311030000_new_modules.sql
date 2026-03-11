-- =============================================
-- New Modules: Notifications, Tasks, Finance, Leave, Chat
-- =============================================

-- ── Notifications ────────────────────────────────────
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  body text,
  type text not null,
  module text,
  link text,
  is_read boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_notifications_user on notifications(user_id, is_read, created_at desc);

alter table notifications enable row level security;
create policy "Users can view own notifications"
  on notifications for select using (auth.uid() = user_id);
create policy "Users can update own notifications"
  on notifications for update using (auth.uid() = user_id);
create policy "Service role can insert notifications"
  on notifications for insert with check (true);
create policy "Users can delete own notifications"
  on notifications for delete using (auth.uid() = user_id);

-- ── Projects ─────────────────────────────────────────
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text default 'active',
  owner_id uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table projects enable row level security;
create policy "Authenticated users can view projects"
  on projects for select using (auth.uid() is not null);
create policy "Authenticated users can insert projects"
  on projects for insert with check (auth.uid() is not null);
create policy "Authenticated users can update projects"
  on projects for update using (auth.uid() is not null);
create policy "Authenticated users can delete projects"
  on projects for delete using (auth.uid() is not null);

-- ── Tasks ────────────────────────────────────────────
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  description text,
  status text default 'todo',
  priority text default 'medium',
  assigned_to uuid references auth.users(id),
  created_by uuid references auth.users(id),
  due_date date,
  label text,
  "order" integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table tasks enable row level security;
create policy "Authenticated users can view tasks"
  on tasks for select using (auth.uid() is not null);
create policy "Authenticated users can insert tasks"
  on tasks for insert with check (auth.uid() is not null);
create policy "Authenticated users can update tasks"
  on tasks for update using (auth.uid() is not null);
create policy "Authenticated users can delete tasks"
  on tasks for delete using (auth.uid() is not null);

-- ── Task Comments ────────────────────────────────────
create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  body text not null,
  created_at timestamptz default now()
);

alter table task_comments enable row level security;
create policy "Authenticated users can view task comments"
  on task_comments for select using (auth.uid() is not null);
create policy "Authenticated users can insert task comments"
  on task_comments for insert with check (auth.uid() is not null);
create policy "Users can delete own comments"
  on task_comments for delete using (auth.uid() = user_id);

-- ── Expense Categories ──────────────────────────────
create table if not exists expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  is_active boolean default true
);

alter table expense_categories enable row level security;
create policy "Authenticated users can view expense categories"
  on expense_categories for select using (auth.uid() is not null);
create policy "Authenticated users can insert expense categories"
  on expense_categories for insert with check (auth.uid() is not null);
create policy "Authenticated users can update expense categories"
  on expense_categories for update using (auth.uid() is not null);
create policy "Authenticated users can delete expense categories"
  on expense_categories for delete using (auth.uid() is not null);

-- ── Expenses ─────────────────────────────────────────
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references expense_categories(id),
  title text not null,
  amount numeric not null,
  date date not null,
  paid_by uuid references auth.users(id),
  receipt_url text,
  notes text,
  is_recurring boolean default false,
  recurring_interval text,
  status text default 'approved',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table expenses enable row level security;
create policy "Authenticated users can view expenses"
  on expenses for select using (auth.uid() is not null);
create policy "Authenticated users can insert expenses"
  on expenses for insert with check (auth.uid() is not null);
create policy "Authenticated users can update expenses"
  on expenses for update using (auth.uid() is not null);
create policy "Authenticated users can delete expenses"
  on expenses for delete using (auth.uid() is not null);

-- ── Budgets ──────────────────────────────────────────
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department text,
  month date not null,
  planned_amount numeric not null,
  created_at timestamptz default now()
);

alter table budgets enable row level security;
create policy "Authenticated users can view budgets"
  on budgets for select using (auth.uid() is not null);
create policy "Authenticated users can insert budgets"
  on budgets for insert with check (auth.uid() is not null);
create policy "Authenticated users can update budgets"
  on budgets for update using (auth.uid() is not null);
create policy "Authenticated users can delete budgets"
  on budgets for delete using (auth.uid() is not null);

-- ── Leave Types ──────────────────────────────────────
create table if not exists leave_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  days_per_year integer not null,
  is_active boolean default true
);

alter table leave_types enable row level security;
create policy "Authenticated users can view leave types"
  on leave_types for select using (auth.uid() is not null);
create policy "Authenticated users can insert leave types"
  on leave_types for insert with check (auth.uid() is not null);
create policy "Authenticated users can update leave types"
  on leave_types for update using (auth.uid() is not null);

-- ── Leave Balances ───────────────────────────────────
create table if not exists leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references hr_employees(id) on delete cascade,
  leave_type_id uuid references leave_types(id),
  year integer not null,
  total integer not null,
  used integer default 0,
  unique(employee_id, leave_type_id, year)
);

alter table leave_balances enable row level security;
create policy "Authenticated users can view leave balances"
  on leave_balances for select using (auth.uid() is not null);
create policy "Authenticated users can insert leave balances"
  on leave_balances for insert with check (auth.uid() is not null);
create policy "Authenticated users can update leave balances"
  on leave_balances for update using (auth.uid() is not null);

-- ── Leave Requests ───────────────────────────────────
create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references hr_employees(id) not null,
  leave_type_id uuid references leave_types(id) not null,
  start_date date not null,
  end_date date not null,
  days numeric not null,
  reason text,
  status text default 'pending',
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz default now()
);

alter table leave_requests enable row level security;
create policy "Authenticated users can view leave requests"
  on leave_requests for select using (auth.uid() is not null);
create policy "Authenticated users can insert leave requests"
  on leave_requests for insert with check (auth.uid() is not null);
create policy "Authenticated users can update leave requests"
  on leave_requests for update using (auth.uid() is not null);

-- ── Holidays ─────────────────────────────────────────
create table if not exists holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date not null unique,
  is_optional boolean default false
);

alter table holidays enable row level security;
create policy "Authenticated users can view holidays"
  on holidays for select using (auth.uid() is not null);
create policy "Authenticated users can insert holidays"
  on holidays for insert with check (auth.uid() is not null);
create policy "Authenticated users can delete holidays"
  on holidays for delete using (auth.uid() is not null);

-- ── Chat Channels ────────────────────────────────────
create table if not exists chat_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  type text default 'channel',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table chat_channels enable row level security;
create policy "Authenticated users can view chat channels"
  on chat_channels for select using (auth.uid() is not null);
create policy "Authenticated users can insert chat channels"
  on chat_channels for insert with check (auth.uid() is not null);
create policy "Authenticated users can update chat channels"
  on chat_channels for update using (auth.uid() is not null);

-- ── Chat Members ─────────────────────────────────────
create table if not exists chat_members (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references chat_channels(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  last_read_at timestamptz default now(),
  unique(channel_id, user_id)
);

alter table chat_members enable row level security;
create policy "Authenticated users can view chat members"
  on chat_members for select using (auth.uid() is not null);
create policy "Authenticated users can insert chat members"
  on chat_members for insert with check (auth.uid() is not null);
create policy "Authenticated users can update own membership"
  on chat_members for update using (auth.uid() = user_id);
create policy "Authenticated users can delete chat members"
  on chat_members for delete using (auth.uid() is not null);

-- ── Chat Messages ────────────────────────────────────
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references chat_channels(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  body text not null,
  attachment_url text,
  created_at timestamptz default now()
);
create index if not exists idx_chat_messages_channel on chat_messages(channel_id, created_at desc);

alter table chat_messages enable row level security;
create policy "Authenticated users can view chat messages"
  on chat_messages for select using (auth.uid() is not null);
create policy "Authenticated users can insert chat messages"
  on chat_messages for insert with check (auth.uid() is not null);

-- ── Enable Realtime for chat_messages ────────────────
alter publication supabase_realtime add table chat_messages;

-- ── Register new modules ────────────────────────────
insert into modules (name, slug, description, icon, parent_slug, path, "order", is_active) values
  ('Tasks', 'tasks', 'Task management, projects & kanban board', 'ClipboardList', null, '/m/tasks', 6, true),
  ('Board', 'tasks-board', 'Kanban board view for tasks', 'LayoutDashboard', 'tasks', '/m/tasks/board', 1, true),
  ('Finance', 'finance', 'Expenses, budgets, and financial tracking', 'Landmark', null, '/m/finance', 7, true),
  ('Expenses', 'finance-expenses', 'Expense log and tracking', 'Receipt', 'finance', '/m/finance/expenses', 1, true),
  ('Budgets', 'finance-budgets', 'Budget planning and tracking', 'Wallet', 'finance', '/m/finance/budgets', 2, true),
  ('Categories', 'finance-categories', 'Expense category management', 'FolderOpen', 'finance', '/m/finance/categories', 3, true),
  ('Chat', 'chat', 'Internal team messaging and channels', 'MessageSquare', null, '/m/chat', 8, true),
  ('Leaves', 'hr-leaves', 'Leave requests and approval workflow', 'CalendarOff', 'hr', '/m/hr/leaves', 9, true),
  ('Holidays', 'hr-holidays', 'Company holiday calendar', 'PartyPopper', 'hr', '/m/hr/holidays', 10, true)
on conflict (slug) do nothing;

-- ── Seed default leave types ─────────────────────────
insert into leave_types (name, days_per_year) values
  ('Casual Leave', 12),
  ('Sick Leave', 6),
  ('Earned Leave', 15)
on conflict do nothing;

-- ── Seed default expense categories ──────────────────
insert into expense_categories (name, icon) values
  ('Office Rent', 'Building2'),
  ('Salaries', 'Users'),
  ('Software & Tools', 'Laptop'),
  ('Marketing', 'Megaphone'),
  ('Travel', 'Plane'),
  ('Utilities', 'Lightbulb'),
  ('Miscellaneous', 'MoreHorizontal')
on conflict do nothing;

-- ── Create #general chat channel ─────────────────────
insert into chat_channels (name, description, type) values
  ('general', 'Company-wide announcements and discussions', 'channel')
on conflict do nothing;
