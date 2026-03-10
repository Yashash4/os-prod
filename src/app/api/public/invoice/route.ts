import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Public endpoint — no auth required (invoice links shared via email)
export async function GET(req: NextRequest) {
  try {
    const invoiceNumber = req.nextUrl.searchParams.get("invoice_number");

    if (!invoiceNumber) {
      return NextResponse.json({ error: "invoice_number is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("sent_invoices")
      .select("invoice_number, recipient_name, recipient_email, amount, sent_at")
      .eq("invoice_number", invoiceNumber)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json({ invoice: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
