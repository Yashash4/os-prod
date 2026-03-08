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
