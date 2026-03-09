-- SEO Module Upgrade: 4 new operational tables

-- 1. Keyword Tracker — target keywords with position goals
create table if not exists seo_keyword_tracker (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  current_position numeric(6,1),
  target_position integer not null default 10,
  status text not null default 'tracking'
    check (status in ('tracking','improving','achieved','declined','paused')),
  priority text not null default 'medium'
    check (priority in ('high','medium','low')),
  notes text,
  assigned_to text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table seo_keyword_tracker enable row level security;
create policy "Authenticated users can manage seo_keyword_tracker"
  on seo_keyword_tracker for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 2. Task Log — SEO/content task management
create table if not exists seo_task_log (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  task_type text not null default 'other'
    check (task_type in ('on_page','technical','content','backlink','local_seo','other')),
  status text not null default 'todo'
    check (status in ('todo','in_progress','done','blocked')),
  page_url text,
  keyword text,
  due_date date,
  assigned_to text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table seo_task_log enable row level security;
create policy "Authenticated users can manage seo_task_log"
  on seo_task_log for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 3. Competitor Tracker — monitor competitor domains
create table if not exists seo_competitor_tracker (
  id uuid primary key default gen_random_uuid(),
  competitor_domain text not null,
  keyword text not null,
  our_position numeric(6,1),
  competitor_position numeric(6,1),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table seo_competitor_tracker enable row level security;
create policy "Authenticated users can manage seo_competitor_tracker"
  on seo_competitor_tracker for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 4. Content Briefs — content brief creation and tracking
create table if not exists seo_content_briefs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  target_keyword text,
  target_url text,
  status text not null default 'draft'
    check (status in ('draft','writing','review','published','archived')),
  word_count_target integer,
  assigned_to text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table seo_content_briefs enable row level security;
create policy "Authenticated users can manage seo_content_briefs"
  on seo_content_briefs for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
