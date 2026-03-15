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
    let cbQuery = supabaseAdmin
      .from("sales_call_booked_tracking")
      .select("*")
      .eq("ghl_status", "won")
      .order("created_at", { ascending: false });

    cbQuery = scopeQuery(cbQuery, result.scope, "assigned_to");

    const { data: callBooked, error: cbError } = await cbQuery;

    if (cbError) throw cbError;

    const { data: salesData, error: salesError } = await supabaseAdmin
      .from("jobin_sales_tracking")
      .select("*");

    if (salesError) throw salesError;

    const salesMap: Record<string, (typeof salesData)[0]> = {};
    (salesData || []).forEach((s) => {
      salesMap[s.opportunity_id] = s;
    });

    const merged = (callBooked || []).map((cb) => ({
      ...cb,
      closed_date: salesMap[cb.opportunity_id]?.closed_date || null,
      fees_quoted: salesMap[cb.opportunity_id]?.fees_quoted || 0,
      fees_collected: salesMap[cb.opportunity_id]?.fees_collected || 0,
      pending_amount: salesMap[cb.opportunity_id]?.pending_amount || 0,
      payment_mode: salesMap[cb.opportunity_id]?.payment_mode || null,
      invoice_number: salesMap[cb.opportunity_id]?.invoice_number || null,
      collection_status: salesMap[cb.opportunity_id]?.collection_status || "pending",
      onboarding_status: salesMap[cb.opportunity_id]?.onboarding_status || "not_started",
      sales_notes: salesMap[cb.opportunity_id]?.notes || null,
    }));

    return NextResponse.json({ records: merged, _permissions: result.permissions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sales data";
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

    const allowed = await verifyScopeAccess(result.scope, "jobin_sales_tracking", opportunity_id, "assigned_to", false, "opportunity_id");
    if (!allowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from("jobin_sales_tracking")
      .upsert(
        { opportunity_id, ...updates },
        { onConflict: "opportunity_id" }
      )
      .select()
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update sales tracking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
