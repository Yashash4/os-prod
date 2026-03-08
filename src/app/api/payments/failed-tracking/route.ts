import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  try {
    const { data, error } = await supabaseAdmin
      .from("failed_payment_tracking")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ records: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch records";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const { razorpay_payment_id, contact_name, contact_email, contact_phone, amount, original_status } = body;

    if (!razorpay_payment_id || !amount) {
      return NextResponse.json({ error: "razorpay_payment_id and amount are required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("failed_payment_tracking")
      .upsert(
        {
          razorpay_payment_id,
          contact_name: contact_name || null,
          contact_email: contact_email || null,
          contact_phone: contact_phone || null,
          amount: Math.round(amount),
          original_status: original_status || "failed",
          follow_up_status: "pending",
          created_by: auth.auth.userId,
        },
        { onConflict: "razorpay_payment_id" }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create record";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Auto-set timestamps based on status changes
    if (updates.follow_up_status === "contacted" && !updates.contacted_at) {
      updates.contacted_at = new Date().toISOString();
    }
    if (updates.follow_up_status === "resolved" && !updates.resolved_at) {
      updates.resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from("failed_payment_tracking")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update record";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
