import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireModuleAccess(req, "payments");
  if ("error" in auth) return auth.error;
  try {
    const { data, error } = await supabaseAdmin
      .from("invoice_follow_ups")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ records: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch follow-ups";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireModuleAccess(req, "payments");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const { razorpay_invoice_id, customer_name, customer_email, customer_phone, amount_due, due_date } = body;

    if (!razorpay_invoice_id || !amount_due) {
      return NextResponse.json({ error: "razorpay_invoice_id and amount_due are required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("invoice_follow_ups")
      .upsert(
        {
          razorpay_invoice_id,
          customer_name: customer_name || null,
          customer_email: customer_email || null,
          customer_phone: customer_phone || null,
          amount_due: Math.round(amount_due),
          due_date: due_date || null,
          follow_up_status: "pending",
          created_by: auth.auth.userId,
        },
        { onConflict: "razorpay_invoice_id" }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create follow-up";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireModuleAccess(req, "payments");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Auto-set contacted timestamp and increment count
    if (updates.follow_up_status === "contacted") {
      updates.last_contacted_at = new Date().toISOString();
      // Increment follow_up_count via raw SQL or fetch-then-update
    }

    const { data, error } = await supabaseAdmin
      .from("invoice_follow_ups")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update follow-up";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
