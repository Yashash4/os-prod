import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { scopeQuery } from "@/lib/data-scope";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "sales", "rep-calendar");
  if ("error" in result) return result.error;

  const { searchParams } = new URL(req.url);
  const repId = searchParams.get("repId");

  const today = new Date().toISOString().split("T")[0];

  let query = supabaseAdmin
    .from("sales_meeting_analysis")
    .select(
      "*, sales_opportunities!opportunity_id(id, contact_name, contact_email, pipeline_name, stage_name)"
    )
    .gte("meet_date", today)
    .order("meet_date", { ascending: true });

  if (repId) {
    query = query.eq("sales_rep_id", repId);
  }

  // Scope by sales_rep_id using employee IDs
  query = scopeQuery(query, result.scope, "sales_rep_id", true);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch booked calls" }, { status: 500 });
  }

  return NextResponse.json({ records: data, _permissions: result.permissions });
}
