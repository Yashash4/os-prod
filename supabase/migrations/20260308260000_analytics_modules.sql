-- Insert Analytics module and sub-modules
INSERT INTO modules (name, slug, description, icon, path, parent_slug) VALUES
  ('Analytics', 'analytics', 'Centralized company analytics and campaign tracking', 'BarChart3', '/m/analytics', NULL),
  ('Overview', 'analytics-overview', 'Aggregated KPIs across all departments', 'LayoutDashboard', '/m/analytics/overview', 'analytics'),
  ('Meta Ads', 'analytics-meta', 'Meta ad spend, reach, and ROAS analytics', 'Share2', '/m/analytics/meta-ads', 'analytics'),
  ('SEO', 'analytics-seo', 'Search Console performance and rankings', 'Search', '/m/analytics/seo', 'analytics'),
  ('Payments', 'analytics-payments', 'Revenue, transactions, and payment trends', 'CreditCard', '/m/analytics/payments', 'analytics'),
  ('Sales', 'analytics-sales', 'Sales pipeline and conversion analytics', 'TrendingUp', '/m/analytics/sales', 'analytics'),
  ('GHL Dashboard', 'analytics-ghl', 'GoHighLevel pipeline and opportunity analytics', 'Zap', '/m/analytics/ghl', 'analytics'),
  ('Campaign Tracker', 'analytics-campaign', 'Admissions campaign funnel and daily KPI tracking', 'Target', '/m/analytics/campaign-tracker', 'analytics')
ON CONFLICT (slug) DO NOTHING;

-- Auto-grant Analytics modules to CTO role (admin access)
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r, modules m
WHERE r.name = 'CTO'
  AND m.slug IN ('analytics', 'analytics-overview', 'analytics-meta', 'analytics-seo', 'analytics-payments', 'analytics-sales', 'analytics-ghl', 'analytics-campaign')
ON CONFLICT (role_id, module_id) DO NOTHING;

-- Also grant to CMTO role if it exists
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r, modules m
WHERE r.name = 'CMTO'
  AND m.slug IN ('analytics', 'analytics-overview', 'analytics-meta', 'analytics-seo', 'analytics-payments', 'analytics-sales', 'analytics-ghl', 'analytics-campaign')
ON CONFLICT (role_id, module_id) DO NOTHING;
