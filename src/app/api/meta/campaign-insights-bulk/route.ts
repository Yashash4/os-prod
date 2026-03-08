import { NextRequest, NextResponse } from "next/server";
import { getCampaignInsightsBulk } from "@/lib/meta";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  try {
    const datePreset = req.nextUrl.searchParams.get("date_preset") || "last_30d";
    const insights = await getCampaignInsightsBulk(datePreset);
    return NextResponse.json({ insights });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch campaign insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
