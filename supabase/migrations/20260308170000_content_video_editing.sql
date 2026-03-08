-- Content Video Editing table

DO $$ BEGIN
  CREATE TYPE video_editing_status AS ENUM ('raw', 'rough_cut', 'review', 'revision', 'final', 'published');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS content_video_editing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  raw_footage_url TEXT,
  editor_assigned TEXT,
  status video_editing_status DEFAULT 'raw',
  deadline DATE,
  review_notes TEXT,
  final_url TEXT,
  platform_target TEXT,
  duration TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE content_video_editing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view content_video_editing"
  ON content_video_editing FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert content_video_editing"
  ON content_video_editing FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update content_video_editing"
  ON content_video_editing FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete content_video_editing"
  ON content_video_editing FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_content_video_status ON content_video_editing(status);
CREATE INDEX idx_content_video_editor ON content_video_editing(editor_assigned);

CREATE TRIGGER set_content_video_editing_updated_at
  BEFORE UPDATE ON content_video_editing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
