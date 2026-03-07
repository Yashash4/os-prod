import { NextRequest, NextResponse } from "next/server";
import { getAdSetInsightsBulk } from "@/lib/meta";

export async function GET(req: NextRequest) {
  try {
    const datePreset = req.nextUrl.searchParams.get("date_preset") || "last_30d";
    const insights = await getAdSetInsightsBulk(datePreset);
    return NextResponse.json({ insights });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch ad set insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
