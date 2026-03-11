-- ============================================================
-- Sync all modules from MODULE_REGISTRY to the database
-- ============================================================
-- Many sub-modules exist in src/lib/modules.ts but were never
-- inserted into the modules table. The API now enforces
-- requireSubModuleAccess() which queries this table.
-- Without these rows, non-admin users will be denied access.
--
-- Uses ON CONFLICT (slug) DO UPDATE to sync metadata while
-- preserving existing IDs (important for role_modules FK refs).
-- ============================================================

INSERT INTO modules (name, slug, description, icon, parent_slug, path, "order", is_active) VALUES
  -- ── Sales ──────────────────────────────────────────────
  ('Sales', 'sales', 'Sales pipeline, CRM, and revenue tracking', 'TrendingUp', NULL, '/m/sales', 1, true),
  ('GHL', 'ghl', 'GoHighLevel integration', 'Zap', 'sales', '/m/sales/ghl', 1, true),
  ('Calendar', 'calendar', 'Appointments and bookings', 'Calendar', 'ghl', '/m/sales/ghl/calendar', 1, true),
  ('Opportunities', 'opportunities', 'Pipeline and deals', 'Target', 'ghl', '/m/sales/ghl/opportunities', 2, true),
  ('Sales Pipeline', 'pipeline', 'Pipeline tracking and management', 'ClipboardList', 'sales', '/m/sales/pipeline', 2, true),
  ('Meetings', 'meetings', 'Meeting management and tracking', 'Calendar', 'pipeline', '/m/sales/pipeline/meetings', 2, true),
  ('Maverick', 'maverick', 'Maverick meeting workspace', 'Zap', 'meetings', '/m/sales/pipeline/meetings/maverick', 1, true),
  ('Meet Management', 'meet-management', 'Maverick''s lead and meeting tracking', 'ClipboardList', 'maverick', '/m/sales/pipeline/meetings/maverick/meet-management', 1, true),
  ('Sales Management', 'maverick-sales', 'Won deals tracking and cash collection', 'DollarSign', 'maverick', '/m/sales/pipeline/meetings/maverick/sales-management', 2, true),
  ('Analytics', 'maverick-analytics', 'Meeting and revenue performance analytics', 'BarChart3', 'maverick', '/m/sales/pipeline/meetings/maverick/analytics', 3, true),
  ('Calendar', 'maverick-calendar', 'Maverick''s appointment calendar', 'Calendar', 'maverick', '/m/sales/pipeline/meetings/maverick/calendar', 4, true),
  ('Jobin', 'jobin', 'Jobin meeting workspace', 'Zap', 'meetings', '/m/sales/pipeline/meetings/jobin', 2, true),
  ('Meet Management', 'jobin-meet', 'Jobin''s lead and meeting tracking', 'ClipboardList', 'jobin', '/m/sales/pipeline/meetings/jobin/meet-management', 1, true),
  ('Sales Management', 'jobin-sales', 'Won deals tracking and cash collection', 'DollarSign', 'jobin', '/m/sales/pipeline/meetings/jobin/sales-management', 2, true),
  ('Analytics', 'jobin-analytics', 'Meeting and revenue performance analytics', 'BarChart3', 'jobin', '/m/sales/pipeline/meetings/jobin/analytics', 3, true),
  ('Calendar', 'jobin-calendar', 'Jobin''s appointment calendar', 'Calendar', 'jobin', '/m/sales/pipeline/meetings/jobin/calendar', 4, true),
  ('Sales Setting', 'sales-setting', 'Sales tracking sheets and settings', 'Settings', 'pipeline', '/m/sales/pipeline/settings', 1, true),
  ('Onboarding', 'onboarding', 'Client onboarding and brand assessment', 'ClipboardList', 'pipeline', '/m/sales/pipeline/onboarding', 3, true),
  ('Management', 'onboarding-management', 'Onboarding management and checklist tracking', 'ClipboardList', 'onboarding', '/m/sales/pipeline/onboarding/management', 1, true),
  ('Analytics', 'onboarding-analytics', 'Onboarding performance analytics', 'BarChart3', 'onboarding', '/m/sales/pipeline/onboarding/analytics', 2, true),

  -- ── Payments ───────────────────────────────────────────
  ('Payments', 'payments', 'Payment tracking, settlements & revenue analytics', 'CreditCard', NULL, '/m/payments', 3, true),
  ('Dashboard', 'payments-dashboard', 'Revenue KPIs and payment overview', 'LayoutDashboard', 'payments', '/m/payments/dashboard', 1, true),
  ('Transactions', 'payments-transactions', 'All payment transactions', 'Receipt', 'payments', '/m/payments/transactions', 2, true),
  ('Settlements', 'payments-settlements', 'Settlement cycles and bank transfers', 'Landmark', 'payments', '/m/payments/settlements', 3, true),
  ('Invoices', 'payments-invoices', 'Razorpay invoices and payment links', 'FileText', 'payments', '/m/payments/invoices', 4, true),
  ('Payment Pages', 'payments-pages', 'Razorpay payment pages and collection links', 'ScrollText', 'payments', '/m/payments/payment-pages', 5, true),
  ('Analytics', 'payments-analytics', 'Deep payment analytics and trends', 'PieChart', 'payments', '/m/payments/analytics', 6, true),
  ('Failed Payments', 'payments-failed', 'Track and follow up on failed payments', 'AlertTriangle', 'payments', '/m/payments/failed-payments', 7, true),
  ('Send Links', 'payments-send-links', 'Quick-send payment links to customers', 'Send', 'payments', '/m/payments/send-links', 8, true),
  ('Collection Log', 'payments-collection-log', 'Daily collection reconciliation sheet', 'ClipboardList', 'payments', '/m/payments/collection-log', 9, true),
  ('Outstanding', 'payments-outstanding', 'Outstanding and overdue invoices follow-up', 'AlertCircle', 'payments', '/m/payments/outstanding', 10, true),

  -- ── Marketing ──────────────────────────────────────────
  ('Marketing', 'marketing', 'Ad campaigns, analytics, and marketing tools', 'Megaphone', NULL, '/m/marketing', 2, true),

  -- ── Meta ───────────────────────────────────────────────
  ('Meta', 'meta', 'Facebook & Instagram Ads', 'Share2', 'marketing', '/m/marketing/meta', 1, true),
  ('Campaigns', 'meta-campaigns', 'Ad campaigns overview', 'BarChart3', 'meta', '/m/marketing/meta/campaigns', 1, true),
  ('Ad Sets', 'meta-adsets', 'Ad set management', 'Layers', 'meta', '/m/marketing/meta/adsets', 2, true),
  ('Ads', 'meta-ads', 'Individual ads', 'Image', 'meta', '/m/marketing/meta/ads', 3, true),
  ('Analytics', 'meta-analytics', 'Demographic & breakdown analytics', 'PieChart', 'meta', '/m/marketing/meta/analytics', 4, true),
  ('Campaign Tracker', 'meta-campaign-tracker', 'Daily campaign decision log', 'ClipboardList', 'meta', '/m/marketing/meta/campaign-tracker', 5, true),
  ('Creative Tracker', 'meta-creative-tracker', 'Creative fatigue monitoring', 'Palette', 'meta', '/m/marketing/meta/creative-tracker', 6, true),
  ('Budget Planner', 'meta-budget-planner', 'Planned vs actual budget tracking', 'Wallet', 'meta', '/m/marketing/meta/budget-planner', 7, true),
  ('Conversion Log', 'meta-conversion-log', 'Lead quality and conversion tracking', 'UserCheck', 'meta', '/m/marketing/meta/conversion-log', 8, true),
  ('Creative Analysis', 'meta-creative-analysis', 'Creative performance ranking and comparison', 'BarChart3', 'meta', '/m/marketing/meta/creative-analysis', 9, true),
  ('Audience Insights', 'meta-audience-insights', 'Cross-dimensional audience analysis', 'Users', 'meta', '/m/marketing/meta/audience-insights', 10, true),

  -- ── SEO ────────────────────────────────────────────────
  ('SEO', 'seo', 'Search Console, keywords & Google Business Profile', 'Search', 'marketing', '/m/marketing/seo', 2, true),
  ('Dashboard', 'seo-dashboard', 'SEO overview and KPIs', 'LayoutDashboard', 'seo', '/m/marketing/seo', 1, true),
  ('Search Performance', 'seo-performance', 'GSC queries, pages, countries, devices', 'TrendingUp', 'seo', '/m/marketing/seo/performance', 2, true),
  ('Pages & Indexing', 'seo-indexing', 'URL inspection, coverage, crawl stats', 'FileSearch', 'seo', '/m/marketing/seo/indexing', 3, true),
  ('Keywords', 'seo-keywords', 'Keyword tracking and opportunities', 'Tag', 'seo', '/m/marketing/seo/keywords', 4, true),
  ('Sitemap', 'seo-sitemap', 'Sitemap status and URL indexing', 'MapIcon', 'seo', '/m/marketing/seo/sitemap', 5, true),
  ('Google Business', 'seo-gbp', 'Google Business Profile insights', 'MapPin', 'seo', '/m/marketing/seo/business', 6, true),
  ('Keyword Tracker', 'seo-keyword-tracker', 'Track target keywords with position goals', 'Crosshair', 'seo', '/m/marketing/seo/keyword-tracker', 7, true),
  ('Task Log', 'seo-task-log', 'SEO and content task management', 'CheckSquare', 'seo', '/m/marketing/seo/task-log', 8, true),
  ('Competitor Tracker', 'seo-competitor-tracker', 'Monitor competitor keyword rankings', 'Swords', 'seo', '/m/marketing/seo/competitor-tracker', 9, true),
  ('Content Briefs', 'seo-content-briefs', 'Content brief creation and tracking', 'FileEdit', 'seo', '/m/marketing/seo/content-briefs', 10, true),
  ('Rank Analysis', 'seo-rank-analysis', 'Ranking performance analysis and quick wins', 'LineChart', 'seo', '/m/marketing/seo/rank-analysis', 11, true),
  ('Page Health', 'seo-page-health', 'Page-level health monitoring and scores', 'HeartPulse', 'seo', '/m/marketing/seo/page-health', 12, true),

  -- ── Content ────────────────────────────────────────────
  ('Content', 'content', 'Ad creatives, social media, and video editing', 'FileText', 'marketing', '/m/marketing/content', 3, true),
  ('Ads', 'content-ads', 'Ad scripts and graphic briefs', 'PenTool', 'content', '/m/marketing/content/ads', 1, true),
  ('Social Media', 'content-social', 'Social media content management', 'Share2', 'content', '/m/marketing/content/social', 2, true),
  ('SOP Tracker', 'content-sop-tracker', 'Daily content publishing SOP checklist', 'CheckSquare', 'content-social', '/m/marketing/content/social/sop-tracker', 0, true),
  ('LinkedIn', 'content-linkedin', 'LinkedIn content management', 'Linkedin', 'content-social', '/m/marketing/content/social/linkedin', 1, true),
  ('Instagram', 'content-instagram', 'Instagram content management', 'Instagram', 'content-social', '/m/marketing/content/social/instagram', 2, true),
  ('YouTube', 'content-youtube', 'YouTube content management', 'Youtube', 'content-social', '/m/marketing/content/social/youtube', 3, true),
  ('Video Editing', 'content-video', 'Video editing pipeline management', 'Film', 'content', '/m/marketing/content/video-editing', 3, true),

  -- ── Analytics ──────────────────────────────────────────
  ('Analytics', 'analytics', 'Centralized company analytics and campaign tracking', 'BarChart3', NULL, '/m/analytics', 4, true),
  ('Overview', 'analytics-overview', 'Aggregated KPIs across all departments', 'LayoutDashboard', 'analytics', '/m/analytics/overview', 1, true),
  ('Meta Ads', 'analytics-meta', 'Meta ad spend, reach, and ROAS analytics', 'Share2', 'analytics', '/m/analytics/meta-ads', 2, true),
  ('SEO', 'analytics-seo', 'Search Console performance and rankings', 'Search', 'analytics', '/m/analytics/seo', 3, true),
  ('Payments', 'analytics-payments', 'Revenue, transactions, and payment trends', 'CreditCard', 'analytics', '/m/analytics/payments', 4, true),
  ('Sales', 'analytics-sales', 'Sales pipeline and conversion analytics', 'TrendingUp', 'analytics', '/m/analytics/sales', 5, true),
  ('GHL Dashboard', 'analytics-ghl', 'GoHighLevel pipeline and opportunity analytics', 'Zap', 'analytics', '/m/analytics/ghl', 6, true),
  ('Cohort Tracker', 'analytics-cohort', 'Admissions cohort funnel and automated daily KPI tracking', 'Target', 'analytics', '/m/analytics/cohort-tracker', 7, true),
  ('Daily Sheet', 'analytics-daily-sheet', 'Daily campaign spend, meetings, and conversion tracking', 'ClipboardList', 'analytics', '/m/analytics/daily-sheet', 8, true),

  -- ── HR ─────────────────────────────────────────────────
  ('HR', 'hr', 'Employee profiles, KPIs, salary & payroll', 'Briefcase', NULL, '/m/hr', 5, true),
  ('Dashboard', 'hr-dashboard', 'HR overview and headcount stats', 'LayoutDashboard', 'hr', '/m/hr/dashboard', 1, true),
  ('Employees', 'hr-employees', 'Employee directory and profiles', 'Users', 'hr', '/m/hr/employees', 2, true),
  ('Departments', 'hr-departments', 'Department management', 'Building2', 'hr', '/m/hr/departments', 3, true),
  ('Designations', 'hr-designations', 'Job titles and levels', 'BadgeCheck', 'hr', '/m/hr/designations', 4, true),
  ('KPIs & KRAs', 'hr-kpis', 'Performance indicators and result areas', 'Target', 'hr', '/m/hr/kpis', 5, true),
  ('Salary', 'hr-salary', 'Salary records and commission rules', 'IndianRupee', 'hr', '/m/hr/salary', 6, true),
  ('Payroll Tracker', 'hr-payroll', 'Monthly payroll cycle tracking', 'Wallet', 'hr', '/m/hr/payroll', 7, true),
  ('Settings', 'hr-settings', 'HR configuration, user-employee linking, and designation-role mapping', 'Settings', 'hr', '/m/hr/settings', 8, true),
  ('Leaves', 'hr-leaves', 'Leave requests and approval workflow', 'CalendarOff', 'hr', '/m/hr/leaves', 9, true),
  ('Holidays', 'hr-holidays', 'Company holiday calendar', 'PartyPopper', 'hr', '/m/hr/holidays', 10, true),

  -- ── Tasks ──────────────────────────────────────────────
  ('Tasks', 'tasks', 'Task management, projects & kanban board', 'ClipboardList', NULL, '/m/tasks', 6, true),
  ('Board', 'tasks-board', 'Kanban board view for tasks', 'LayoutDashboard', 'tasks', '/m/tasks/board', 1, true),
  ('My Tasks', 'tasks-my', 'Tasks assigned to me', 'CheckSquare', 'tasks', '/m/tasks/my', 2, true),
  ('Team Tasks', 'tasks-team', 'Tasks across the team', 'Users', 'tasks', '/m/tasks/team', 3, true),
  ('Projects', 'tasks-projects', 'Project management and overview', 'FolderOpen', 'tasks', '/m/tasks/projects', 4, true),

  -- ── Finance ────────────────────────────────────────────
  ('Finance', 'finance', 'Expenses, budgets, and financial tracking', 'Landmark', NULL, '/m/finance', 7, true),
  ('Expenses', 'finance-expenses', 'Expense log and tracking', 'Receipt', 'finance', '/m/finance/expenses', 1, true),
  ('Budgets', 'finance-budgets', 'Budget planning and tracking', 'Wallet', 'finance', '/m/finance/budgets', 2, true),
  ('Categories', 'finance-categories', 'Expense category management', 'FolderOpen', 'finance', '/m/finance/categories', 3, true),

  -- ── Chat ───────────────────────────────────────────────
  ('Chat', 'chat', 'Internal team messaging and channels', 'MessageSquare', NULL, '/m/chat', 8, true),

  -- ── Automations ────────────────────────────────────────
  ('Automations', 'automations', 'Email automations and workflows', 'Zap', NULL, '/m/automations', 9, true),
  ('Email', 'automations-email', 'Invoice emails and templates', 'Mail', 'automations', '/m/automations/email', 1, true),
  ('Templates', 'automations-email-templates', 'Create and edit email templates', 'FileText', 'automations-email', '/m/automations/email/templates', 1, true),
  ('Compose', 'automations-email-compose', 'Compose and send invoice emails', 'PenTool', 'automations-email', '/m/automations/email/compose', 2, true),

  -- ── Admin ──────────────────────────────────────────────
  ('Admin', 'admin', 'User management, roles & permissions', 'Shield', NULL, '/m/admin', 99, true),
  ('People', 'admin-people', 'Manage users and invitations', 'Users', 'admin', '/m/admin/people', 1, true),
  ('Roles', 'admin-roles', 'Role definitions and management', 'Key', 'admin', '/m/admin/roles', 2, true),
  ('Permissions', 'admin-permissions', 'Role-module access and user overrides', 'Shield', 'admin', '/m/admin/permissions', 3, true),
  ('Audit Log', 'admin-audit', 'Activity logs and audit trail', 'ScrollText', 'admin', '/m/admin/audit-log', 4, true)

ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  icon        = EXCLUDED.icon,
  parent_slug = EXCLUDED.parent_slug,
  path        = EXCLUDED.path,
  "order"     = EXCLUDED."order",
  is_active   = EXCLUDED.is_active;

-- ── Auto-grant all new sub-modules to admin roles ────────
-- Admin roles should have access to everything by default.
-- This inserts role_modules entries for any modules that
-- admin roles don't already have access to.
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r
CROSS JOIN modules m
WHERE r.name IN ('CTO', 'Admin')
ON CONFLICT (role_id, module_id) DO NOTHING;
