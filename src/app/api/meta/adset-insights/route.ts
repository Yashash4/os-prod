import { NextRequest, NextResponse } from "next/server";
import { getAdSetInsights } from "@/lib/meta";

export async function GET(req: NextRequest) {
  try {
    const adSetId = req.nextUrl.searchParams.get("adSetId");
    if (!adSetId) {
      return NextResponse.json({ error: "adSetId is required" }, { status: 400 });
    }
    const datePreset = req.nextUrl.searchParams.get("date_preset") || "last_30d";
    const timeIncrement = req.nextUrl.searchParams.get("time_increment") || "1";
    const insights = await getAdSetInsights(adSetId, datePreset, timeIncrement);
    return NextResponse.json({ insights });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch ad set insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
