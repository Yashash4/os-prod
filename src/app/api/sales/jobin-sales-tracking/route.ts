import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { scopeQuery, verifyScopeAccess } from "@/lib/data-scope";

// GET: Fetch won leads from call_booked_tracking joined with sales tracking data
// Only shows leads with ghl_status='won'
export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "sales", "jobin");
  if ("error" in result) return result.error;
  try {
    const { data: repRow } = await supabaseAdmin.from("hr_employees").select("id").ilike("full_name", "%jobin%").eq("is_sales_rep", true).single();
    const jobinRepId = repRow?.id;
    let cbQuery = supabaseAdmin
      .from("sales_opportunities")
      .select("*")
      .eq("ghl_status", "won")
      .order("created_at", { ascending: false });

    cbQuery = scopeQuery(cbQuery, result.scope, "assigned_to");

    const { data: callBooked, error: cbError } = await cbQuery;

    if (cbError) throw cbError;

    let salesQ = supabaseAdmin.from("sales_deals").select("*");
    if (jobinRepId) salesQ = salesQ.eq("sales_rep_id", jobinRepId);
    const { data: salesData, error: salesError } = await salesQ;

    if (salesError) throw salesError;

    const salesMap: Record<string, (typeof salesData)[0]> = {};
    (salesData || []).forEach((s) => {
      salesMap[s.opportunity_id] = s;
    });

    const merged = (callBooked || []).map((cb) => ({
      opportunity_id: cb.id,
      ...cb,
      closed_date: salesMap[cb.id]?.closed_date || null,
      fees_quoted: salesMap[cb.id]?.fees_quoted || 0,
      fees_collected: salesMap[cb.id]?.fees_collected || 0,
      pending_amount: salesMap[cb.id]?.pending_amount || 0,
      payment_mode: salesMap[cb.id]?.payment_mode || null,
      invoice_number: salesMap[cb.id]?.invoice_number || null,
      collection_status: salesMap[cb.id]?.collection_status || "pending",
      onboarding_status: salesMap[cb.id]?.onboarding_status || "not_started",
      sales_notes: salesMap[cb.id]?.notes || null,
    }));

    return NextResponse.json({ records: merged, _permissions: result.permissions });
  } catch (error: unknown) {
    const e = error as { message?: string; details?: string; hint?: string; code?: string };
    console.error("SALES ROUTE ERROR in jobin-sales-tracking:", e.message, "| details:", e.details, "| hint:", e.hint, "| code:", e.code);
    const message = e.message || "Failed to fetch sales data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT: Upsert a sales tracking record
export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "sales", "jobin");
  if ("error" in result) return result.error;

  if (!result.permissions.canEdit) {
    return NextResponse.json({ error: "You do not have permission to edit records" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { opportunity_id, ...updates } = body;

    if (!opportunity_id) {
      return NextResponse.json({ error: "opportunity_id is required" }, { status: 400 });
    }

    const allowed = await verifyScopeAccess(result.scope, "sales_opportunities", opportunity_id, "assigned_to", false, "opportunity_id");
    if (!allowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });

    const { data: repRow2 } = await supabaseAdmin.from("hr_employees").select("id").ilike("full_name", "%jobin%").eq("is_sales_rep", true).single();
    // Sanitize TEXT NOT NULL fields — null violates NOT NULL constraint
    if (updates.payment_mode === null || updates.payment_mode === undefined) updates.payment_mode = "";
    if (updates.notes === null || updates.notes === undefined) updates.notes = "";
    if (updates.contact_email === null || updates.contact_email === undefined) updates.contact_email = "";
    const { data, error } = await supabaseAdmin
      .from("sales_deals")
      .upsert(
        { opportunity_id, sales_rep_id: repRow2?.id, ...updates },
        { onConflict: "opportunity_id" }
      )
      .select()
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (error: unknown) {
    const e = error as { message?: string; details?: string; hint?: string; code?: string };
    console.error("SALES ROUTE ERROR in jobin-sales-tracking:", e.message, "| details:", e.details, "| hint:", e.hint, "| code:", e.code);
    const message = e.message || "Failed to update sales tracking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
