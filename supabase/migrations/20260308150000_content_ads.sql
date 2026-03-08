-- Content Ads table (Scripts + Graphics)

DO $$ BEGIN
  CREATE TYPE content_ads_type AS ENUM ('script', 'graphic');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE content_ads_status AS ENUM ('draft', 'in_progress', 'review', 'approved', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS content_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type content_ads_type NOT NULL,
  title TEXT NOT NULL,
  platform TEXT,
  copy_text TEXT,
  cta TEXT,
  dimensions TEXT,
  designer TEXT,
  asset_url TEXT,
  status content_ads_status DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE content_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view content_ads"
  ON content_ads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert content_ads"
  ON content_ads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update content_ads"
  ON content_ads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete content_ads"
  ON content_ads FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_content_ads_type ON content_ads(type);
CREATE INDEX idx_content_ads_status ON content_ads(status);

CREATE TRIGGER set_content_ads_updated_at
  BEFORE UPDATE ON content_ads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
