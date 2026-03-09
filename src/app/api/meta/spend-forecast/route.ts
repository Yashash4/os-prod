import { NextRequest, NextResponse } from "next/server";
import { getAccountInsights } from "@/lib/meta";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;

  try {
    const datePreset =
      req.nextUrl.searchParams.get("date_preset") || "last_7d";

    // Fetch daily account insights (time_increment=1 is the default)
    const dataPoints = await getAccountInsights(datePreset, "1");

    if (!dataPoints || dataPoints.length === 0) {
      return NextResponse.json(
        { error: "No spend data available for the selected period" },
        { status: 404 }
      );
    }

    // Calculate average daily spend
    const dailySpends = dataPoints.map((d: Record<string, string>) =>
      parseFloat(d.spend || "0")
    );
    const totalSpend = dailySpends.reduce((a: number, b: number) => a + b, 0);
    const avgDailySpend = totalSpend / dailySpends.length;

    // Determine days elapsed and remaining in current month
    const now = new Date();
    const daysElapsed = now.getDate();
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).getDate();
    const daysRemaining = daysInMonth - daysElapsed;

    // Project: actual spend so far this month + remaining days * avg
    const projectedMonthlySpend =
      Math.round((daysElapsed * avgDailySpend + daysRemaining * avgDailySpend) * 100) / 100;

    return NextResponse.json({
      avg_daily_spend: Math.round(avgDailySpend * 100) / 100,
      days_elapsed: daysElapsed,
      days_remaining: daysRemaining,
      projected_monthly_spend: projectedMonthlySpend,
      data_points: dataPoints,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to forecast spend";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
