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
