import { NextRequest, NextResponse } from "next/server";
import { getAccountInsightsByRange } from "@/lib/meta";

export async function GET(req: NextRequest) {
  try {
    const since = req.nextUrl.searchParams.get("since") || "";
    const until = req.nextUrl.searchParams.get("until") || "";
    const timeIncrement = req.nextUrl.searchParams.get("time_increment") || "1";

    if (!since || !until) {
      return NextResponse.json(
        { error: "since and until are required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const insights = await getAccountInsightsByRange(since, until, timeIncrement);
    return NextResponse.json({ insights });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch account insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
