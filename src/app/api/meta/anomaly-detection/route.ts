import { NextRequest, NextResponse } from "next/server";
import { metaFetch } from "@/lib/meta";
import { requireModuleAccess } from "@/lib/api-auth";

interface DayRow {
  campaign_id: string;
  campaign_name: string;
  date_start: string;
  spend: string;
  ctr: string;
  cpc: string;
  cpm: string;
}

interface Anomaly {
  campaign_id: string;
  campaign_name: string;
  date: string;
  metric: string;
  value: number;
  mean: number;
  stddev: number;
  direction: "above" | "below";
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || "";

// In-memory cache + in-flight dedup
let cache: { data: unknown; ts: number; key: string } | null = null;
let inflight: { promise: Promise<unknown>; key: string } | null = null;
const CACHE_TTL = 120_000; // 2 minutes

export async function GET(req: NextRequest) {
  const auth = await requireModuleAccess(req, "meta");
  if ("error" in auth) return auth.error;

  try {
    const cacheKey = "__anomaly__";

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
      // Fetch campaign-level daily insights for the last 14 days
      const data = await metaFetch(`/${AD_ACCOUNT_ID}/insights`, {
        fields:
          "campaign_id,campaign_name,spend,impressions,clicks,reach,cpm,ctr,cpc",
        date_preset: "last_14d",
        time_increment: "1",
        level: "campaign",
        limit: "5000",
      });

      const rows: DayRow[] = data.data || [];

      // Group rows by campaign_id
      const byCampaign = new Map<string, DayRow[]>();
      for (const row of rows) {
        const key = row.campaign_id;
        if (!byCampaign.has(key)) byCampaign.set(key, []);
        byCampaign.get(key)!.push(row);
      }

      const METRICS = ["spend", "ctr", "cpc", "cpm"] as const;
      const anomalies: (Anomaly & { deviation: number })[] = [];

      for (const [, days] of byCampaign) {
        if (days.length < 3) continue; // need enough data points

        for (const metric of METRICS) {
          const values = days.map((d) => parseFloat(d[metric] || "0"));
          const avg = mean(values);
          const sd = stddev(values, avg);
          if (sd === 0) continue;

          for (let i = 0; i < days.length; i++) {
            const val = values[i];
            const deviation = Math.abs(val - avg) / sd;
            if (deviation > 2) {
              anomalies.push({
                campaign_id: days[i].campaign_id,
                campaign_name: days[i].campaign_name,
                date: days[i].date_start,
                metric,
                value: val,
                mean: Math.round(avg * 100) / 100,
                stddev: Math.round(sd * 100) / 100,
                direction: val > avg ? "above" : "below",
                deviation,
              });
            }
          }
        }
      }

      // Sort by deviation magnitude descending, take top 20
      anomalies.sort((a, b) => b.deviation - a.deviation);
      const top20 = anomalies.slice(0, 20).map(({ deviation, ...rest }) => rest);

      return { anomalies: top20 };
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
        : "Failed to detect anomalies";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
