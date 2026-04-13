import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { scopeQuery, verifyScopeAccess } from "@/lib/data-scope";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET: Fetch sales_opportunities (call booked data) merged with sales_meetings for a specific rep
export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "sales", "rep-meet-management");
  if ("error" in result) return result.error;

  const repId = req.nextUrl.searchParams.get("repId");
  if (!repId) {
    return NextResponse.json({ error: "repId query parameter is required" }, { status: 400 });
  }

  try {
    // Fetch call_booked (sales_opportunities) scoped by assigned_to
    let cbQuery = supabaseAdmin
      .from("sales_opportunities")
      .select("*")
      .order("created_at", { ascending: false });

    cbQuery = scopeQuery(cbQuery, result.scope, "assigned_to");

    const { data: callBooked, error: cbError } = await cbQuery;
    if (cbError) throw cbError;

    // Fetch sales_meetings for this rep
    const { data: meetData, error: meetError } = await supabaseAdmin
      .from("sales_meetings")
      .select("*")
      .eq("sales_rep_id", repId);

    if (meetError) throw meetError;

    // Build a map of meet data by opportunity_id
    const meetMap: Record<string, (typeof meetData)[0]> = {};
    (meetData || []).forEach((m) => {
      meetMap[m.opportunity_id] = m;
    });

    // Merge call_booked records with meeting tracking data
    const merged = (callBooked || []).map((cb) => ({
      ...cb,
      opportunity_id: cb.id, // alias for frontend compatibility
      meet_status: meetMap[cb.id]?.meet_status || "pending",
      meet_notes: meetMap[cb.id]?.meet_notes || null,
      meet_date: meetMap[cb.id]?.meet_date || null,
      follow_up_date: meetMap[cb.id]?.follow_up_date || null,
      outcome: meetMap[cb.id]?.outcome || null,
    }));

    return NextResponse.json({ records: merged, _permissions: result.permissions });
  } catch (error: unknown) {
    const e = error as { message?: string; details?: string; hint?: string; code?: string };
    console.error("REP-MEETINGS GET ERROR:", e.message, "| details:", e.details, "| hint:", e.hint);
    return NextResponse.json({ error: e.message || "Failed to fetch meet management data" }, { status: 500 });
  }
}

// POST: Upsert meeting tracking record for a rep
export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "sales", "rep-meet-management");
  if ("error" in result) return result.error;

  if (!result.permissions.canCreate) {
    return NextResponse.json({ error: "You do not have permission to create records" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const records = Array.isArray(body) ? body : [body];
    const repId = req.nextUrl.searchParams.get("repId");

    const { data, error } = await supabaseAdmin
      .from("sales_meetings")
      .upsert(
        records.map((r: Record<string, unknown>) => ({
          opportunity_id: r.opportunity_id,
          sales_rep_id: repId,
          meet_status: r.meet_status || "pending",
          meet_notes: r.meet_notes || "",
          meet_date: r.meet_date || null,
          follow_up_date: r.follow_up_date || null,
          outcome: r.outcome || "",
        })),
        { onConflict: "opportunity_id,sales_rep_id" }
      )
      .select();

    if (error) throw error;
    return NextResponse.json({ records: data });
  } catch (error: unknown) {
    const e = error as { message?: string; details?: string; hint?: string; code?: string };
    console.error("REP-MEETINGS POST ERROR:", e.message, "| details:", e.details, "| hint:", e.hint);
    return NextResponse.json({ error: e.message || "Failed to save meet tracking" }, { status: 500 });
  }
}

// PUT: Update a single meeting tracking record
export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "sales", "rep-meet-management");
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

    // Upsert so it creates the record if it doesn't exist yet
    const { data, error } = await supabaseAdmin
      .from("sales_meetings")
      .upsert(
        { opportunity_id, sales_rep_id: repId, ...updates, meet_notes: updates.meet_notes || "", outcome: updates.outcome || "" },
        { onConflict: "opportunity_id,sales_rep_id" }
      )
      .select()
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (error: unknown) {
    const e = error as { message?: string; details?: string; hint?: string; code?: string };
    console.error("REP-MEETINGS PUT ERROR:", e.message, "| details:", e.details, "| hint:", e.hint);
    return NextResponse.json({ error: e.message || "Failed to update meet tracking" }, { status: 500 });
  }
}
