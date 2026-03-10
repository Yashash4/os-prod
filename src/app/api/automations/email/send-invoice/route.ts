import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { authenticateRequest } from "@/lib/api-auth";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { opportunity_id, recipient_email, recipient_name, amount, description, sales_source } = body;

    if (!opportunity_id || !recipient_email || !amount) {
      return NextResponse.json({ error: "opportunity_id, recipient_email, and amount are required" }, { status: 400 });
    }

    // Fetch template
    const { data: template, error: tplError } = await supabaseAdmin
      .from("email_templates")
      .select("*")
      .eq("slug", "invoice-default")
      .eq("is_active", true)
      .single();

    if (tplError || !template) {
      return NextResponse.json({ error: "Invoice template not found" }, { status: 500 });
    }

    // Generate invoice number atomically
    const { data: seqData, error: seqError } = await supabaseAdmin
      .rpc("nextval_text", { seq_name: "invoice_number_seq" });

    let invoiceNumber: string;
    if (seqError || !seqData) {
      // Fallback: use timestamp-based number
      invoiceNumber = `AFL-INV-${Date.now().toString().slice(-6)}`;
    } else {
      invoiceNumber = `AFL-INV-${String(seqData).padStart(4, "0")}`;
    }

    // Build public invoice view URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const viewUrl = `${baseUrl}/invoice/${encodeURIComponent(invoiceNumber)}`;

    // Replace template variables
    const vars: Record<string, string> = {
      customer_name: recipient_name || "Customer",
      amount: Number(amount).toLocaleString("en-IN"),
      invoice_number: invoiceNumber,
      date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      description: description || "Professional services — Apex Fashion Lab",
      view_url: viewUrl,
    };

    let subject = template.subject;
    let html = template.html_body;
    for (const [key, val] of Object.entries(vars)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      subject = subject.replace(regex, val);
      html = html.replace(regex, val);
    }

    // Send via Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "Apex Fashion Lab <connect@apexfashionlab.com>",
      to: recipient_email,
      subject,
      html,
    });

    const resendId = emailData?.id || null;
    const emailStatus = emailError ? "failed" : "sent";

    // Log to sent_invoices
    await supabaseAdmin.from("sent_invoices").insert({
      opportunity_id,
      invoice_number: invoiceNumber,
      recipient_email,
      recipient_name: recipient_name || null,
      amount,
      template_slug: "invoice-default",
      resend_message_id: resendId,
      status: emailStatus,
      sent_by: auth.auth.userId,
    });

    // Update sales tracking record with invoice number
    if (sales_source === "maverick" || sales_source === "jobin") {
      const table = sales_source === "maverick" ? "maverick_sales_tracking" : "jobin_sales_tracking";
      await supabaseAdmin
        .from(table)
        .upsert(
          { opportunity_id, invoice_number: invoiceNumber },
          { onConflict: "opportunity_id" }
        );
    }

    // Tier 1 audit log
    await supabaseAdmin.from("audit_logs").insert({
      user_id: auth.auth.userId,
      tier: 1,
      action: "invoice_sent",
      module: "automations",
      breadcrumb: "APEX OS > Automations > Email",
      entity_type: "sent_invoice",
      entity_id: opportunity_id,
      after_value: { invoice_number: invoiceNumber, recipient_email, amount, status: emailStatus },
    });

    if (emailError) {
      return NextResponse.json({
        error: `Email send failed: ${emailError.message}`,
        invoice_number: invoiceNumber,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      invoice_number: invoiceNumber,
      resend_id: resendId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send invoice";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
