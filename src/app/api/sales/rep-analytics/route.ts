import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "sales", "rep-analytics");
  if ("error" in result) return result.error;

  const { searchParams } = new URL(req.url);
  const repId = searchParams.get("repId");

  if (!repId) {
    return NextResponse.json({ error: "repId query parameter is required" }, { status: 400 });
  }

  // Scope check: non-admin users must have access to this rep's data
  if (result.scope.scopeLevel.dataVisibility !== "all") {
    const allowedIds =
      result.scope.scopeLevel.dataVisibility === "team"
        ? result.scope.teamEmployeeIds
        : [result.scope.employeeId ?? ""];
    if (!allowedIds.includes(repId)) {
      return NextResponse.json({ error: "Not authorized to view this rep's analytics" }, { status: 403 });
    }
  }

  // Fetch all meetings for this rep
  const { data: meetings, error: meetError } = await supabaseAdmin
    .from("sales_meetings")
    .select("id, meet_status")
    .eq("sales_rep_id", repId);

  if (meetError) {
    return NextResponse.json({ error: "Failed to fetch meeting data" }, { status: 500 });
  }

  // Fetch all deals for this rep
  const { data: deals, error: dealError } = await supabaseAdmin
    .from("sales_deals")
    .select("id, fees_collected, pending_amount, collection_status")
    .eq("sales_rep_id", repId);

  if (dealError) {
    return NextResponse.json({ error: "Failed to fetch deal data" }, { status: 500 });
  }

  // Aggregate meeting stats
  const totalMeetings = meetings?.length ?? 0;
  const meetingsByStatus: Record<string, number> = {};
  for (const m of meetings ?? []) {
    meetingsByStatus[m.meet_status] = (meetingsByStatus[m.meet_status] ?? 0) + 1;
  }

  // Aggregate deal stats
  const totalDeals = deals?.length ?? 0;
  let totalCollected = 0;
  let totalPending = 0;
  let wonDeals = 0;

  for (const d of deals ?? []) {
    totalCollected += Number(d.fees_collected ?? 0);
    totalPending += Number(d.pending_amount ?? 0);
    if (d.collection_status === "full") {
      wonDeals++;
    }
  }

  const conversionRate = totalDeals > 0 ? wonDeals / totalDeals : 0;

  return NextResponse.json({
    analytics: {
      total_meetings: totalMeetings,
      meetings_by_status: meetingsByStatus,
      total_deals: totalDeals,
      total_collected: totalCollected,
      total_pending: totalPending,
      conversion_rate: Math.round(conversionRate * 10000) / 10000, // 4 decimal places
    },
    _permissions: result.permissions,
  });
}
