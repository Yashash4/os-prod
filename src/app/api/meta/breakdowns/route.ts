import { NextRequest, NextResponse } from "next/server";
import { getInsightsBreakdown } from "@/lib/meta";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  try {
    const breakdown = req.nextUrl.searchParams.get("breakdown") || "age";
    const datePreset = req.nextUrl.searchParams.get("date_preset") || "last_30d";
    const data = await getInsightsBreakdown(breakdown, datePreset);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch breakdown data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
