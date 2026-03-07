import { NextRequest, NextResponse } from "next/server";
import { searchOpportunities } from "@/lib/ghl";

export async function GET(req: NextRequest) {
  try {
    const pipelineId = req.nextUrl.searchParams.get("pipeline_id");
    if (!pipelineId) {
      return NextResponse.json({ error: "pipeline_id is required" }, { status: 400 });
    }
    const opportunities = await searchOpportunities(pipelineId);
    return NextResponse.json({ opportunities });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch opportunities";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
