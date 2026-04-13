import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { scopeQuery, verifyScopeAccess } from "@/lib/data-scope";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "payments", "payments-outstanding");
  if ("error" in result) return result.error;
  try {
    let query = supabaseAdmin
      .from("payments_invoice_follow_ups")
      .select("*")
      .order("created_at", { ascending: false });

    query = scopeQuery(query, result.scope, "created_by");

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json({ records: data || [], _permissions: result.permissions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch follow-ups";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "payments", "payments-outstanding");
  if ("error" in result) return result.error;

  if (!result.permissions.canCreate) {
    return NextResponse.json({ error: "You do not have permission to create follow-ups" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { razorpay_invoice_id, customer_name, customer_email, customer_phone, amount_due, due_date } = body;

    if (!razorpay_invoice_id || !amount_due) {
      return NextResponse.json({ error: "razorpay_invoice_id and amount_due are required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("payments_invoice_follow_ups")
      .upsert(
        {
          razorpay_invoice_id,
          customer_name: customer_name || null,
          customer_email: customer_email || null,
          customer_phone: customer_phone || null,
          amount_due: Math.round(amount_due),
          due_date: due_date || null,
          follow_up_status: "pending",
          created_by: result.auth.userId,
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
  const result = await requireSubModuleAccess(req, "payments", "payments-outstanding");
  if ("error" in result) return result.error;

  if (!result.permissions.canEdit) {
    return NextResponse.json({ error: "You do not have permission to edit follow-ups" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const allowed = await verifyScopeAccess(result.scope, "invoice_follow_ups", id, "created_by");
    if (!allowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });

    // Auto-set contacted timestamp and increment count
    if (updates.follow_up_status === "contacted") {
      updates.last_contacted_at = new Date().toISOString();
      // Increment follow_up_count via raw SQL or fetch-then-update
    }

    const { data, error } = await supabaseAdmin
      .from("payments_invoice_follow_ups")
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
