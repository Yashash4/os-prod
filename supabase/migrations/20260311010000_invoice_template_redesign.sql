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
