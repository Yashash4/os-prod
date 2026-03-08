import { NextRequest, NextResponse } from "next/server";
import { getPipelines } from "@/lib/ghl";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  try {
    const pipelines = await getPipelines();
    return NextResponse.json({ pipelines });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch pipelines";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
