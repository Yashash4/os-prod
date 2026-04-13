import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { scopeQuery, verifyScopeAccess } from "@/lib/data-scope";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logImportant } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "sales", "rep-meeting-sheet");
  if ("error" in result) return result.error;

  const { searchParams } = new URL(req.url);
  const repId = searchParams.get("repId");

  let query = supabaseAdmin
    .from("sales_meeting_analysis")
    .select(
      "*, sales_opportunities!opportunity_id(id, contact_name, contact_email, pipeline_name, stage_name)"
    )
    .order("meet_date", { ascending: false });

  if (repId) {
    query = query.eq("sales_rep_id", repId);
  }

  // Apply scope filtering by sales_rep_id using employee IDs
  query = scopeQuery(query, result.scope, "sales_rep_id", true);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch meeting analysis records" }, { status: 500 });
  }

  return NextResponse.json({ records: data, _permissions: result.permissions });
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "sales", "rep-meeting-sheet");
  if ("error" in result) return result.error;

  if (!result.permissions.canCreate) {
    return NextResponse.json({ error: "Not authorized to create meeting analysis records" }, { status: 403 });
  }

  const body = await req.json();
  const {
    sales_rep_id,
    opportunity_id,
    contact_id,
    calendar_event_id,
    meet_date,
    contact_name,
    contact_email,
    contact_phone,
    meeting_link,
    outcome,
  } = body;

  if (!contact_id || !contact_name) {
    return NextResponse.json(
      { error: "contact_id and contact_name are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("sales_meeting_analysis")
    .insert({
      sales_rep_id,
      opportunity_id,
      contact_id,
      calendar_event_id,
      meet_date,
      contact_name,
      contact_email,
      contact_phone,
      meeting_link,
      outcome,
      created_by: result.auth.userId,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create meeting analysis record" }, { status: 500 });
  }

  await logImportant(result.auth.userId, {
    action: "create",
    module: "rep-meeting-sheet",
    breadcrumb_path: "APEX OS > Sales > Pipeline > Meetings",
    details: { contact_name, sales_rep_id },
  });

  return NextResponse.json({ record: data }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "sales", "rep-meeting-sheet");
  if ("error" in result) return result.error;

  if (!result.permissions.canEdit) {
    return NextResponse.json({ error: "Not authorized to edit meeting analysis records" }, { status: 403 });
  }

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Record ID is required" }, { status: 400 });
  }

  const hasAccess = await verifyScopeAccess(
    result.scope,
    "sales_meeting_analysis",
    id,
    "sales_rep_id",
    true
  );
  if (!hasAccess) {
    return NextResponse.json({ error: "Not authorized to edit this record" }, { status: 403 });
  }

  // D006: Never set updated_at manually
  delete updates.updated_at;

  const { data, error } = await supabaseAdmin
    .from("sales_meeting_analysis")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to update meeting analysis record" }, { status: 500 });
  }

  await logImportant(result.auth.userId, {
    action: "update",
    module: "rep-meeting-sheet",
    breadcrumb_path: "APEX OS > Sales > Pipeline > Meetings",
    details: { updated_fields: Object.keys(updates) },
  });

  return NextResponse.json({ record: data });
}
