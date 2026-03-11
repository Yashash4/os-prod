import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { getSearchAnalytics } from "@/lib/gsc";

function getExpectedCtr(position: number): number {
  if (position <= 1) return 0.3;
  if (position <= 2) return 0.15;
  if (position <= 3) return 0.1;
  if (position <= 10) return 0.05;
  return 0.02;
}

export async function GET(req: NextRequest) {
  const auth = await requireSubModuleAccess(req, "seo", "seo-page-health");
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
      dimensions: ["page"],
      rowLimit: 100,
    });

    const pages = rows.map((row) => {
      let healthScore = 100;
      const issues: string[] = [];

      // CTR below expected for position
      const expectedCtr = getExpectedCtr(row.position);
      if (row.ctr < expectedCtr) {
        healthScore -= 20;
        issues.push(
          `CTR (${(row.ctr * 100).toFixed(1)}%) below expected (${(expectedCtr * 100).toFixed(0)}%) for position ${Math.round(row.position)}`
        );
      }

      // Position > 50
      if (row.position > 50) {
        healthScore -= 30;
        issues.push(`Low ranking position (${Math.round(row.position)})`);
      }

      // Impressions < 10
      if (row.impressions < 10) {
        healthScore -= 20;
        issues.push(`Very low impressions (${row.impressions})`);
      }

      // Clicks = 0 with impressions > 50
      if (row.clicks === 0 && row.impressions > 50) {
        healthScore -= 15;
        issues.push(
          `Zero clicks despite ${row.impressions} impressions`
        );
      }

      return {
        url: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: Math.round(row.ctr * 10000) / 100,
        position: Math.round(row.position * 10) / 10,
        health_score: Math.max(0, healthScore),
        issues,
      };
    });

    return NextResponse.json({ pages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch page health";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
