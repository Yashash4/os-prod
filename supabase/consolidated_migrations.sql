-- ============================================================
-- CONSOLIDATED MIGRATIONS for APEX OS
-- Run AFTER supabase-schema.sql (base schema)
-- Generated: 2026-03-14
-- 44 migration files in chronological order
-- ============================================================


-- ============================================================
-- [1/44] 20260307060000_sales_optin_tracking.sql
-- ============================================================

-- Sales Opt-in Tracking table
-- Tracks status of opt-in contacts for call booking workflow

-- Ensure update_updated_at function exists
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TYPE optin_status AS ENUM (
    'new',
    'contacted',
    'interested',
    'call_booked',
    'payment_pending',
    'payment_done',
    'not_interested',
    'no_response'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS sales_optin_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  pipeline_name TEXT,
  stage_name TEXT,
  source TEXT,
  monetary_value NUMERIC DEFAULT 0,
  status optin_status DEFAULT 'new',
  notes TEXT,
  assigned_to TEXT,
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sales_optin_tracking ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view optin tracking"
    ON sales_optin_tracking FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert optin tracking"
    ON sales_optin_tracking FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update optin tracking"
    ON sales_optin_tracking FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_optin_tracking_opp ON sales_optin_tracking(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_optin_tracking_status ON sales_optin_tracking(status);

DROP TRIGGER IF EXISTS set_updated_at_optin_tracking ON sales_optin_tracking;
CREATE TRIGGER set_updated_at_optin_tracking
  BEFORE UPDATE ON sales_optin_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Register Sales Setting module (sort_order may not exist in all environments)
INSERT INTO modules (name, slug, description, icon, path, parent_slug)
VALUES ('Sales Setting', 'sales-setting', 'Sales tracking sheets and settings', 'Settings', '/m/sales/settings', 'sales')
ON CONFLICT (slug) DO NOTHING;


-- ============================================================
-- [2/44] 20260307070000_payment_done_tracking.sql
-- ============================================================

-- Payment Done Tracking table
-- Tracks people who paid, goal is to get them to book a call

DO $$ BEGIN
  CREATE TYPE payment_done_status AS ENUM (
    'new',
    'contacted',
    'call_scheduled',
    'call_completed',
    'no_response',
    'rescheduled',
    'not_reachable'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS sales_payment_done_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  pipeline_name TEXT,
  stage_name TEXT,
  source TEXT,
  status payment_done_status DEFAULT 'new',
  notes TEXT,
  assigned_to TEXT,
  last_contacted_at TIMESTAMPTZ,
  call_scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sales_payment_done_tracking ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view payment done tracking"
    ON sales_payment_done_tracking FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert payment done tracking"
    ON sales_payment_done_tracking FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update payment done tracking"
    ON sales_payment_done_tracking FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_done_tracking_opp ON sales_payment_done_tracking(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_payment_done_tracking_status ON sales_payment_done_tracking(status);

DROP TRIGGER IF EXISTS set_updated_at_payment_done_tracking ON sales_payment_done_tracking;
CREATE TRIGGER set_updated_at_payment_done_tracking
  BEFORE UPDATE ON sales_payment_done_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- [3/44] 20260307080000_call_booked_tracking.sql
-- ============================================================

-- Call Booked Tracking table
-- Goal: understand if the client is the right fit for us

DO $$ BEGIN
  CREATE TYPE call_booked_status AS ENUM (
    'pending_review',
    'call_done',
    'right_fit',
    'not_a_fit',
    'needs_followup',
    'onboarded',
    'declined'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS sales_call_booked_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  pipeline_name TEXT,
  stage_name TEXT,
  source TEXT,
  status call_booked_status DEFAULT 'pending_review',
  rating INT CHECK (rating >= 1 AND rating <= 5),
  comments TEXT,
  notes TEXT,
  assigned_to TEXT,
  call_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sales_call_booked_tracking ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view call booked tracking"
    ON sales_call_booked_tracking FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert call booked tracking"
    ON sales_call_booked_tracking FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update call booked tracking"
    ON sales_call_booked_tracking FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_call_booked_tracking_opp ON sales_call_booked_tracking(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_call_booked_tracking_status ON sales_call_booked_tracking(status);
CREATE INDEX IF NOT EXISTS idx_call_booked_tracking_rating ON sales_call_booked_tracking(rating);

DROP TRIGGER IF EXISTS set_updated_at_call_booked_tracking ON sales_call_booked_tracking;
CREATE TRIGGER set_updated_at_call_booked_tracking
  BEFORE UPDATE ON sales_call_booked_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- [4/44] 20260307090000_maverick_meet_tracking.sql
-- ============================================================

-- Maverick Meet Management table
-- Stores Maverick's own tracking data for meetings, linked to call_booked_tracking via opportunity_id

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TYPE maverick_meet_status AS ENUM (
    'pending',
    'scheduled',
    'completed',
    'follow_up',
    'converted',
    'dropped'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS maverick_meet_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT NOT NULL UNIQUE,
  meet_status maverick_meet_status DEFAULT 'pending',
  meet_notes TEXT,
  meet_date TIMESTAMPTZ,
  follow_up_date TIMESTAMPTZ,
  outcome TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE maverick_meet_tracking ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view maverick meet tracking"
    ON maverick_meet_tracking FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert maverick meet tracking"
    ON maverick_meet_tracking FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update maverick meet tracking"
    ON maverick_meet_tracking FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_maverick_meet_opp ON maverick_meet_tracking(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_maverick_meet_status ON maverick_meet_tracking(meet_status);

DROP TRIGGER IF EXISTS set_updated_at_maverick_meet ON maverick_meet_tracking;
CREATE TRIGGER set_updated_at_maverick_meet
  BEFORE UPDATE ON maverick_meet_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- [5/44] 20260307100000_add_ghl_fields.sql
-- ============================================================

-- Add GHL native fields to call_booked_tracking
ALTER TABLE sales_call_booked_tracking
  ADD COLUMN IF NOT EXISTS ghl_status TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_id TEXT,
  ADD COLUMN IF NOT EXISTS contact_id TEXT;

-- Add same fields to optin and payment done tracking for consistency
ALTER TABLE sales_optin_tracking
  ADD COLUMN IF NOT EXISTS ghl_status TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_id TEXT,
  ADD COLUMN IF NOT EXISTS contact_id TEXT;

ALTER TABLE sales_payment_done_tracking
  ADD COLUMN IF NOT EXISTS ghl_status TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_id TEXT,
  ADD COLUMN IF NOT EXISTS contact_id TEXT;


-- ============================================================
-- [6/44] 20260307110000_maverick_sales_tracking.sql
-- ============================================================

-- Maverick Sales Management table
-- Tracks won deals from Meet Management with financial details

CREATE TABLE IF NOT EXISTS maverick_sales_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT NOT NULL UNIQUE,
  closed_date TIMESTAMPTZ,
  fees_quoted NUMERIC(12,2) DEFAULT 0,
  fees_collected NUMERIC(12,2) DEFAULT 0,
  pending_amount NUMERIC(12,2) DEFAULT 0,
  payment_mode TEXT,
  invoice_number TEXT,
  collection_status TEXT DEFAULT 'pending',
  onboarding_status TEXT DEFAULT 'not_started',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE maverick_sales_tracking ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view maverick sales tracking"
    ON maverick_sales_tracking FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert maverick sales tracking"
    ON maverick_sales_tracking FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update maverick sales tracking"
    ON maverick_sales_tracking FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_maverick_sales_opp ON maverick_sales_tracking(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_maverick_sales_collection ON maverick_sales_tracking(collection_status);

DROP TRIGGER IF EXISTS set_updated_at_maverick_sales ON maverick_sales_tracking;
CREATE TRIGGER set_updated_at_maverick_sales
  BEFORE UPDATE ON maverick_sales_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- [7/44] 20260307120000_jobin_meet_tracking.sql
-- ============================================================

-- Jobin Meet Tracking table
-- Same schema as maverick_meet_tracking for Jobin's workspace

CREATE TABLE IF NOT EXISTS jobin_meet_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT NOT NULL UNIQUE,
  meet_status TEXT,
  meet_notes TEXT,
  meet_date TIMESTAMPTZ,
  follow_up_date TIMESTAMPTZ,
  outcome TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE jobin_meet_tracking ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view jobin meet tracking"
    ON jobin_meet_tracking FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert jobin meet tracking"
    ON jobin_meet_tracking FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update jobin meet tracking"
    ON jobin_meet_tracking FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobin_meet_opp ON jobin_meet_tracking(opportunity_id);

DROP TRIGGER IF EXISTS set_updated_at_jobin_meet ON jobin_meet_tracking;
CREATE TRIGGER set_updated_at_jobin_meet
  BEFORE UPDATE ON jobin_meet_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- [8/44] 20260307130000_jobin_sales_tracking.sql
-- ============================================================

-- Jobin Sales Tracking table
-- Same schema as maverick_sales_tracking for Jobin's workspace

CREATE TABLE IF NOT EXISTS jobin_sales_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT NOT NULL UNIQUE,
  closed_date TIMESTAMPTZ,
  fees_quoted NUMERIC(12,2) DEFAULT 0,
  fees_collected NUMERIC(12,2) DEFAULT 0,
  pending_amount NUMERIC(12,2) DEFAULT 0,
  payment_mode TEXT,
  invoice_number TEXT,
  collection_status TEXT DEFAULT 'pending',
  onboarding_status TEXT DEFAULT 'not_started',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE jobin_sales_tracking ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view jobin sales tracking"
    ON jobin_sales_tracking FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert jobin sales tracking"
    ON jobin_sales_tracking FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update jobin sales tracking"
    ON jobin_sales_tracking FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobin_sales_opp ON jobin_sales_tracking(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_jobin_sales_collection ON jobin_sales_tracking(collection_status);

DROP TRIGGER IF EXISTS set_updated_at_jobin_sales ON jobin_sales_tracking;
CREATE TRIGGER set_updated_at_jobin_sales
  BEFORE UPDATE ON jobin_sales_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- [9/44] 20260307140000_onboarding_tracking.sql
-- ============================================================

-- Onboarding Tracking table
-- Tracks client onboarding after won deals are closed

CREATE TABLE IF NOT EXISTS onboarding_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  source_rep TEXT,
  fees_quoted NUMERIC(12,2) DEFAULT 0,
  fees_collected NUMERIC(12,2) DEFAULT 0,
  onboarding_status TEXT DEFAULT 'scheduled',
  assigned_onboarder TEXT,
  meeting_date DATE,
  meeting_notes TEXT,
  brand_rating INTEGER CHECK (brand_rating >= 1 AND brand_rating <= 5),
  brand_description TEXT,
  client_notes TEXT,
  checklist JSONB DEFAULT '[]'::jsonb,
  follow_up_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE onboarding_tracking ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view onboarding tracking"
    ON onboarding_tracking FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert onboarding tracking"
    ON onboarding_tracking FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update onboarding tracking"
    ON onboarding_tracking FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_onboarding_opp ON onboarding_tracking(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_status ON onboarding_tracking(onboarding_status);
CREATE INDEX IF NOT EXISTS idx_onboarding_rep ON onboarding_tracking(source_rep);

DROP TRIGGER IF EXISTS set_updated_at_onboarding ON onboarding_tracking;
CREATE TRIGGER set_updated_at_onboarding
  BEFORE UPDATE ON onboarding_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- [10/44] 20260308150000_content_ads.sql
-- ============================================================

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


-- ============================================================
-- [11/44] 20260308160000_content_social.sql
-- ============================================================

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


-- ============================================================
-- [12/44] 20260308170000_content_video_editing.sql
-- ============================================================

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


-- ============================================================
-- [13/44] 20260308180000_razorpay_tables.sql
-- ============================================================

-- Razorpay payments cache
CREATE TABLE IF NOT EXISTS razorpay_payments (
  id TEXT PRIMARY KEY,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT NOT NULL,
  method TEXT,
  email TEXT,
  contact TEXT,
  order_id TEXT,
  description TEXT,
  razorpay_created_at BIGINT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  raw_data JSONB
);

CREATE INDEX idx_rzp_payments_status ON razorpay_payments(status);
CREATE INDEX idx_rzp_payments_method ON razorpay_payments(method);
CREATE INDEX idx_rzp_payments_created ON razorpay_payments(razorpay_created_at);

ALTER TABLE razorpay_payments ENABLE ROW LEVEL SECURITY;

-- Razorpay settlements cache
CREATE TABLE IF NOT EXISTS razorpay_settlements (
  id TEXT PRIMARY KEY,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  utr TEXT,
  fees INTEGER DEFAULT 0,
  tax INTEGER DEFAULT 0,
  razorpay_created_at BIGINT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  raw_data JSONB
);

CREATE INDEX idx_rzp_settlements_status ON razorpay_settlements(status);
CREATE INDEX idx_rzp_settlements_created ON razorpay_settlements(razorpay_created_at);

ALTER TABLE razorpay_settlements ENABLE ROW LEVEL SECURITY;

-- Razorpay refunds cache
CREATE TABLE IF NOT EXISTS razorpay_refunds (
  id TEXT PRIMARY KEY,
  payment_id TEXT,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  razorpay_created_at BIGINT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  raw_data JSONB
);

CREATE INDEX idx_rzp_refunds_status ON razorpay_refunds(status);
CREATE INDEX idx_rzp_refunds_created ON razorpay_refunds(razorpay_created_at);

ALTER TABLE razorpay_refunds ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- [14/44] 20260308190000_payment_amount_groups.sql
-- ============================================================

-- Payment Amount Groups: saved filter presets for transaction amount ranges
CREATE TABLE IF NOT EXISTS payment_amount_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  min_amount INTEGER,        -- in paise, NULL = no lower bound
  max_amount INTEGER,        -- in paise, NULL = no upper bound
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT            -- username
);

CREATE INDEX idx_pag_created ON payment_amount_groups(created_at DESC);

ALTER TABLE payment_amount_groups ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- [15/44] 20260308200000_user_module_overrides.sql
-- ============================================================

-- User module overrides (per-user grant/revoke on top of role permissions)

CREATE TABLE IF NOT EXISTS user_module_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL CHECK (access_type IN ('grant', 'revoke')),
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_id)
);

ALTER TABLE user_module_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own overrides"
  ON user_module_overrides FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all overrides"
  ON user_module_overrides FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE INDEX idx_user_module_overrides_user ON user_module_overrides(user_id);
CREATE INDEX idx_user_module_overrides_module ON user_module_overrides(module_id);


-- ============================================================
-- [16/44] 20260308210000_add_payment_link_fields.sql
-- ============================================================

ALTER TABLE maverick_sales_tracking
  ADD COLUMN IF NOT EXISTS payment_link_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_link_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_link_sent_at TIMESTAMPTZ;

ALTER TABLE jobin_sales_tracking
  ADD COLUMN IF NOT EXISTS payment_link_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_link_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_link_sent_at TIMESTAMPTZ;


-- ============================================================
-- [17/44] 20260308220000_fix_user_module_overrides.sql
-- ============================================================

-- Fix: recreate user_module_overrides if it doesn't exist or has broken policies

-- Create is_admin function if not exists
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = auth.uid()
    AND r.is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate table if missing
CREATE TABLE IF NOT EXISTS user_module_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL CHECK (access_type IN ('grant', 'revoke')),
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_id)
);

ALTER TABLE user_module_overrides ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist, then recreate
DROP POLICY IF EXISTS "Users can read own overrides" ON user_module_overrides;
DROP POLICY IF EXISTS "Admins can manage all overrides" ON user_module_overrides;

CREATE POLICY "Users can read own overrides"
  ON user_module_overrides FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all overrides"
  ON user_module_overrides FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE INDEX IF NOT EXISTS idx_user_module_overrides_user ON user_module_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_user_module_overrides_module ON user_module_overrides(module_id);

-- Grant access to PostgREST
GRANT ALL ON user_module_overrides TO authenticated;
GRANT ALL ON user_module_overrides TO service_role;


-- ============================================================
-- [18/44] 20260308230000_fix_users_rls_recursion.sql
-- ============================================================

-- Fix infinite recursion in users table RLS policies.
-- The is_admin() function queries users table, which triggers RLS, which calls is_admin() again.

-- 1. Fix is_admin() to bypass RLS using SECURITY DEFINER
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  _is_admin BOOLEAN;
BEGIN
  SELECT r.is_admin INTO _is_admin
  FROM users u
  JOIN roles r ON r.id = u.role_id
  WHERE u.id = auth.uid();
  RETURN COALESCE(_is_admin, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Drop all existing policies on users table and recreate simple ones
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY %I ON users', pol.policyname);
  END LOOP;
END $$;

-- 3. Simple policies: authenticated users can read all users, update own profile
CREATE POLICY "Authenticated can read all users"
  ON users FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Service role full access"
  ON users FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Also ensure admins can insert/delete (for inviting users)
CREATE POLICY "Admins can insert users"
  ON users FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete users"
  ON users FOR DELETE TO authenticated
  USING (is_admin());


-- ============================================================
-- [19/44] 20260308240000_fix_roles_rls_recursion.sql
-- ============================================================

-- Fix infinite recursion on roles table.
-- The is_admin() function joins users+roles, but roles RLS also calls is_admin().

-- Drop all existing policies on roles table
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'roles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY %I ON roles', pol.policyname);
  END LOOP;
END $$;

-- Simple policies: everyone can read roles (they're just definitions)
CREATE POLICY "Authenticated can read roles"
  ON roles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage roles"
  ON roles FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Also fix role_modules table if it has similar recursion
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'role_modules' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY %I ON role_modules', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Authenticated can read role_modules"
  ON role_modules FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role manages role_modules"
  ON role_modules FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Fix modules table too
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'modules' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY %I ON modules', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Authenticated can read modules"
  ON modules FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role manages modules"
  ON modules FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================================
-- [20/44] 20260308260000_analytics_modules.sql
-- ============================================================

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


-- ============================================================
-- [21/44] 20260308270000_cohort_daily_metrics.sql
-- ============================================================

-- Rename Campaign Tracker module to Cohort Tracker
UPDATE modules SET
  name = 'Cohort Tracker',
  slug = 'analytics-cohort',
  description = 'Admissions cohort funnel and automated daily KPI tracking',
  path = '/m/analytics/cohort-tracker'
WHERE slug = 'analytics-campaign';

-- Update role_modules references (slug change means module_id stays same, no action needed)

-- Create cohort_daily_metrics table for automated nightly data collection
CREATE TABLE IF NOT EXISTS cohort_daily_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  -- Meta Ads data (auto-fetched)
  ad_spend NUMERIC(12,2) DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  -- Sales pipeline data (auto-fetched)
  meetings_booked INTEGER DEFAULT 0,
  calls_completed INTEGER DEFAULT 0,
  show_ups INTEGER DEFAULT 0,
  admissions INTEGER DEFAULT 0,
  -- Revenue data (auto-fetched)
  revenue_collected NUMERIC(12,2) DEFAULT 0,
  -- Manual override / notes
  notes TEXT DEFAULT '',
  -- Metadata
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index on date for fast lookups
CREATE INDEX IF NOT EXISTS idx_cohort_daily_metrics_date ON cohort_daily_metrics(date);

-- RLS: allow authenticated reads, server-side writes via service role
ALTER TABLE cohort_daily_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON cohort_daily_metrics
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow service role all" ON cohort_daily_metrics
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ============================================================
-- [22/44] 20260308280000_cohort_add_optins_payments.sql
-- ============================================================

-- Add optins and payments columns to cohort_daily_metrics
ALTER TABLE cohort_daily_metrics
  ADD COLUMN IF NOT EXISTS optins INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payments INTEGER DEFAULT 0;


-- ============================================================
-- [23/44] 20260308290000_payments_module_upgrade.sql
-- ============================================================

-- ============================================================
-- Payments Module Upgrade: 4 new tables for daily operations
-- ============================================================

-- 1. Revenue Targets (daily/weekly/monthly goals)
CREATE TABLE revenue_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  period_start DATE NOT NULL,
  target_amount BIGINT NOT NULL, -- in paise
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(period_type, period_start)
);
ALTER TABLE revenue_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read revenue_targets"
  ON revenue_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert revenue_targets"
  ON revenue_targets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update revenue_targets"
  ON revenue_targets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete revenue_targets"
  ON revenue_targets FOR DELETE TO authenticated USING (true);

-- 2. Failed Payment Tracking (follow-up sheet)
CREATE TABLE failed_payment_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_payment_id TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  amount BIGINT NOT NULL, -- paise
  original_status TEXT NOT NULL,
  follow_up_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (follow_up_status IN ('pending','contacted','resolved','written_off','retry_sent')),
  contacted_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  retry_payment_link_id TEXT,
  retry_payment_link_url TEXT,
  notes TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE failed_payment_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read failed_payment_tracking"
  ON failed_payment_tracking FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert failed_payment_tracking"
  ON failed_payment_tracking FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update failed_payment_tracking"
  ON failed_payment_tracking FOR UPDATE TO authenticated USING (true);

-- 3. Daily Collection Log (reconciliation sheet)
CREATE TABLE daily_collection_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date DATE NOT NULL,
  customer_name TEXT NOT NULL,
  amount BIGINT NOT NULL, -- paise
  payment_mode TEXT,
  reference_id TEXT,
  bank_confirmed BOOLEAN DEFAULT false,
  reconciled BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE daily_collection_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_daily_collection_date ON daily_collection_log(log_date);
CREATE POLICY "Authenticated users can read daily_collection_log"
  ON daily_collection_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert daily_collection_log"
  ON daily_collection_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update daily_collection_log"
  ON daily_collection_log FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete daily_collection_log"
  ON daily_collection_log FOR DELETE TO authenticated USING (true);

-- 4. Invoice Follow-ups (overdue tracking)
CREATE TABLE invoice_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_invoice_id TEXT NOT NULL UNIQUE,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  amount_due BIGINT NOT NULL, -- paise
  due_date DATE,
  follow_up_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (follow_up_status IN ('pending','contacted','partial_paid','paid','written_off','disputed')),
  last_contacted_at TIMESTAMPTZ,
  follow_up_count INT DEFAULT 0,
  next_follow_up_date DATE,
  notes TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE invoice_follow_ups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read invoice_follow_ups"
  ON invoice_follow_ups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert invoice_follow_ups"
  ON invoice_follow_ups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update invoice_follow_ups"
  ON invoice_follow_ups FOR UPDATE TO authenticated USING (true);


-- ============================================================
-- [24/44] 20260308300000_meta_module_upgrade.sql
-- ============================================================

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


-- ============================================================
-- [25/44] 20260308310000_seo_module_upgrade.sql
-- ============================================================

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


-- ============================================================
-- [26/44] 20260310000000_hr_module.sql
-- ============================================================

-- HR Module Tables
-- Departments, Designations, Employees, Salaries, Commission Rules,
-- Salary Cycles, KPIs, KPI Entries, KRAs

-- ── Departments ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  head_employee_id UUID, -- FK added after hr_employees exists
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Designations ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_designations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  level TEXT DEFAULT 'mid' CHECK (level IN ('intern','junior','mid','senior','lead','manager','head','director')),
  department_id UUID REFERENCES hr_departments(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Employees ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department_id UUID REFERENCES hr_departments(id) ON DELETE SET NULL,
  designation_id UUID REFERENCES hr_designations(id) ON DELETE SET NULL,
  employment_type TEXT DEFAULT 'full_time' CHECK (employment_type IN ('full_time','part_time','contract','intern')),
  join_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','on_leave','notice_period','exited')),
  exit_date DATE,
  reporting_to UUID REFERENCES hr_employees(id) ON DELETE SET NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Now add the FK for department head
ALTER TABLE hr_departments
  ADD CONSTRAINT hr_departments_head_employee_id_fkey
  FOREIGN KEY (head_employee_id) REFERENCES hr_employees(id) ON DELETE SET NULL;

-- ── Salaries ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  base_salary BIGINT NOT NULL, -- paise
  effective_from DATE NOT NULL,
  effective_to DATE, -- null = current
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Commission Rules ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES hr_employees(id) ON DELETE CASCADE,
  designation_id UUID REFERENCES hr_designations(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percentage','flat_per_unit','slab')),
  value NUMERIC,
  slab_config JSONB,
  metric TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Salary Cycles (Payroll Tracker) ───────────────────────
CREATE TABLE IF NOT EXISTS hr_salary_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  cycle_month TEXT NOT NULL, -- "2026-03"
  base_amount BIGINT DEFAULT 0,
  commission_amount BIGINT DEFAULT 0,
  deductions BIGINT DEFAULT 0,
  net_amount BIGINT DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','calculated','approved','paid')),
  paid_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, cycle_month)
);

-- ── KPIs ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  department_id UUID REFERENCES hr_departments(id) ON DELETE SET NULL,
  designation_id UUID REFERENCES hr_designations(id) ON DELETE SET NULL,
  unit TEXT NOT NULL CHECK (unit IN ('count','currency_paise','percentage','hours')),
  target_value NUMERIC DEFAULT 0,
  frequency TEXT DEFAULT 'monthly' CHECK (frequency IN ('daily','weekly','monthly','quarterly')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── KPI Entries ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_kpi_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID NOT NULL REFERENCES hr_kpis(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- "2026-03"
  actual_value NUMERIC DEFAULT 0,
  target_value NUMERIC DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(kpi_id, employee_id, period)
);

-- ── KRAs ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_kras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  weightage NUMERIC DEFAULT 0,
  review_period TEXT NOT NULL, -- "Q1-2026"
  self_rating NUMERIC CHECK (self_rating >= 1 AND self_rating <= 5),
  manager_rating NUMERIC CHECK (manager_rating >= 1 AND manager_rating <= 5),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','review_pending','reviewed','archived')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── RLS Policies (admin-only access) ──────────────────────
ALTER TABLE hr_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_salary_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_kpi_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_kras ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS. For authenticated admin access via service role key,
-- no explicit policies needed since API routes use supabaseAdmin (service role).
-- Add read-only policies for authenticated users if self-service is needed later.

-- ── Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hr_employees_dept ON hr_employees(department_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_status ON hr_employees(status);
CREATE INDEX IF NOT EXISTS idx_hr_salaries_employee ON hr_salaries(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_salary_cycles_month ON hr_salary_cycles(cycle_month);
CREATE INDEX IF NOT EXISTS idx_hr_kpi_entries_period ON hr_kpi_entries(period);
CREATE INDEX IF NOT EXISTS idx_hr_kras_employee ON hr_kras(employee_id);

-- ── Seed default departments ──────────────────────────────
INSERT INTO hr_departments (name, description) VALUES
  ('Social Media', 'Social media content creation and management'),
  ('Cohort Management', 'Admissions cohort operations and student management'),
  ('Sales', 'Sales pipeline and revenue generation'),
  ('Marketing', 'Ad campaigns, branding, and growth'),
  ('Design', 'Graphic design and creative'),
  ('Operations', 'Day-to-day operations and logistics'),
  ('Finance', 'Accounting, payments, and financial planning')
ON CONFLICT DO NOTHING;


-- ============================================================
-- [27/44] 20260310010000_hr_module_registry.sql
-- ============================================================

-- Insert HR module and sub-modules into modules table
INSERT INTO modules (name, slug, description, icon, path, parent_slug) VALUES
  ('HR', 'hr', 'Employee profiles, KPIs, salary & payroll', 'Briefcase', '/m/hr', NULL),
  ('Dashboard', 'hr-dashboard', 'HR overview and headcount stats', 'LayoutDashboard', '/m/hr/dashboard', 'hr'),
  ('Employees', 'hr-employees', 'Employee directory and profiles', 'Users', '/m/hr/employees', 'hr'),
  ('Departments', 'hr-departments', 'Department management', 'Building2', '/m/hr/departments', 'hr'),
  ('Designations', 'hr-designations', 'Job titles and levels', 'BadgeCheck', '/m/hr/designations', 'hr'),
  ('KPIs & KRAs', 'hr-kpis', 'Performance indicators and result areas', 'Target', '/m/hr/kpis', 'hr'),
  ('Salary', 'hr-salary', 'Salary records and commission rules', 'IndianRupee', '/m/hr/salary', 'hr'),
  ('Payroll Tracker', 'hr-payroll', 'Monthly payroll cycle tracking', 'Wallet', '/m/hr/payroll', 'hr')
ON CONFLICT (slug) DO NOTHING;

-- Grant HR modules to all admin roles (is_admin = true)
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r, modules m
WHERE r.is_admin = true
  AND m.slug IN ('hr', 'hr-dashboard', 'hr-employees', 'hr-departments', 'hr-designations', 'hr-kpis', 'hr-salary', 'hr-payroll')
ON CONFLICT (role_id, module_id) DO NOTHING;


-- ============================================================
-- [28/44] 20260310020000_hr_settings_bridge.sql
-- ============================================================

-- HR Settings Bridge: designation-role mapping + user-employee linking constraints

-- Add role_id to hr_designations (advisory mapping to RBAC role)
ALTER TABLE hr_designations
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL;

-- Partial unique index: prevent two employees from linking to the same auth user
CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_employees_user_id_unique
  ON hr_employees(user_id) WHERE user_id IS NOT NULL;

-- Register HR Settings sub-module
INSERT INTO modules (name, slug, description, icon, path, parent_slug) VALUES
  ('Settings', 'hr-settings', 'HR configuration, user-employee linking, and designation-role mapping', 'Settings', '/m/hr/settings', 'hr')
ON CONFLICT (slug) DO NOTHING;

-- Grant to all admin roles
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r, modules m
WHERE r.is_admin = true AND m.slug = 'hr-settings'
ON CONFLICT (role_id, module_id) DO NOTHING;


-- ============================================================
-- [29/44] 20260310030000_analytics_daily_sheet.sql
-- ============================================================

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


-- ============================================================
-- [30/44] 20260310040000_hr_kpis_kras.sql
-- ============================================================

-- HR KPIs, KPI Entries, and KRAs: additional indexes
-- NOTE: Tables hr_kpis, hr_kpi_entries, hr_kras are defined in 20260310000000_hr_module.sql
-- This migration only adds indexes that were missing from the original.

CREATE INDEX IF NOT EXISTS idx_hr_kpi_entries_employee ON hr_kpi_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_kras_period           ON hr_kras(review_period);


-- ============================================================
-- [31/44] 20260310050000_email_invoices.sql
-- ============================================================

-- Email Templates and Sent Invoices for Automations module

-- Sequence for auto-incrementing invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1 INCREMENT BY 1;

-- RPC function to get next invoice number (callable from supabaseAdmin)
CREATE OR REPLACE FUNCTION nextval_text(seq_name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN nextval(seq_name)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Email templates (admin-editable)
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Sent invoices log
CREATE TABLE IF NOT EXISTS sent_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  amount NUMERIC NOT NULL,
  template_slug TEXT NOT NULL,
  resend_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sent_invoices ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sent_invoices_opportunity ON sent_invoices(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_sent_invoices_sent_at ON sent_invoices(sent_at DESC);

-- Seed default invoice template
INSERT INTO email_templates (slug, name, subject, html_body, variables) VALUES (
  'invoice-default',
  'Invoice - Default',
  'Invoice {{invoice_number}} from Apex Fashion Lab',
  '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Invoice {{invoice_number}}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

<!-- Header -->
<tr>
<td style="background-color:#1a1a1a;padding:32px 40px;text-align:center;">
  <h1 style="margin:0;color:#B8860B;font-size:24px;font-weight:700;letter-spacing:1px;">APEX FASHION LAB</h1>
  <p style="margin:8px 0 0;color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:2px;">Invoice</p>
</td>
</tr>

<!-- Invoice Meta -->
<tr>
<td style="padding:32px 40px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td style="vertical-align:top;">
      <p style="margin:0 0 4px;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Billed To</p>
      <p style="margin:0;color:#1a1a1a;font-size:16px;font-weight:600;">{{customer_name}}</p>
    </td>
    <td style="vertical-align:top;text-align:right;">
      <p style="margin:0 0 4px;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Invoice No.</p>
      <p style="margin:0;color:#B8860B;font-size:16px;font-weight:700;">{{invoice_number}}</p>
      <p style="margin:8px 0 0;color:#888;font-size:12px;">Date: {{date}}</p>
    </td>
  </tr>
  </table>
</td>
</tr>

<!-- Divider -->
<tr><td style="padding:24px 40px 0;"><hr style="border:none;border-top:1px solid #e5e5e5;margin:0;"/></td></tr>

<!-- Line Items -->
<tr>
<td style="padding:24px 40px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr style="background-color:#fafafa;">
    <td style="padding:10px 16px;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e5e5e5;">Description</td>
    <td style="padding:10px 16px;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;text-align:right;border-bottom:1px solid #e5e5e5;">Amount</td>
  </tr>
  <tr>
    <td style="padding:16px;color:#1a1a1a;font-size:14px;">{{description}}</td>
    <td style="padding:16px;color:#1a1a1a;font-size:14px;text-align:right;font-weight:600;">₹{{amount}}</td>
  </tr>
  </table>
</td>
</tr>

<!-- Total -->
<tr>
<td style="padding:0 40px 32px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border-radius:8px;">
  <tr>
    <td style="padding:20px 24px;">
      <p style="margin:0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Total Amount Due</p>
    </td>
    <td style="padding:20px 24px;text-align:right;">
      <p style="margin:0;color:#B8860B;font-size:24px;font-weight:700;">₹{{amount}}</p>
    </td>
  </tr>
  </table>
</td>
</tr>

<!-- Footer -->
<tr>
<td style="padding:24px 40px 32px;border-top:1px solid #e5e5e5;text-align:center;">
  <p style="margin:0 0 8px;color:#1a1a1a;font-size:14px;font-weight:600;">Thank you for choosing Apex Fashion Lab</p>
  <p style="margin:0;color:#888;font-size:12px;">For any queries, please reach out to us at connect@apexfashionlab.com</p>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>',
  '["customer_name", "amount", "invoice_number", "date", "description"]'::jsonb
) ON CONFLICT (slug) DO NOTHING;

-- Register Automations module
INSERT INTO modules (name, slug, description, icon, path, parent_slug) VALUES
  ('Automations', 'automations', 'Email automations and workflows', 'Zap', '/m/automations', NULL),
  ('Email', 'automations-email', 'Invoice emails and templates', 'Mail', '/m/automations/email', 'automations')
ON CONFLICT (slug) DO NOTHING;

-- Grant to admin roles
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r, modules m
WHERE r.is_admin = true
  AND m.slug IN ('automations', 'automations-email')
ON CONFLICT (role_id, module_id) DO NOTHING;

-- Also grant to CTO and CMTO
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r, modules m
WHERE r.name IN ('CTO', 'CMTO')
  AND m.slug IN ('automations', 'automations-email')
ON CONFLICT (role_id, module_id) DO NOTHING;


-- ============================================================
-- [32/44] 20260311000000_content_sop_tracker.sql
-- ============================================================

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


-- ============================================================
-- [33/44] 20260311010000_invoice_template_redesign.sql
-- ============================================================

-- Update invoice template to black/gold branded design with Download Invoice button
UPDATE email_templates
SET html_body = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Invoice {{invoice_number}}</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#000000;padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;border-radius:12px;overflow:hidden;border:1px solid rgba(212,175,55,0.2);">

<!-- Header -->
<tr>
<td style="background-color:#000000;padding:32px 40px;text-align:center;border-bottom:1px solid rgba(212,175,55,0.3);">
  <h1 style="margin:0;">
    <span style="font-family:Georgia,serif;color:#d4af37;font-size:28px;font-weight:700;letter-spacing:2px;">Apex</span>
    <span style="font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:28px;font-weight:300;letter-spacing:2px;margin-left:8px;">Fashion Lab</span>
  </h1>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px auto 0;">
    <tr>
      <td style="width:60px;"><hr style="border:none;border-top:1px solid rgba(212,175,55,0.4);margin:0;"/></td>
      <td style="padding:0 12px;"><p style="margin:0;color:rgba(212,175,55,0.7);font-size:10px;text-transform:uppercase;letter-spacing:3px;">Invoice</p></td>
      <td style="width:60px;"><hr style="border:none;border-top:1px solid rgba(212,175,55,0.4);margin:0;"/></td>
    </tr>
  </table>
</td>
</tr>

<!-- Invoice Meta -->
<tr>
<td style="padding:32px 40px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td style="vertical-align:top;">
      <p style="margin:0 0 4px;color:rgba(212,175,55,0.6);font-size:10px;text-transform:uppercase;letter-spacing:2px;">Billed To</p>
      <p style="margin:0;color:#ffffff;font-size:16px;font-weight:600;">{{customer_name}}</p>
    </td>
    <td style="vertical-align:top;text-align:right;">
      <p style="margin:0 0 4px;color:rgba(212,175,55,0.6);font-size:10px;text-transform:uppercase;letter-spacing:2px;">Invoice No.</p>
      <p style="margin:0;color:#d4af37;font-size:16px;font-weight:700;">{{invoice_number}}</p>
      <p style="margin:8px 0 0;color:#666666;font-size:12px;">Date: {{date}}</p>
    </td>
  </tr>
  </table>
</td>
</tr>

<!-- Divider -->
<tr><td style="padding:24px 40px 0;"><hr style="border:none;border-top:1px solid rgba(212,175,55,0.2);margin:0;"/></td></tr>

<!-- Line Items -->
<tr>
<td style="padding:24px 40px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(212,175,55,0.1);border-radius:8px;overflow:hidden;">
  <tr style="background-color:#111111;">
    <td style="padding:12px 16px;color:rgba(212,175,55,0.5);font-size:10px;text-transform:uppercase;letter-spacing:2px;border-bottom:1px solid rgba(212,175,55,0.1);">Description</td>
    <td style="padding:12px 16px;color:rgba(212,175,55,0.5);font-size:10px;text-transform:uppercase;letter-spacing:2px;text-align:right;border-bottom:1px solid rgba(212,175,55,0.1);">Amount</td>
  </tr>
  <tr>
    <td style="padding:16px;color:#ffffff;font-size:14px;">{{description}}</td>
    <td style="padding:16px;color:#ffffff;font-size:14px;text-align:right;font-weight:600;">&#x20B9;{{amount}}</td>
  </tr>
  </table>
</td>
</tr>

<!-- Total -->
<tr>
<td style="padding:0 40px 24px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#000000;border-radius:8px;border:1px solid rgba(212,175,55,0.3);">
  <tr>
    <td style="padding:20px 24px;">
      <p style="margin:0;color:rgba(212,175,55,0.6);font-size:12px;text-transform:uppercase;letter-spacing:2px;">Total Amount Due</p>
    </td>
    <td style="padding:20px 24px;text-align:right;">
      <p style="margin:0;color:#d4af37;font-size:24px;font-weight:700;">&#x20B9;{{amount}}</p>
    </td>
  </tr>
  </table>
</td>
</tr>

<!-- Download Invoice Button -->
<tr>
<td style="padding:0 40px 32px;text-align:center;">
  <a href="{{view_url}}" target="_blank" style="display:inline-block;background-color:#d4af37;color:#000000;font-size:14px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.5px;">Download Invoice</a>
</td>
</tr>

<!-- Footer -->
<tr>
<td style="background-color:#000000;border-top:1px solid rgba(212,175,55,0.2);padding:24px 40px;text-align:center;">
  <p style="margin:0 0 6px;color:#d4af37;font-size:14px;font-weight:600;">Thank you for choosing Apex Fashion Lab</p>
  <p style="margin:0 0 12px;color:#666666;font-size:12px;">For any queries, please reach out to us</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr>
      <td style="padding:0 8px;"><a href="mailto:connect@apexfashionlab.com" style="color:#d4af37;font-size:11px;text-decoration:none;">connect@apexfashionlab.com</a></td>
      <td style="color:rgba(212,175,55,0.3);font-size:11px;">|</td>
      <td style="padding:0 8px;"><span style="color:#666666;font-size:11px;">+91 93193 36498</span></td>
    </tr>
  </table>
  <hr style="border:none;border-top:1px solid rgba(212,175,55,0.15);margin:16px 0;"/>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr>
      <td style="padding:0 10px;"><a href="https://www.apexfashionlab.com" style="color:#888888;font-size:10px;text-decoration:none;">Website</a></td>
      <td style="padding:0 10px;"><a href="https://www.instagram.com/apexfashionlab" style="color:#888888;font-size:10px;text-decoration:none;">Instagram</a></td>
      <td style="padding:0 10px;"><a href="https://www.linkedin.com/company/apexfashionlab" style="color:#888888;font-size:10px;text-decoration:none;">LinkedIn</a></td>
    </tr>
  </table>
  <p style="margin:12px 0 0;color:#444444;font-size:9px;">&copy; 2026 Apex Fashion Lab. All rights reserved.</p>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>',
  variables = '["customer_name", "amount", "invoice_number", "date", "description", "view_url"]'::jsonb,
  updated_at = now()
WHERE slug = 'invoice-default';


-- ============================================================
-- [34/44] 20260311020000_meeting_analysis_sheet.sql
-- ============================================================

-- Meeting Analysis Sheet: post-meeting tracking for Maverick and Jobin
CREATE TABLE IF NOT EXISTS meeting_analysis_sheet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL,                          -- 'maverick' or 'jobin'
  opportunity_id TEXT,
  contact_id TEXT,
  calendar_event_id TEXT UNIQUE,                -- GHL event ID (dedup key)

  -- Auto-populated from GHL / call_booked
  meet_date TIMESTAMPTZ NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  meeting_link TEXT,

  -- Manual fields filled by sales reps
  recording_url TEXT,
  meeting_duration INT,                         -- minutes
  outcome TEXT,                                 -- interested, not_interested, follow_up, converted, no_show
  next_steps TEXT,
  follow_up_date DATE,
  score INT CHECK (score >= 1 AND score <= 5),
  notes TEXT,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE meeting_analysis_sheet ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can read meeting_analysis_sheet"
  ON meeting_analysis_sheet FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert meeting_analysis_sheet"
  ON meeting_analysis_sheet FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update meeting_analysis_sheet"
  ON meeting_analysis_sheet FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete meeting_analysis_sheet"
  ON meeting_analysis_sheet FOR DELETE TO authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meeting_analysis_owner_date ON meeting_analysis_sheet(owner, meet_date DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_analysis_event ON meeting_analysis_sheet(calendar_event_id);

-- Auto-update updated_at
CREATE TRIGGER set_meeting_analysis_updated_at
  BEFORE UPDATE ON meeting_analysis_sheet
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Register module
INSERT INTO modules (name, slug, description, icon, path, parent_slug) VALUES
  ('Meeting Sheet', 'meeting-analysis-sheet', 'Post-meeting analysis tracker', 'FileSpreadsheet', '/m/sales/pipeline/meetings', 'sales-pipeline')
ON CONFLICT (slug) DO NOTHING;

-- Grant to admin roles
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r, modules m
WHERE r.is_admin = true AND m.slug = 'meeting-analysis-sheet'
ON CONFLICT (role_id, module_id) DO NOTHING;

-- Grant to CTO and CMTO
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r, modules m
WHERE r.name IN ('CTO', 'CMTO') AND m.slug = 'meeting-analysis-sheet'
ON CONFLICT (role_id, module_id) DO NOTHING;


-- ============================================================
-- [35/44] 20260311030000_new_modules.sql
-- ============================================================

-- =============================================
-- New Modules: Notifications, Tasks, Finance, Leave, Chat
-- =============================================

-- ── Notifications ────────────────────────────────────
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  body text,
  type text not null,
  module text,
  link text,
  is_read boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_notifications_user on notifications(user_id, is_read, created_at desc);

alter table notifications enable row level security;
create policy "Users can view own notifications"
  on notifications for select using (auth.uid() = user_id);
create policy "Users can update own notifications"
  on notifications for update using (auth.uid() = user_id);
create policy "Service role can insert notifications"
  on notifications for insert with check (true);
create policy "Users can delete own notifications"
  on notifications for delete using (auth.uid() = user_id);

-- ── Projects ─────────────────────────────────────────
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text default 'active',
  owner_id uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table projects enable row level security;
create policy "Authenticated users can view projects"
  on projects for select using (auth.uid() is not null);
create policy "Authenticated users can insert projects"
  on projects for insert with check (auth.uid() is not null);
create policy "Authenticated users can update projects"
  on projects for update using (auth.uid() is not null);
create policy "Authenticated users can delete projects"
  on projects for delete using (auth.uid() is not null);

-- ── Tasks ────────────────────────────────────────────
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  description text,
  status text default 'todo',
  priority text default 'medium',
  assigned_to uuid references auth.users(id),
  created_by uuid references auth.users(id),
  due_date date,
  label text,
  "order" integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table tasks enable row level security;
create policy "Authenticated users can view tasks"
  on tasks for select using (auth.uid() is not null);
create policy "Authenticated users can insert tasks"
  on tasks for insert with check (auth.uid() is not null);
create policy "Authenticated users can update tasks"
  on tasks for update using (auth.uid() is not null);
create policy "Authenticated users can delete tasks"
  on tasks for delete using (auth.uid() is not null);

-- ── Task Comments ────────────────────────────────────
create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  body text not null,
  created_at timestamptz default now()
);

alter table task_comments enable row level security;
create policy "Authenticated users can view task comments"
  on task_comments for select using (auth.uid() is not null);
create policy "Authenticated users can insert task comments"
  on task_comments for insert with check (auth.uid() is not null);
create policy "Users can delete own comments"
  on task_comments for delete using (auth.uid() = user_id);

-- ── Expense Categories ──────────────────────────────
create table if not exists expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  is_active boolean default true
);

alter table expense_categories enable row level security;
create policy "Authenticated users can view expense categories"
  on expense_categories for select using (auth.uid() is not null);
create policy "Authenticated users can insert expense categories"
  on expense_categories for insert with check (auth.uid() is not null);
create policy "Authenticated users can update expense categories"
  on expense_categories for update using (auth.uid() is not null);
create policy "Authenticated users can delete expense categories"
  on expense_categories for delete using (auth.uid() is not null);

-- ── Expenses ─────────────────────────────────────────
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references expense_categories(id),
  title text not null,
  amount numeric not null,
  date date not null,
  paid_by uuid references auth.users(id),
  receipt_url text,
  notes text,
  is_recurring boolean default false,
  recurring_interval text,
  status text default 'approved',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table expenses enable row level security;
create policy "Authenticated users can view expenses"
  on expenses for select using (auth.uid() is not null);
create policy "Authenticated users can insert expenses"
  on expenses for insert with check (auth.uid() is not null);
create policy "Authenticated users can update expenses"
  on expenses for update using (auth.uid() is not null);
create policy "Authenticated users can delete expenses"
  on expenses for delete using (auth.uid() is not null);

-- ── Budgets ──────────────────────────────────────────
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department text,
  month date not null,
  planned_amount numeric not null,
  created_at timestamptz default now()
);

alter table budgets enable row level security;
create policy "Authenticated users can view budgets"
  on budgets for select using (auth.uid() is not null);
create policy "Authenticated users can insert budgets"
  on budgets for insert with check (auth.uid() is not null);
create policy "Authenticated users can update budgets"
  on budgets for update using (auth.uid() is not null);
create policy "Authenticated users can delete budgets"
  on budgets for delete using (auth.uid() is not null);

-- ── Leave Types ──────────────────────────────────────
create table if not exists leave_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  days_per_year integer not null,
  is_active boolean default true
);

alter table leave_types enable row level security;
create policy "Authenticated users can view leave types"
  on leave_types for select using (auth.uid() is not null);
create policy "Authenticated users can insert leave types"
  on leave_types for insert with check (auth.uid() is not null);
create policy "Authenticated users can update leave types"
  on leave_types for update using (auth.uid() is not null);

-- ── Leave Balances ───────────────────────────────────
create table if not exists leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references hr_employees(id) on delete cascade,
  leave_type_id uuid references leave_types(id),
  year integer not null,
  total integer not null,
  used integer default 0,
  unique(employee_id, leave_type_id, year)
);

alter table leave_balances enable row level security;
create policy "Authenticated users can view leave balances"
  on leave_balances for select using (auth.uid() is not null);
create policy "Authenticated users can insert leave balances"
  on leave_balances for insert with check (auth.uid() is not null);
create policy "Authenticated users can update leave balances"
  on leave_balances for update using (auth.uid() is not null);

-- ── Leave Requests ───────────────────────────────────
create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references hr_employees(id) not null,
  leave_type_id uuid references leave_types(id) not null,
  start_date date not null,
  end_date date not null,
  days numeric not null,
  reason text,
  status text default 'pending',
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz default now()
);

alter table leave_requests enable row level security;
create policy "Authenticated users can view leave requests"
  on leave_requests for select using (auth.uid() is not null);
create policy "Authenticated users can insert leave requests"
  on leave_requests for insert with check (auth.uid() is not null);
create policy "Authenticated users can update leave requests"
  on leave_requests for update using (auth.uid() is not null);

-- ── Holidays ─────────────────────────────────────────
create table if not exists holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date not null unique,
  is_optional boolean default false
);

alter table holidays enable row level security;
create policy "Authenticated users can view holidays"
  on holidays for select using (auth.uid() is not null);
create policy "Authenticated users can insert holidays"
  on holidays for insert with check (auth.uid() is not null);
create policy "Authenticated users can delete holidays"
  on holidays for delete using (auth.uid() is not null);

-- ── Chat Channels ────────────────────────────────────
create table if not exists chat_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  type text default 'channel',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table chat_channels enable row level security;
create policy "Authenticated users can view chat channels"
  on chat_channels for select using (auth.uid() is not null);
create policy "Authenticated users can insert chat channels"
  on chat_channels for insert with check (auth.uid() is not null);
create policy "Authenticated users can update chat channels"
  on chat_channels for update using (auth.uid() is not null);

-- ── Chat Members ─────────────────────────────────────
create table if not exists chat_members (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references chat_channels(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  last_read_at timestamptz default now(),
  unique(channel_id, user_id)
);

alter table chat_members enable row level security;
create policy "Authenticated users can view chat members"
  on chat_members for select using (auth.uid() is not null);
create policy "Authenticated users can insert chat members"
  on chat_members for insert with check (auth.uid() is not null);
create policy "Authenticated users can update own membership"
  on chat_members for update using (auth.uid() = user_id);
create policy "Authenticated users can delete chat members"
  on chat_members for delete using (auth.uid() is not null);

-- ── Chat Messages ────────────────────────────────────
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references chat_channels(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  body text not null,
  attachment_url text,
  created_at timestamptz default now()
);
create index if not exists idx_chat_messages_channel on chat_messages(channel_id, created_at desc);

alter table chat_messages enable row level security;
create policy "Authenticated users can view chat messages"
  on chat_messages for select using (auth.uid() is not null);
create policy "Authenticated users can insert chat messages"
  on chat_messages for insert with check (auth.uid() is not null);

-- ── Enable Realtime for chat_messages ────────────────
alter publication supabase_realtime add table chat_messages;

-- ── Register new modules ────────────────────────────
insert into modules (name, slug, description, icon, parent_slug, path, "order", is_active) values
  ('Tasks', 'tasks', 'Task management, projects & kanban board', 'ClipboardList', null, '/m/tasks', 6, true),
  ('Board', 'tasks-board', 'Kanban board view for tasks', 'LayoutDashboard', 'tasks', '/m/tasks/board', 1, true),
  ('Finance', 'finance', 'Expenses, budgets, and financial tracking', 'Landmark', null, '/m/finance', 7, true),
  ('Expenses', 'finance-expenses', 'Expense log and tracking', 'Receipt', 'finance', '/m/finance/expenses', 1, true),
  ('Budgets', 'finance-budgets', 'Budget planning and tracking', 'Wallet', 'finance', '/m/finance/budgets', 2, true),
  ('Categories', 'finance-categories', 'Expense category management', 'FolderOpen', 'finance', '/m/finance/categories', 3, true),
  ('Chat', 'chat', 'Internal team messaging and channels', 'MessageSquare', null, '/m/chat', 8, true),
  ('Leaves', 'hr-leaves', 'Leave requests and approval workflow', 'CalendarOff', 'hr', '/m/hr/leaves', 9, true),
  ('Holidays', 'hr-holidays', 'Company holiday calendar', 'PartyPopper', 'hr', '/m/hr/holidays', 10, true)
on conflict (slug) do nothing;

-- ── Seed default leave types ─────────────────────────
insert into leave_types (name, days_per_year) values
  ('Casual Leave', 12),
  ('Sick Leave', 6),
  ('Earned Leave', 15)
on conflict do nothing;

-- ── Seed default expense categories ──────────────────
insert into expense_categories (name, icon) values
  ('Office Rent', 'Building2'),
  ('Salaries', 'Users'),
  ('Software & Tools', 'Laptop'),
  ('Marketing', 'Megaphone'),
  ('Travel', 'Plane'),
  ('Utilities', 'Lightbulb'),
  ('Miscellaneous', 'MoreHorizontal')
on conflict do nothing;

-- ── Create #general chat channel ─────────────────────
insert into chat_channels (name, description, type) values
  ('general', 'Company-wide announcements and discussions', 'channel')
on conflict do nothing;


-- ============================================================
-- [36/44] 20260311040000_chat_threads_reactions.sql
-- ============================================================

-- =============================================
-- Chat: Threads, Reactions, Edit/Delete support
-- =============================================

-- Add parent_id for threaded replies
alter table chat_messages add column if not exists parent_id uuid references chat_messages(id) on delete cascade;
-- Add reply_count cache on parent messages
alter table chat_messages add column if not exists reply_count integer default 0;
-- Add edited_at for edit tracking
alter table chat_messages add column if not exists edited_at timestamptz;
-- Add is_deleted soft-delete
alter table chat_messages add column if not exists is_deleted boolean default false;

create index if not exists idx_chat_messages_parent on chat_messages(parent_id, created_at);

-- Emoji reactions
create table if not exists chat_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references chat_messages(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  emoji text not null,
  created_at timestamptz default now(),
  unique(message_id, user_id, emoji)
);

create index if not exists idx_chat_reactions_message on chat_reactions(message_id);

alter table chat_reactions enable row level security;
create policy "Authenticated users can view reactions"
  on chat_reactions for select using (auth.uid() is not null);
create policy "Authenticated users can insert reactions"
  on chat_reactions for insert with check (auth.uid() is not null);
create policy "Users can delete own reactions"
  on chat_reactions for delete using (auth.uid() = user_id);


-- ============================================================
-- [37/44] 20260312000000_schema_fixes.sql
-- ============================================================

-- =============================================
-- Schema Fixes
-- 1. updated_at triggers for all tables that have the column but no trigger
-- 2. Fix expenses.status default (approved → pending)
-- 3. Re-grant HR Settings module to admin roles (is_admin column doesn't exist)
-- 4. Add updated_at to projects and budgets
-- 5. Add missing indexes
-- =============================================

-- ── 1. updated_at triggers ───────────────────────────────────

CREATE TRIGGER set_updated_at_hr_departments
  BEFORE UPDATE ON hr_departments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_hr_employees
  BEFORE UPDATE ON hr_employees FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_hr_commission_rules
  BEFORE UPDATE ON hr_commission_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_hr_salary_cycles
  BEFORE UPDATE ON hr_salary_cycles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_hr_kpi_entries
  BEFORE UPDATE ON hr_kpi_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_hr_kras
  BEFORE UPDATE ON hr_kras FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_tasks
  BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 2. Fix expenses.status default ───────────────────────────

ALTER TABLE expenses ALTER COLUMN status SET DEFAULT 'pending';

-- ── 3. Re-grant HR Settings to admin roles ────────────────────
-- hr_settings_bridge.sql used r.is_admin which doesn't exist on the roles table.
-- Re-run using role name instead.

INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r, modules m
WHERE r.name IN ('CTO', 'Admin') AND m.slug = 'hr-settings'
ON CONFLICT (role_id, module_id) DO NOTHING;

-- ── 4. Add updated_at to projects and budgets ─────────────────

ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE budgets  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE TRIGGER set_updated_at_projects
  BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_budgets
  BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 5. Missing indexes ────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tasks_project    ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned   ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date    ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_status  ON expenses(status);


-- ============================================================
-- [38/44] 20260313000000_tighten_rls.sql
-- ============================================================

-- ============================================================
-- Tighten RLS: Tasks, Finance, Chat
-- ============================================================
-- NOTE: All API routes use supabaseAdmin (service-role key),
-- which bypasses RLS entirely. The app-layer requireModuleAccess()
-- checks are the primary enforcement. These RLS policies add
-- defense-in-depth for:
--   1. Direct Supabase dashboard access
--   2. Realtime subscriptions (anon/user-context client)
--   3. Any future user-context queries
-- ============================================================

-- ── Helper: check if current user has module access ──────────────
-- SECURITY DEFINER so it can query role_modules/modules safely.
CREATE OR REPLACE FUNCTION user_has_module_access(module_slug TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role_id UUID;
  _has_access BOOLEAN := false;
BEGIN
  SELECT role_id INTO _role_id
  FROM users
  WHERE id = auth.uid();

  IF _role_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check role-based access
  SELECT EXISTS (
    SELECT 1
    FROM role_modules rm
    JOIN modules m ON m.id = rm.module_id
    WHERE rm.role_id = _role_id
      AND m.slug = module_slug
      AND m.is_active = true
  ) INTO _has_access;

  IF _has_access THEN RETURN true; END IF;

  -- Check user override grant
  SELECT EXISTS (
    SELECT 1
    FROM user_module_overrides umo
    JOIN modules m ON m.id = umo.module_id
    WHERE umo.user_id = auth.uid()
      AND umo.access_type = 'grant'
      AND m.slug = module_slug
      AND m.is_active = true
  ) INTO _has_access;

  RETURN _has_access;
END;
$$;

-- ── TASKS ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated users can insert tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated users can update tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated users can delete tasks" ON tasks;

CREATE POLICY "tasks_select"
  ON tasks FOR SELECT TO authenticated
  USING (user_has_module_access('tasks'));

CREATE POLICY "tasks_insert"
  ON tasks FOR INSERT TO authenticated
  WITH CHECK (user_has_module_access('tasks'));

CREATE POLICY "tasks_update"
  ON tasks FOR UPDATE TO authenticated
  USING (user_has_module_access('tasks'));

CREATE POLICY "tasks_delete"
  ON tasks FOR DELETE TO authenticated
  USING (user_has_module_access('tasks'));

-- ── PROJECTS ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can insert projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can update projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can delete projects" ON projects;

CREATE POLICY "projects_select"
  ON projects FOR SELECT TO authenticated
  USING (user_has_module_access('tasks'));

CREATE POLICY "projects_insert"
  ON projects FOR INSERT TO authenticated
  WITH CHECK (user_has_module_access('tasks'));

CREATE POLICY "projects_update"
  ON projects FOR UPDATE TO authenticated
  USING (user_has_module_access('tasks'));

CREATE POLICY "projects_delete"
  ON projects FOR DELETE TO authenticated
  USING (user_has_module_access('tasks'));

-- ── TASK COMMENTS ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view task comments" ON task_comments;
DROP POLICY IF EXISTS "Authenticated users can insert task comments" ON task_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON task_comments;

CREATE POLICY "task_comments_select"
  ON task_comments FOR SELECT TO authenticated
  USING (user_has_module_access('tasks'));

CREATE POLICY "task_comments_insert"
  ON task_comments FOR INSERT TO authenticated
  WITH CHECK (user_has_module_access('tasks') AND user_id = auth.uid());

CREATE POLICY "task_comments_delete"
  ON task_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── EXPENSES ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON expenses;
DROP POLICY IF EXISTS "Authenticated users can insert expenses" ON expenses;
DROP POLICY IF EXISTS "Authenticated users can update expenses" ON expenses;
DROP POLICY IF EXISTS "Authenticated users can delete expenses" ON expenses;

CREATE POLICY "expenses_select"
  ON expenses FOR SELECT TO authenticated
  USING (user_has_module_access('finance'));

CREATE POLICY "expenses_insert"
  ON expenses FOR INSERT TO authenticated
  WITH CHECK (user_has_module_access('finance'));

CREATE POLICY "expenses_update"
  ON expenses FOR UPDATE TO authenticated
  USING (user_has_module_access('finance'));

CREATE POLICY "expenses_delete"
  ON expenses FOR DELETE TO authenticated
  USING (user_has_module_access('finance'));

-- ── EXPENSE CATEGORIES ───────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view expense categories" ON expense_categories;
DROP POLICY IF EXISTS "Authenticated users can insert expense categories" ON expense_categories;
DROP POLICY IF EXISTS "Authenticated users can update expense categories" ON expense_categories;
DROP POLICY IF EXISTS "Authenticated users can delete expense categories" ON expense_categories;

CREATE POLICY "expense_categories_select"
  ON expense_categories FOR SELECT TO authenticated
  USING (user_has_module_access('finance'));

CREATE POLICY "expense_categories_insert"
  ON expense_categories FOR INSERT TO authenticated
  WITH CHECK (user_has_module_access('finance'));

CREATE POLICY "expense_categories_update"
  ON expense_categories FOR UPDATE TO authenticated
  USING (user_has_module_access('finance'));

CREATE POLICY "expense_categories_delete"
  ON expense_categories FOR DELETE TO authenticated
  USING (user_has_module_access('finance'));

-- ── BUDGETS ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view budgets" ON budgets;
DROP POLICY IF EXISTS "Authenticated users can insert budgets" ON budgets;
DROP POLICY IF EXISTS "Authenticated users can update budgets" ON budgets;
DROP POLICY IF EXISTS "Authenticated users can delete budgets" ON budgets;

CREATE POLICY "budgets_select"
  ON budgets FOR SELECT TO authenticated
  USING (user_has_module_access('finance'));

CREATE POLICY "budgets_insert"
  ON budgets FOR INSERT TO authenticated
  WITH CHECK (user_has_module_access('finance'));

CREATE POLICY "budgets_update"
  ON budgets FOR UPDATE TO authenticated
  USING (user_has_module_access('finance'));

CREATE POLICY "budgets_delete"
  ON budgets FOR DELETE TO authenticated
  USING (user_has_module_access('finance'));

-- ── CHAT CHANNELS ────────────────────────────────────────────────
-- Users can only see channels they are a member of
DROP POLICY IF EXISTS "Authenticated users can view chat channels" ON chat_channels;
DROP POLICY IF EXISTS "Authenticated users can insert chat channels" ON chat_channels;
DROP POLICY IF EXISTS "Authenticated users can update chat channels" ON chat_channels;
DROP POLICY IF EXISTS "Authenticated users can delete chat channels" ON chat_channels;

CREATE POLICY "chat_channels_select"
  ON chat_channels FOR SELECT TO authenticated
  USING (
    user_has_module_access('chat')
    AND EXISTS (
      SELECT 1 FROM chat_members
      WHERE chat_members.channel_id = chat_channels.id
        AND chat_members.user_id = auth.uid()
    )
  );

CREATE POLICY "chat_channels_insert"
  ON chat_channels FOR INSERT TO authenticated
  WITH CHECK (
    user_has_module_access('chat')
    AND created_by = auth.uid()
  );

CREATE POLICY "chat_channels_update"
  ON chat_channels FOR UPDATE TO authenticated
  USING (
    user_has_module_access('chat')
    AND created_by = auth.uid()
  );

CREATE POLICY "chat_channels_delete"
  ON chat_channels FOR DELETE TO authenticated
  USING (
    user_has_module_access('chat')
    AND created_by = auth.uid()
  );

-- ── CHAT MESSAGES ────────────────────────────────────────────────
-- Users can only see/send messages in channels they are a member of
DROP POLICY IF EXISTS "Authenticated users can view chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Authenticated users can insert chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Authenticated users can update chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Authenticated users can delete chat messages" ON chat_messages;

CREATE POLICY "chat_messages_select"
  ON chat_messages FOR SELECT TO authenticated
  USING (
    user_has_module_access('chat')
    AND EXISTS (
      SELECT 1 FROM chat_members
      WHERE chat_members.channel_id = chat_messages.channel_id
        AND chat_members.user_id = auth.uid()
    )
  );

CREATE POLICY "chat_messages_insert"
  ON chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_has_module_access('chat')
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM chat_members
      WHERE chat_members.channel_id = chat_messages.channel_id
        AND chat_members.user_id = auth.uid()
    )
  );

CREATE POLICY "chat_messages_update"
  ON chat_messages FOR UPDATE TO authenticated
  USING (
    user_has_module_access('chat')
    AND user_id = auth.uid()
  );

CREATE POLICY "chat_messages_delete"
  ON chat_messages FOR DELETE TO authenticated
  USING (
    user_has_module_access('chat')
    AND user_id = auth.uid()
  );


-- ============================================================
-- [39/44] 20260314000000_sync_all_modules.sql
-- ============================================================

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


-- ============================================================
-- [40/44] 005_create_user_module_overrides.sql
-- ============================================================

-- Ensure user_module_overrides table exists (fixes crash in /api/modules/effective)
CREATE TABLE IF NOT EXISTS user_module_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL CHECK (access_type IN ('grant', 'revoke')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_id)
);

ALTER TABLE user_module_overrides ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- [41/44] 20260315000000_scope_levels.sql
-- ============================================================

-- Phase 0.2: scope_levels table
-- Defines the 4 data visibility tiers: admin, manager, employee, client

CREATE TABLE IF NOT EXISTS scope_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  rank INT NOT NULL,
  data_visibility TEXT NOT NULL CHECK (data_visibility IN ('all', 'team', 'self')),
  can_delete BOOLEAN NOT NULL DEFAULT false,
  is_system BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE scope_levels ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read scope levels
CREATE POLICY "Authenticated users can read scope_levels"
  ON scope_levels FOR SELECT TO authenticated
  USING (true);

-- Only admins can write scope levels
CREATE POLICY "Admins can manage scope_levels"
  ON scope_levels FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Seed 4 default scope levels
INSERT INTO scope_levels (name, slug, rank, data_visibility, can_delete, is_system, description) VALUES
  ('Admin', 'admin', 1, 'all', true, true, 'Full access to all data, can delete records'),
  ('Manager', 'manager', 2, 'team', false, true, 'Can see direct reports data via reporting_to hierarchy'),
  ('Employee', 'employee', 3, 'self', false, true, 'Can only see own data'),
  ('Client', 'client', 4, 'self', false, true, 'Limited read access to own data only');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scope_levels_slug ON scope_levels(slug);

-- Grants
GRANT SELECT ON scope_levels TO authenticated;
GRANT ALL ON scope_levels TO service_role;


-- ============================================================
-- [42/44] 20260315010000_role_module_permissions.sql
-- ============================================================

-- Phase 0.3: role_module_permissions table
-- Action-level permissions per role per module (replaces simple ON/OFF in role_modules)
-- No can_delete column — delete is admin-only in code, never in the matrix

CREATE TABLE IF NOT EXISTS role_module_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  can_read BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_approve BOOLEAN NOT NULL DEFAULT false,
  can_export BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role_id, module_id)
);

ALTER TABLE role_module_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can read/write all
CREATE POLICY "Admins can manage role_module_permissions"
  ON role_module_permissions FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Authenticated users can read their own role's permissions
CREATE POLICY "Users can read own role permissions"
  ON role_module_permissions FOR SELECT TO authenticated
  USING (
    role_id IN (
      SELECT u.role_id FROM users u WHERE u.id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_role_module_permissions_role ON role_module_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_module_permissions_module ON role_module_permissions(module_id);

-- Migrate existing data from role_modules:
-- For every existing role_modules row, create a role_module_permissions row with can_read = true
INSERT INTO role_module_permissions (role_id, module_id, can_read, can_create, can_edit, can_approve, can_export)
SELECT rm.role_id, rm.module_id, true, false, false, false, false
FROM role_modules rm
ON CONFLICT (role_id, module_id) DO NOTHING;

-- Grants
GRANT SELECT ON role_module_permissions TO authenticated;
GRANT ALL ON role_module_permissions TO service_role;


-- ============================================================
-- [43/44] 20260315020000_user_permission_overrides.sql
-- ============================================================

-- Phase 0.4: user_permission_overrides table
-- Per-user action-level overrides on top of role_module_permissions
-- Allows granting or revoking specific actions for individual users

CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('read', 'create', 'edit', 'approve', 'export')),
  granted BOOLEAN NOT NULL DEFAULT false,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_id, action)
);

ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- Admins can read/write all
CREATE POLICY "Admins can manage user_permission_overrides"
  ON user_permission_overrides FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Users can read their own overrides
CREATE POLICY "Users can read own permission overrides"
  ON user_permission_overrides FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user ON user_permission_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_module ON user_permission_overrides(module_id);

-- Grants
GRANT SELECT ON user_permission_overrides TO authenticated;
GRANT ALL ON user_permission_overrides TO service_role;


-- ============================================================
-- [44/44] 20260315030000_roles_scope_level.sql
-- ============================================================

-- Phase 0.5: Add scope_level_id FK to roles table
-- Nullable — null means auto-detect scope from hr_employees hierarchy

ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS scope_level_id UUID REFERENCES scope_levels(id);

CREATE INDEX IF NOT EXISTS idx_roles_scope_level ON roles(scope_level_id);

