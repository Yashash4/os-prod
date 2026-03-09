-- Meta Module Upgrade: 4 new operational tables

-- 1. Campaign Tracker — daily decision log per campaign
create table if not exists meta_campaign_tracker (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null,
  campaign_name text not null,
  log_date date not null default current_date,
  action text not null default 'no_change'
    check (action in ('scale_up','scale_down','pause','restart','adjust_audience','adjust_creative','no_change','kill')),
  notes text,
  decided_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table meta_campaign_tracker enable row level security;
create policy "Authenticated users can manage meta_campaign_tracker"
  on meta_campaign_tracker for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 2. Creative Tracker — fatigue & performance notes per ad
create table if not exists meta_creative_tracker (
  id uuid primary key default gen_random_uuid(),
  ad_id text not null,
  ad_name text not null,
  campaign_name text,
  status text not null default 'active'
    check (status in ('active','watch','fatigued','retired','top_performer')),
  fatigue_score smallint default 0 check (fatigue_score >= 0 and fatigue_score <= 10),
  notes text,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table meta_creative_tracker enable row level security;
create policy "Authenticated users can manage meta_creative_tracker"
  on meta_creative_tracker for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 3. Budget Plans — planned vs actual budget tracking
create table if not exists meta_budget_plans (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null,
  campaign_name text not null,
  period_start date not null,
  period_end date not null,
  planned_budget numeric(12,2) not null default 0,
  actual_spend numeric(12,2) not null default 0,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table meta_budget_plans enable row level security;
create policy "Authenticated users can manage meta_budget_plans"
  on meta_budget_plans for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 4. Conversion Log — manual lead quality tracking
create table if not exists meta_conversion_log (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  campaign_id text,
  campaign_name text,
  lead_name text not null,
  lead_phone text,
  lead_quality text not null default 'warm'
    check (lead_quality in ('hot','warm','cold','junk')),
  conversion_status text not null default 'new'
    check (conversion_status in ('new','contacted','qualified','converted','lost')),
  revenue_amount numeric(12,2) default 0,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table meta_conversion_log enable row level security;
create policy "Authenticated users can manage meta_conversion_log"
  on meta_conversion_log for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
