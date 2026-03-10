-- Analytics Daily Sheet — daily campaign spend, meetings, and conversion tracking

CREATE TABLE IF NOT EXISTS analytics_daily_sheet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_date DATE NOT NULL,
  meta_spend BIGINT DEFAULT 0,
  meetings_booked INT DEFAULT 0,
  meetings_done INT DEFAULT 0,
  showups INT DEFAULT 0,
  converted INT DEFAULT 0,
  amount_collected BIGINT DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sheet_date)
);

ALTER TABLE analytics_daily_sheet ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_analytics_daily_sheet_date ON analytics_daily_sheet(sheet_date);

-- Register module
INSERT INTO modules (name, slug, description, icon, path, parent_slug) VALUES
  ('Daily Sheet', 'analytics-daily-sheet', 'Daily campaign spend, meetings, and conversion tracking', 'ClipboardList', '/m/analytics/daily-sheet', 'analytics')
ON CONFLICT (slug) DO NOTHING;

-- Grant to CTO and CMTO roles
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r, modules m
WHERE r.name IN ('CTO', 'CMTO')
  AND m.slug = 'analytics-daily-sheet'
ON CONFLICT (role_id, module_id) DO NOTHING;

-- Also grant to all admin roles
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r, modules m
WHERE r.is_admin = true
  AND m.slug = 'analytics-daily-sheet'
ON CONFLICT (role_id, module_id) DO NOTHING;
