-- Content Social Media table

DO $$ BEGIN
  CREATE TYPE social_platform AS ENUM ('linkedin', 'instagram', 'youtube');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE social_content_type AS ENUM ('post', 'article', 'carousel', 'reel', 'story', 'video', 'short', 'community');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE social_content_status AS ENUM ('draft', 'review', 'scheduled', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS content_social (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform social_platform NOT NULL,
  content_type social_content_type NOT NULL,
  title TEXT NOT NULL,
  caption TEXT,
  media_url TEXT,
  status social_content_status DEFAULT 'draft',
  scheduled_date TIMESTAMPTZ,
  published_date TIMESTAMPTZ,
  engagement_likes INTEGER DEFAULT 0,
  engagement_comments INTEGER DEFAULT 0,
  engagement_shares INTEGER DEFAULT 0,
  engagement_views INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE content_social ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view content_social"
  ON content_social FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert content_social"
  ON content_social FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update content_social"
  ON content_social FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete content_social"
  ON content_social FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_content_social_platform ON content_social(platform);
CREATE INDEX idx_content_social_type ON content_social(content_type);
CREATE INDEX idx_content_social_platform_type ON content_social(platform, content_type);
CREATE INDEX idx_content_social_status ON content_social(status);

CREATE TRIGGER set_content_social_updated_at
  BEFORE UPDATE ON content_social
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
