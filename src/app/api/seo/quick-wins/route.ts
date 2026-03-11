import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { getSearchAnalytics } from "@/lib/gsc";

function getExpectedCtrForPosition(position: number): number {
  if (position <= 1) return 0.3;
  if (position <= 2) return 0.15;
  if (position <= 3) return 0.1;
  if (position <= 10) return 0.05;
  return 0.02;
}

export async function GET(req: NextRequest) {
  const auth = await requireSubModuleAccess(req, "seo", "seo-keywords");
  if ("error" in auth) return auth.error;

  try {
    const startDate = req.nextUrl.searchParams.get("startDate");
    const endDate = req.nextUrl.searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const rows = await getSearchAnalytics({
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit: 500,
    });

    // Filter to positions 4-20 with impressions > 50
    const candidates = rows.filter(
      (row) => row.position >= 4 && row.position <= 20 && row.impressions > 50
    );

    // Calculate impact score for each
    const scored = candidates.map((row) => {
      const targetPosition = Math.max(1, Math.round(row.position) - 3);
      const expectedCtrAtTarget = getExpectedCtrForPosition(targetPosition);
      const currentCtr = row.ctr;
      const estimatedImpact = Math.round(
        row.impressions * (expectedCtrAtTarget - currentCtr)
      );

      return {
        keyword: row.keys[0],
        position: Math.round(row.position * 10) / 10,
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: Math.round(row.ctr * 10000) / 100,
        estimated_impact: Math.max(0, estimatedImpact),
        target_position: targetPosition,
      };
    });

    // Sort by impact desc, take top 30
    scored.sort((a, b) => b.estimated_impact - a.estimated_impact);
    const quickWins = scored.slice(0, 30);

    return NextResponse.json({ quickWins });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch quick wins";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
