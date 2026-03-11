import { NextRequest, NextResponse } from "next/server";
import { getAccountInsights } from "@/lib/meta";
import { requireModuleAccess } from "@/lib/api-auth";

// In-memory cache + in-flight dedup
let cache: { data: unknown; ts: number; key: string } | null = null;
let inflight: { promise: Promise<unknown>; key: string } | null = null;
const CACHE_TTL = 120_000; // 2 minutes

export async function GET(req: NextRequest) {
  const auth = await requireModuleAccess(req, "meta");
  if ("error" in auth) return auth.error;

  try {
    const datePreset =
      req.nextUrl.searchParams.get("date_preset") || "last_7d";
    const cacheKey = `${datePreset}`;

    // Return cached data if fresh
    if (cache && cache.key === cacheKey && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    // Deduplicate concurrent requests
    if (inflight && inflight.key === cacheKey) {
      const result = await inflight.promise;
      return NextResponse.json(result);
    }

    const promise = (async () => {
      // Fetch daily account insights (time_increment=1 is the default)
      const dataPoints = await getAccountInsights(datePreset, "1");

      if (!dataPoints || dataPoints.length === 0) {
        return null; // signal no data
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

      return {
        avg_daily_spend: Math.round(avgDailySpend * 100) / 100,
        days_elapsed: daysElapsed,
        days_remaining: daysRemaining,
        projected_monthly_spend: projectedMonthlySpend,
        data_points: dataPoints,
      };
    })();

    inflight = { promise, key: cacheKey };
    const result = await promise;
    inflight = null;

    if (result === null) {
      return NextResponse.json(
        { error: "No spend data available for the selected period" },
        { status: 404 }
      );
    }

    cache = { data: result, ts: Date.now(), key: cacheKey };
    return NextResponse.json(result);
  } catch (error) {
    inflight = null;
    const message =
      error instanceof Error
        ? error.message
        : "Failed to forecast spend";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
