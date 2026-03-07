import { NextRequest, NextResponse } from "next/server";
import { getAccountInsights } from "@/lib/meta";

export async function GET(req: NextRequest) {
  try {
    const datePreset = req.nextUrl.searchParams.get("date_preset") || "last_30d";
    const timeIncrement = req.nextUrl.searchParams.get("time_increment") || "1";
    const insights = await getAccountInsights(datePreset, timeIncrement);
    return NextResponse.json({ insights });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch account insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
