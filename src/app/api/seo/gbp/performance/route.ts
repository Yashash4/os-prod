import { NextRequest, NextResponse } from "next/server";
import { getPerformanceMetrics } from "@/lib/gmb";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const startDate = sp.get("startDate") || "";
    const endDate = sp.get("endDate") || "";

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    const metrics = await getPerformanceMetrics(startDate, endDate);
    return NextResponse.json({ metrics });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch GBP performance";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
