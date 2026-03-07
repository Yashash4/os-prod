import { NextRequest, NextResponse } from "next/server";
import { searchOpportunities, updateOpportunity } from "@/lib/ghl";

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

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { opportunityId, pipelineId, ...updates } = body;

    if (!opportunityId || !pipelineId) {
      return NextResponse.json({ error: "opportunityId and pipelineId are required" }, { status: 400 });
    }

    const result = await updateOpportunity(opportunityId, pipelineId, updates);
    return NextResponse.json({ opportunity: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update opportunity";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
