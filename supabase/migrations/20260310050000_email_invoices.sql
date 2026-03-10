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
