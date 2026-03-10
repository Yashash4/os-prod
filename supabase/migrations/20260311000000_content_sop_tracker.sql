-- Content Publishing SOP Daily Tracker

CREATE TABLE IF NOT EXISTS content_sop_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_date DATE NOT NULL UNIQUE,
  linkedin_post_1 BOOLEAN DEFAULT false,
  linkedin_post_1_url TEXT,
  linkedin_post_2 BOOLEAN DEFAULT false,
  linkedin_post_2_url TEXT,
  instagram_post BOOLEAN DEFAULT false,
  instagram_post_url TEXT,
  youtube_short BOOLEAN DEFAULT false,
  youtube_short_url TEXT,
  pending_reels_done BOOLEAN DEFAULT false,
  pending_reels_note TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE content_sop_daily ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_content_sop_daily_date ON content_sop_daily(sop_date DESC);

-- Register module
INSERT INTO modules (name, slug, description, icon, path, parent_slug) VALUES
  ('SOP Tracker', 'content-sop-tracker', 'Daily content publishing SOP checklist', 'CheckSquare', '/m/marketing/content/social/sop-tracker', 'content-social')
ON CONFLICT (slug) DO NOTHING;

-- Grant to admin roles
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r, modules m
WHERE r.is_admin = true
  AND m.slug = 'content-sop-tracker'
ON CONFLICT (role_id, module_id) DO NOTHING;

-- Grant to CTO and CMTO
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r, modules m
WHERE r.name IN ('CTO', 'CMTO')
  AND m.slug = 'content-sop-tracker'
ON CONFLICT (role_id, module_id) DO NOTHING;
