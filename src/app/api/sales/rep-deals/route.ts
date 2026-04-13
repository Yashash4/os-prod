import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { scopeQuery, verifyScopeAccess } from "@/lib/data-scope";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET: Fetch won leads from sales_opportunities merged with sales_deals for a specific rep
export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "sales", "rep-sales-management");
  if ("error" in result) return result.error;

  const repId = req.nextUrl.searchParams.get("repId");
  if (!repId) {
    return NextResponse.json({ error: "repId query parameter is required" }, { status: 400 });
  }

  try {
    // Fetch won deals from sales_opportunities
    let cbQuery = supabaseAdmin
      .from("sales_opportunities")
      .select("*")
      .eq("ghl_status", "won")
      .order("created_at", { ascending: false });

    cbQuery = scopeQuery(cbQuery, result.scope, "assigned_to");

    const { data: callBooked, error: cbError } = await cbQuery;
    if (cbError) throw cbError;

    // Fetch sales_deals for this rep
    const { data: salesData, error: salesError } = await supabaseAdmin
      .from("sales_deals")
      .select("*")
      .eq("sales_rep_id", repId);

    if (salesError) throw salesError;

    // Build map by opportunity_id
    const salesMap: Record<string, (typeof salesData)[0]> = {};
    (salesData || []).forEach((s) => {
      salesMap[s.opportunity_id] = s;
    });

    // Merge
    const merged = (callBooked || []).map((cb) => ({
      ...cb,
      opportunity_id: cb.id,
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
    console.error("REP-DEALS GET ERROR:", e.message, "| details:", e.details, "| hint:", e.hint);
    return NextResponse.json({ error: e.message || "Failed to fetch sales data" }, { status: 500 });
  }
}

// PUT: Upsert a sales deal record for a rep
export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "sales", "rep-sales-management");
  if ("error" in result) return result.error;

  if (!result.permissions.canEdit) {
    return NextResponse.json({ error: "You do not have permission to edit records" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { opportunity_id, ...updates } = body;
    const repId = req.nextUrl.searchParams.get("repId");

    if (!opportunity_id) {
      return NextResponse.json({ error: "opportunity_id is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("sales_deals")
      .upsert(
        {
          opportunity_id,
          sales_rep_id: repId,
          ...updates,
          payment_mode: updates.payment_mode || "",
          notes: updates.notes || "",
          contact_email: updates.contact_email || "",
        },
        { onConflict: "opportunity_id,sales_rep_id" }
      )
      .select()
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (error: unknown) {
    const e = error as { message?: string; details?: string; hint?: string; code?: string };
    console.error("REP-DEALS PUT ERROR:", e.message, "| details:", e.details, "| hint:", e.hint);
    return NextResponse.json({ error: e.message || "Failed to update sales tracking" }, { status: 500 });
  }
}
