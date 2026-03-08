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
