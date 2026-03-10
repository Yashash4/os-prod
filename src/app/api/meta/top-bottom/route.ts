import { NextRequest, NextResponse } from "next/server";
import {
  getCampaignInsightsBulk,
  getAdSetInsightsBulk,
  getAdInsightsBulk,
} from "@/lib/meta";
import { authenticateRequest } from "@/lib/api-auth";

type Level = "campaigns" | "adsets" | "ads";
type Metric = "spend" | "ctr" | "cpc" | "cpm" | "roas";

// For spend: top = highest spend (biggest spender).
// For ctr/roas: top = highest (best performance).
// For cpc/cpm: top = lowest (best cost efficiency).
const LOWER_IS_BETTER: Metric[] = ["cpc", "cpm"];

function extractMetric(row: Record<string, unknown>, metric: Metric): number {
  if (metric === "roas") {
    const roasArr = row.purchase_roas as
      | { action_type: string; value: string }[]
      | undefined;
    if (roasArr && roasArr.length > 0) return parseFloat(roasArr[0].value);
    return 0;
  }
  return parseFloat((row[metric] as string) || "0");
}

// In-memory cache + in-flight dedup
let cache: { data: unknown; ts: number; key: string } | null = null;
let inflight: { promise: Promise<unknown>; key: string } | null = null;
const CACHE_TTL = 120_000; // 2 minutes

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;

  try {
    const level = (req.nextUrl.searchParams.get("level") || "campaigns") as Level;
    const metric = (req.nextUrl.searchParams.get("metric") || "spend") as Metric;
    const datePreset = req.nextUrl.searchParams.get("date_preset") || "last_7d";
    const cacheKey = `${level}:${metric}:${datePreset}`;

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
      let insights: Record<string, unknown>[];
      switch (level) {
        case "adsets":
          insights = await getAdSetInsightsBulk(datePreset);
          break;
        case "ads":
          insights = await getAdInsightsBulk(datePreset);
          break;
        default:
          insights = await getCampaignInsightsBulk(datePreset);
      }

      // Attach numeric metric value for sorting
      const withValue = insights.map((row) => ({
        ...row,
        _metricValue: extractMetric(row, metric),
      }));

      // Sort: for lower-is-better metrics, ascending puts "best" first
      const lowerBetter = LOWER_IS_BETTER.includes(metric);
      withValue.sort((a, b) =>
        lowerBetter
          ? a._metricValue - b._metricValue
          : b._metricValue - a._metricValue
      );

      const top = withValue.slice(0, 5).map(({ _metricValue, ...rest }) => rest);
      const bottomSorted = [...withValue].reverse();
      const bottom = bottomSorted
        .slice(0, 5)
        .map(({ _metricValue, ...rest }) => rest);

      return { top, bottom, metric, level };
    })();

    inflight = { promise, key: cacheKey };
    const result = await promise;
    cache = { data: result, ts: Date.now(), key: cacheKey };
    inflight = null;
    return NextResponse.json(result);
  } catch (error) {
    inflight = null;
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch top/bottom insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
