import { NextRequest, NextResponse } from "next/server";
import { searchOpportunities, updateOpportunity } from "@/lib/ghl";
import { requireSubModuleAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "ghl", "opportunities");
  if ("error" in result) return result.error;
  const { permissions } = result;
  try {
    const pipelineId = req.nextUrl.searchParams.get("pipeline_id") || req.nextUrl.searchParams.get("pipelineId");
    if (!pipelineId) {
      // Return empty if no pipeline specified (overview pages call without pipeline_id)
      return NextResponse.json({ opportunities: [], _permissions: permissions });
    }
    const opportunities = await searchOpportunities(pipelineId);
    return NextResponse.json({ opportunities, _permissions: permissions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch opportunities";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "ghl", "opportunities");
  if ("error" in result) return result.error;
  if (!result.permissions.canEdit) {
    return NextResponse.json({ error: "Permission denied: canEdit" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { opportunityId, pipelineId, ...updates } = body;

    if (!opportunityId || !pipelineId) {
      return NextResponse.json({ error: "opportunityId and pipelineId are required" }, { status: 400 });
    }

    const updated = await updateOpportunity(opportunityId, pipelineId, updates);
    return NextResponse.json({ opportunity: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update opportunity";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
