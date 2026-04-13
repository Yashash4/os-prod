-- ============================================================================
-- APEX OS — Seed Data
-- Run after schema.sql
-- ============================================================================

-- 1. Scope levels
INSERT INTO scope_levels (name, slug, rank, data_visibility, can_delete, is_system, description) VALUES
  ('Admin',    'admin',    1, 'all',  true,  true, 'Full access to all data, can delete records'),
  ('Manager',  'manager',  2, 'team', false, true, 'Can see direct reports data via reporting_to hierarchy'),
  ('Employee', 'employee', 3, 'self', false, true, 'Can only see own data'),
  ('Client',   'client',   4, 'self', false, true, 'Limited read access to own data only');

-- 2. Default roles
INSERT INTO roles (name, description, is_admin, scope_level_id) VALUES
  ('CTO', 'Chief Technology Officer — full access', true,
    (SELECT id FROM scope_levels WHERE slug = 'admin')),
  ('Manager', 'Department manager', false,
    (SELECT id FROM scope_levels WHERE slug = 'manager')),
  ('Sales', 'Sales team member', false,
    (SELECT id FROM scope_levels WHERE slug = 'employee')),
  ('Intern', 'Intern — limited access', false,
    (SELECT id FROM scope_levels WHERE slug = 'employee')),
  ('Client', 'External client', false,
    (SELECT id FROM scope_levels WHERE slug = 'client'));

-- 3. Modules (124 entries)
-- Format: (name, slug, description, icon, parent_slug, path, order)
INSERT INTO modules (name, slug, description, icon, parent_slug, path, "order") VALUES
  -- === SALES (order: 1) ===
  ('Sales', 'sales', 'Sales pipeline, CRM, and revenue tracking', 'TrendingUp', NULL, '/m/sales', 1),
  ('GHL', 'ghl', 'GoHighLevel integration', 'Zap', 'sales', '/m/sales/ghl', 1),
  ('Calendar', 'ghl-calendar', 'GHL appointments and bookings', 'Calendar', 'ghl', '/m/sales/ghl/calendar', 1),
  ('Contacts', 'ghl-contacts', 'GHL contacts', 'Users', 'ghl', '/m/sales/ghl/contacts', 2),
  ('Opportunities', 'ghl-opportunities', 'Pipeline and deals', 'Target', 'ghl', '/m/sales/ghl/opportunities', 3),
  ('Pipeline', 'pipeline', 'Sales pipeline management', 'GitBranch', 'sales', '/m/sales/pipeline', 2),
  ('Meetings', 'meetings', 'Meeting management', 'Video', 'pipeline', '/m/sales/pipeline/meetings', 1),
  ('Sales Reps', 'sales-reps', 'Sales rep management — dynamically lists reps from hr_employees', 'Users', 'meetings', '/m/sales/pipeline/meetings/sales-reps', 1),
  ('Meet Management', 'rep-meet-management', 'Sales rep meeting management', 'CalendarCheck', 'sales-reps', '/m/sales/pipeline/meetings/sales-reps/meet-management', 1),
  ('Sales Management', 'rep-sales-management', 'Sales rep deal tracking', 'DollarSign', 'sales-reps', '/m/sales/pipeline/meetings/sales-reps/sales-management', 2),
  ('Analytics', 'rep-analytics', 'Sales rep performance analytics', 'BarChart3', 'sales-reps', '/m/sales/pipeline/meetings/sales-reps/analytics', 3),
  ('Calendar', 'rep-calendar', 'Sales rep calendar', 'Calendar', 'sales-reps', '/m/sales/pipeline/meetings/sales-reps/calendar', 4),
  ('Meeting Sheet', 'rep-meeting-sheet', 'Sales rep meeting analysis sheet', 'Sheet', 'sales-reps', '/m/sales/pipeline/meetings/sales-reps/meeting-sheet', 5),
  ('Settings', 'pipeline-settings', 'Pipeline configuration', 'Settings', 'pipeline', '/m/sales/pipeline/settings', 2),
  ('Onboarding', 'onboarding', 'Client onboarding', 'ClipboardCheck', 'pipeline', '/m/sales/pipeline/onboarding', 3),
  ('Management', 'onboarding-management', 'Onboarding management', 'ListChecks', 'onboarding', '/m/sales/pipeline/onboarding/management', 1),
  ('Analytics', 'onboarding-analytics', 'Onboarding analytics', 'BarChart3', 'onboarding', '/m/sales/pipeline/onboarding/analytics', 2),
  ('Dashboard', 'sales-dashboard', 'Sales overview dashboard', 'LayoutDashboard', 'sales', '/m/sales/dashboard', 3),

  -- === MARKETING (order: 2) ===
  ('Marketing', 'marketing', 'Marketing, ads, SEO, and content', 'Megaphone', NULL, '/m/marketing', 2),
  ('Meta', 'meta', 'Meta/Facebook ads management', 'Facebook', 'marketing', '/m/marketing/meta', 1),
  ('Campaigns', 'meta-campaigns', 'Meta ad campaigns', 'Target', 'meta', '/m/marketing/meta/campaigns', 1),
  ('Ad Sets', 'meta-adsets', 'Meta ad sets', 'Layers', 'meta', '/m/marketing/meta/adsets', 2),
  ('Ads', 'meta-ads', 'Individual meta ads', 'Image', 'meta', '/m/marketing/meta/ads', 3),
  ('Analytics', 'meta-analytics', 'Meta ads analytics', 'BarChart3', 'meta', '/m/marketing/meta/analytics', 4),
  ('Campaign Tracker', 'meta-campaign-tracker', 'Campaign decision log', 'ClipboardList', 'meta', '/m/marketing/meta/campaign-tracker', 5),
  ('Creative Tracker', 'meta-creative-tracker', 'Creative performance tracker', 'Palette', 'meta', '/m/marketing/meta/creative-tracker', 6),
  ('Budget Planner', 'meta-budget-planner', 'Ad budget planning', 'Calculator', 'meta', '/m/marketing/meta/budget-planner', 7),
  ('Conversion Log', 'meta-conversion-log', 'Lead conversion tracking', 'UserCheck', 'meta', '/m/marketing/meta/conversion-log', 8),
  ('Creative Analysis', 'meta-creative-analysis', 'Creative performance analysis', 'Eye', 'meta', '/m/marketing/meta/creative-analysis', 9),
  ('Audience Insights', 'meta-audience-insights', 'Audience demographic insights', 'Users', 'meta', '/m/marketing/meta/audience-insights', 10),
  ('Spend Forecast', 'meta-spend-forecast', 'Ad spend forecasting', 'TrendingUp', 'meta', '/m/marketing/meta/spend-forecast', 11),
  ('SEO', 'seo', 'Search engine optimization', 'Search', 'marketing', '/m/marketing/seo', 2),
  ('Dashboard', 'seo-dashboard', 'SEO overview', 'LayoutDashboard', 'seo', '/m/marketing/seo/dashboard', 1),
  ('Search Performance', 'seo-performance', 'Google Search Console data', 'Activity', 'seo', '/m/marketing/seo/performance', 2),
  ('Pages & Indexing', 'seo-indexing', 'Page indexing status', 'FileSearch', 'seo', '/m/marketing/seo/indexing', 3),
  ('Keywords', 'seo-keywords', 'Keyword research', 'Key', 'seo', '/m/marketing/seo/keywords', 4),
  ('Sitemap', 'seo-sitemap', 'Sitemap management', 'Map', 'seo', '/m/marketing/seo/sitemap', 5),
  ('Google Business', 'seo-business', 'Google Business Profile', 'MapPin', 'seo', '/m/marketing/seo/business', 6),
  ('Keyword Tracker', 'seo-keyword-tracker', 'Keyword position tracking', 'Crosshair', 'seo', '/m/marketing/seo/keyword-tracker', 7),
  ('Task Log', 'seo-task-log', 'SEO task management', 'ListTodo', 'seo', '/m/marketing/seo/task-log', 8),
  ('Competitor Tracker', 'seo-competitor-tracker', 'Competitor analysis', 'Sword', 'seo', '/m/marketing/seo/competitor-tracker', 9),
  ('Content Briefs', 'seo-content-briefs', 'Content brief planning', 'FileText', 'seo', '/m/marketing/seo/content-briefs', 10),
  ('Rank Analysis', 'seo-rank-analysis', 'Ranking analysis & trends', 'LineChart', 'seo', '/m/marketing/seo/rank-analysis', 11),
  ('Page Health', 'seo-page-health', 'Page speed & health audits', 'HeartPulse', 'seo', '/m/marketing/seo/page-health', 12),
  ('Content', 'content', 'Content creation & management', 'PenTool', 'marketing', '/m/marketing/content', 3),
  ('Ads', 'content-ads', 'Ad creatives', 'Image', 'content', '/m/marketing/content/ads', 1),
  ('Social Media', 'content-social', 'Social media management', 'Share2', 'content', '/m/marketing/content/social', 2),
  ('SOP Tracker', 'content-sop-tracker', 'Content SOP tracking', 'ClipboardList', 'content-social', '/m/marketing/content/social/sop-tracker', 1),
  ('LinkedIn', 'content-linkedin', 'LinkedIn content', 'Linkedin', 'content-social', '/m/marketing/content/social/linkedin', 2),
  ('Instagram', 'content-instagram', 'Instagram content', 'Instagram', 'content-social', '/m/marketing/content/social/instagram', 3),
  ('YouTube', 'content-youtube', 'YouTube content', 'Youtube', 'content-social', '/m/marketing/content/social/youtube', 4),
  ('Video Editing', 'content-video-editing', 'Video production pipeline', 'Film', 'content', '/m/marketing/content/video-editing', 3),

  -- === PAYMENTS (order: 3) ===
  ('Payments', 'payments', 'Payment processing and tracking', 'CreditCard', NULL, '/m/payments', 3),
  ('Dashboard', 'payments-dashboard', 'Payment overview', 'LayoutDashboard', 'payments', '/m/payments/dashboard', 1),
  ('Transactions', 'payments-transactions', 'Razorpay transactions', 'ArrowLeftRight', 'payments', '/m/payments/transactions', 2),
  ('Settlements', 'payments-settlements', 'Razorpay settlements', 'Landmark', 'payments', '/m/payments/settlements', 3),
  ('Invoices', 'payments-invoices', 'Razorpay invoices', 'FileText', 'payments', '/m/payments/invoices', 4),
  ('Payment Pages', 'payments-pages', 'Razorpay payment pages', 'Globe', 'payments', '/m/payments/payment-pages', 5),
  ('Analytics', 'payments-analytics', 'Payment analytics', 'BarChart3', 'payments', '/m/payments/analytics', 6),
  ('Failed Payments', 'payments-failed', 'Failed payment tracking', 'AlertTriangle', 'payments', '/m/payments/failed-payments', 7),
  ('Send Links', 'payments-send-links', 'Payment link creation', 'Link', 'payments', '/m/payments/send-links', 8),
  ('Collection Log', 'payments-collection-log', 'Daily collection log', 'BookOpen', 'payments', '/m/payments/collection-log', 9),
  ('Outstanding', 'payments-outstanding', 'Outstanding invoice follow-ups', 'Clock', 'payments', '/m/payments/outstanding', 10),
  ('Refunds', 'payments-refunds', 'Razorpay refunds', 'RotateCcw', 'payments', '/m/payments/refunds', 11),

  -- === ANALYTICS (order: 4) ===
  ('Analytics', 'analytics', 'Cross-module analytics & dashboards', 'PieChart', NULL, '/m/analytics', 4),
  ('Overview', 'analytics-overview', 'Analytics overview', 'LayoutDashboard', 'analytics', '/m/analytics/overview', 1),
  ('Meta Ads', 'analytics-meta-ads', 'Meta ads performance', 'Facebook', 'analytics', '/m/analytics/meta-ads', 2),
  ('SEO', 'analytics-seo', 'SEO performance', 'Search', 'analytics', '/m/analytics/seo', 3),
  ('Payments', 'analytics-payments', 'Payment analytics', 'CreditCard', 'analytics', '/m/analytics/payments', 4),
  ('Sales', 'analytics-sales', 'Sales analytics', 'TrendingUp', 'analytics', '/m/analytics/sales', 5),
  ('GHL Dashboard', 'analytics-ghl', 'GHL performance', 'Zap', 'analytics', '/m/analytics/ghl', 6),
  ('Cohort Tracker', 'analytics-cohort-tracker', 'Cohort analysis', 'Users', 'analytics', '/m/analytics/cohort-tracker', 7),
  ('Daily Sheet', 'analytics-daily-sheet', 'Daily metrics sheet', 'Sheet', 'analytics', '/m/analytics/daily-sheet', 8),
  ('Reports', 'analytics-reports', 'Custom reports', 'FileBarChart', 'analytics', '/m/analytics/reports', 9),

  -- === HR (order: 5) ===
  ('HR', 'hr', 'Human resources management', 'Users', NULL, '/m/hr', 5),
  ('Dashboard', 'hr-dashboard', 'HR overview', 'LayoutDashboard', 'hr', '/m/hr/dashboard', 1),
  ('Employees', 'hr-employees', 'Employee directory', 'UserPlus', 'hr', '/m/hr/employees', 2),
  ('Departments', 'hr-departments', 'Department management', 'Building', 'hr', '/m/hr/departments', 3),
  ('Designations', 'hr-designations', 'Designation management', 'Award', 'hr', '/m/hr/designations', 4),
  ('KPIs & KRAs', 'hr-kpis', 'Performance indicators', 'Target', 'hr', '/m/hr/kpis', 5),
  ('Salary', 'hr-salary', 'Salary structure', 'Banknote', 'hr', '/m/hr/salary', 6),
  ('Payroll Tracker', 'hr-payroll', 'Monthly payroll cycles', 'Calculator', 'hr', '/m/hr/payroll', 7),
  ('Settings', 'hr-settings', 'HR module settings', 'Settings', 'hr', '/m/hr/settings', 8),
  ('Leaves', 'hr-leaves', 'Leave management', 'CalendarOff', 'hr', '/m/hr/leaves', 9),
  ('Holidays', 'hr-holidays', 'Holiday calendar', 'PartyPopper', 'hr', '/m/hr/holidays', 10),
  ('Attendance', 'hr-attendance', 'Attendance tracking', 'Clock', 'hr', '/m/hr/attendance', 11),
  ('Documents', 'hr-documents', 'Employee documents', 'FolderOpen', 'hr', '/m/hr/documents', 12),

  -- === TASKS (order: 6) ===
  ('Tasks', 'tasks', 'Task and project management', 'CheckSquare', NULL, '/m/tasks', 6),
  ('Board', 'tasks-board', 'Kanban board view', 'Kanban', 'tasks', '/m/tasks/board', 1),
  ('My Tasks', 'tasks-my', 'My assigned tasks', 'User', 'tasks', '/m/tasks/my', 2),
  ('Team Tasks', 'tasks-team', 'Team task overview', 'Users', 'tasks', '/m/tasks/team', 3),
  ('Projects', 'tasks-projects', 'Project management', 'FolderKanban', 'tasks', '/m/tasks/projects', 4),
  ('Calendar', 'tasks-calendar', 'Task calendar view', 'Calendar', 'tasks', '/m/tasks/calendar', 5),

  -- === FINANCE (order: 7) ===
  ('Finance', 'finance', 'Financial management', 'Wallet', NULL, '/m/finance', 7),
  ('Expenses', 'finance-expenses', 'Expense tracking', 'Receipt', 'finance', '/m/finance/expenses', 1),
  ('Budgets', 'finance-budgets', 'Budget planning', 'PiggyBank', 'finance', '/m/finance/budgets', 2),
  ('Categories', 'finance-categories', 'Expense categories', 'Tags', 'finance', '/m/finance/categories', 3),
  ('Reports', 'finance-reports', 'Financial reports', 'FileBarChart', 'finance', '/m/finance/reports', 4),
  ('Invoices', 'finance-invoices', 'Internal invoicing', 'FileText', 'finance', '/m/finance/invoices', 5),

  -- === CHAT (order: 8) ===
  ('Chat', 'chat', 'Internal team messaging', 'MessageSquare', NULL, '/m/chat', 8),
  ('Channels', 'chat-channels', 'Chat channels', 'Hash', 'chat', '/m/chat/channels', 1),
  ('Direct Messages', 'chat-dms', 'Direct messages', 'MessageCircle', 'chat', '/m/chat/dms', 2),
  ('Threads', 'chat-threads', 'Message threads', 'MessagesSquare', 'chat', '/m/chat/threads', 3),

  -- === AUTOMATIONS (order: 9) ===
  ('Automations', 'automations', 'Workflow automation', 'Workflow', NULL, '/m/automations', 9),
  ('Email', 'automations-email', 'Email automation', 'Mail', 'automations', '/m/automations/email', 1),
  ('Templates', 'automations-email-templates', 'Email templates', 'FileCode', 'automations-email', '/m/automations/email/templates', 1),
  ('Compose', 'automations-email-compose', 'Compose & send email', 'Send', 'automations-email', '/m/automations/email/compose', 2),
  ('Workflows', 'automations-workflows', 'Automated workflows', 'GitBranch', 'automations', '/m/automations/workflows', 2),
  ('Rules', 'automations-rules', 'Automation rules', 'Settings2', 'automations', '/m/automations/rules', 3),
  ('Notifications', 'automations-notifications', 'Notification rules', 'Bell', 'automations', '/m/automations/notifications', 4),

  -- === ADMIN (order: 99) ===
  ('Admin', 'admin', 'System administration', 'Shield', NULL, '/m/admin', 99),
  ('People', 'admin-people', 'User management', 'Users', 'admin', '/m/admin/people', 1),
  ('Roles', 'admin-roles', 'Role management', 'UserCog', 'admin', '/m/admin/roles', 2),
  ('Permissions', 'admin-permissions', 'Permission management', 'Lock', 'admin', '/m/admin/permissions', 3),
  ('Audit Log', 'admin-audit-log', 'System audit trail', 'ScrollText', 'admin', '/m/admin/audit-log', 4),
  ('Email Templates', 'admin-email-templates', 'Email template management', 'Mail', 'admin', '/m/admin/email-templates', 5),
  ('Settings', 'admin-settings', 'System settings', 'Settings', 'admin', '/m/admin/settings', 6),

  -- === GUIDES (order: 100) ===
  ('Guides', 'guides', 'User guides and documentation', 'BookOpen', NULL, '/m/guides', 100),
  ('Chat Guide', 'guides-chat', 'Chat usage guide', 'MessageSquare', 'guides', '/m/guides/chat', 1),
  ('API Reference', 'guides-api', 'API documentation', 'Code', 'guides', '/m/guides/api', 2);

-- 4. Give CTO role access to all modules
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r, modules m
WHERE r.name = 'CTO';

-- 5. Give CTO full permissions on all modules
INSERT INTO role_module_permissions (role_id, module_id, can_read, can_create, can_edit, can_approve, can_export)
SELECT r.id, m.id, true, true, true, true, true
FROM roles r, modules m
WHERE r.name = 'CTO';

-- 6. Default leave types
INSERT INTO hr_leave_types (name, days_per_year) VALUES
  ('Casual Leave', 12),
  ('Sick Leave', 6),
  ('Earned Leave', 15),
  ('Maternity Leave', 180),
  ('Paternity Leave', 15),
  ('Compensatory Off', 0);

-- 7. Default expense categories
INSERT INTO finance_expense_categories (name, icon) VALUES
  ('Software & Tools', 'Monitor'),
  ('Marketing & Ads', 'Megaphone'),
  ('Office Supplies', 'Package'),
  ('Travel & Transport', 'Plane'),
  ('Meals & Entertainment', 'UtensilsCrossed'),
  ('Rent & Utilities', 'Building'),
  ('Salaries', 'Banknote'),
  ('Miscellaneous', 'MoreHorizontal');
