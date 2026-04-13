import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { scopeQuery, verifyScopeAccess } from "@/lib/data-scope";

// GET: Fetch all maverick meet tracking records joined with call_booked_tracking
export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "sales", "maverick");
  if ("error" in result) return result.error;
  try {
    // Look up Maverick's employee ID for sales_rep_id filtering
    const { data: repRow } = await supabaseAdmin.from("hr_employees").select("id").ilike("full_name", "%maverick%").eq("is_sales_rep", true).single();
    const repId = repRow?.id;
    // Fetch call_booked_tracking records scoped by assigned_to
    let cbQuery = supabaseAdmin
      .from("sales_opportunities")
      .select("*")
      .order("created_at", { ascending: false });

    cbQuery = scopeQuery(cbQuery, result.scope, "assigned_to");

    const { data: callBooked, error: cbError } = await cbQuery;

    if (cbError) throw cbError;

    // Fetch maverick meet tracking records
    let meetQuery = supabaseAdmin.from("sales_meetings").select("*");
    if (repId) meetQuery = meetQuery.eq("sales_rep_id", repId);
    const { data: meetData, error: meetError } = await meetQuery;

    if (meetError) throw meetError;

    // Build a map of maverick data by opportunity_id
    const meetMap: Record<string, typeof meetData[0]> = {};
    (meetData || []).forEach((m) => {
      meetMap[m.opportunity_id] = m;
    });

    // Merge call_booked records with maverick tracking data
    const merged = (callBooked || []).map((cb) => ({
      opportunity_id: cb.id,
      ...cb,
      meet_status: meetMap[cb.id]?.meet_status || "pending",
      meet_notes: meetMap[cb.id]?.meet_notes || null,
      meet_date: meetMap[cb.id]?.meet_date || null,
      follow_up_date: meetMap[cb.id]?.follow_up_date || null,
      outcome: meetMap[cb.id]?.outcome || null,
    }));

    return NextResponse.json({ records: merged, _permissions: result.permissions });
  } catch (error: unknown) {
    const e = error as { message?: string; details?: string; hint?: string; code?: string };
    console.error("SALES ROUTE ERROR in maverick-meet-tracking:", e.message, "| details:", e.details, "| hint:", e.hint, "| code:", e.code);
    const message = e.message || "Failed to fetch meet management data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Upsert maverick meet tracking record
export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "sales", "maverick");
  if ("error" in result) return result.error;

  if (!result.permissions.canCreate) {
    return NextResponse.json({ error: "You do not have permission to create records" }, { status: 403 });
  }

  try {
    const { data: repRow } = await supabaseAdmin.from("hr_employees").select("id").ilike("full_name", "%maverick%").eq("is_sales_rep", true).single();
    const repId = repRow?.id;
    const body = await req.json();
    const records = Array.isArray(body) ? body : [body];

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
        { onConflict: "opportunity_id" }
      )
      .select();

    if (error) throw error;
    return NextResponse.json({ records: data });
  } catch (error: unknown) {
    const e = error as { message?: string; details?: string; hint?: string; code?: string };
    console.error("SALES ROUTE ERROR in maverick-meet-tracking:", e.message, "| details:", e.details, "| hint:", e.hint, "| code:", e.code);
    const message = e.message || "Failed to save meet tracking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT: Update a single maverick meet tracking record
export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "sales", "maverick");
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

    // Upsert so it creates the record if it doesn't exist yet
    const { data: repRow2 } = await supabaseAdmin.from("hr_employees").select("id").ilike("full_name", "%maverick%").eq("is_sales_rep", true).single();
    // Sanitize TEXT NOT NULL fields — null violates NOT NULL constraint
    if (updates.meet_notes === null || updates.meet_notes === undefined) updates.meet_notes = "";
    if (updates.outcome === null || updates.outcome === undefined) updates.outcome = "";
    const { data, error } = await supabaseAdmin
      .from("sales_meetings")
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
    console.error("SALES ROUTE ERROR in maverick-meet-tracking:", e.message, "| details:", e.details, "| hint:", e.hint, "| code:", e.code);
    const message = e.message || "Failed to update meet tracking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
