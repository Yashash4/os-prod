import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { getSearchAnalytics, SearchAnalyticsRow } from "@/lib/gsc";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "seo", "seo-keywords");
  if ("error" in result) return result.error;

  try {
    const startDate = req.nextUrl.searchParams.get("startDate");
    const endDate = req.nextUrl.searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // Calculate period length in days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const periodMs = end.getTime() - start.getTime();
    const periodDays = Math.ceil(periodMs / (1000 * 60 * 60 * 24));

    // Calculate previous period
    const prevEnd = new Date(start.getTime() - 1000 * 60 * 60 * 24); // day before startDate
    const prevStart = new Date(prevEnd.getTime() - periodMs);
    const prevStartDate = prevStart.toISOString().split("T")[0];
    const prevEndDate = prevEnd.toISOString().split("T")[0];

    // Fetch current and previous period in parallel
    const [currentRows, previousRows] = await Promise.all([
      getSearchAnalytics({
        startDate,
        endDate,
        dimensions: ["query"],
        rowLimit: 500,
      }),
      getSearchAnalytics({
        startDate: prevStartDate,
        endDate: prevEndDate,
        dimensions: ["query"],
        rowLimit: 500,
      }),
    ]);

    // Build lookup map for previous period
    const prevMap = new Map<string, SearchAnalyticsRow>();
    for (const row of previousRows) {
      prevMap.set(row.keys[0], row);
    }

    // Also collect keywords only in previous period
    const currentKeywords = new Set(currentRows.map((r) => r.keys[0]));

    // Merge results
    const keywords = currentRows.map((row) => {
      const keyword = row.keys[0];
      const prev = prevMap.get(keyword);
      return {
        keyword,
        current_position: Math.round(row.position * 10) / 10,
        previous_position: prev ? Math.round(prev.position * 10) / 10 : null,
        position_change: prev
          ? Math.round((prev.position - row.position) * 10) / 10
          : null,
        current_clicks: row.clicks,
        previous_clicks: prev ? prev.clicks : null,
        click_change: prev ? row.clicks - prev.clicks : null,
        impressions: row.impressions,
        ctr: Math.round(row.ctr * 10000) / 100,
      };
    });

    // Add keywords that were in previous period but not current
    for (const row of previousRows) {
      if (!currentKeywords.has(row.keys[0])) {
        keywords.push({
          keyword: row.keys[0],
          current_position: null as unknown as number,
          previous_position: Math.round(row.position * 10) / 10,
          position_change: null,
          current_clicks: 0,
          previous_clicks: row.clicks,
          click_change: -row.clicks,
          impressions: 0,
          ctr: 0,
        });
      }
    }

    return NextResponse.json({ keywords, _permissions: result.permissions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch keyword comparison";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
