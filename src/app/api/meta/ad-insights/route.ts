import { NextRequest, NextResponse } from "next/server";
import { getAdInsights } from "@/lib/meta";

export async function GET(req: NextRequest) {
  try {
    const adId = req.nextUrl.searchParams.get("adId");
    if (!adId) {
      return NextResponse.json({ error: "adId is required" }, { status: 400 });
    }
    const datePreset = req.nextUrl.searchParams.get("date_preset") || "last_30d";
    const timeIncrement = req.nextUrl.searchParams.get("time_increment") || "1";
    const insights = await getAdInsights(adId, datePreset, timeIncrement);
    return NextResponse.json({ insights });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch ad insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
