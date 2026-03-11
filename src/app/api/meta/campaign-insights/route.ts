import { NextRequest, NextResponse } from "next/server";
import { getCampaignInsights } from "@/lib/meta";
import { requireSubModuleAccess } from "@/lib/api-auth";

// In-memory cache + in-flight dedup
let cache: { data: unknown; ts: number; key: string } | null = null;
let inflight: { promise: Promise<unknown>; key: string } | null = null;
const CACHE_TTL = 120_000; // 2 minutes

export async function GET(req: NextRequest) {
  const auth = await requireSubModuleAccess(req, "meta", "meta-campaigns");
  if ("error" in auth) return auth.error;
  try {
    const campaignId = req.nextUrl.searchParams.get("campaignId");
    if (!campaignId) {
      return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
    }
    const datePreset = req.nextUrl.searchParams.get("date_preset") || "last_30d";
    const timeIncrement = req.nextUrl.searchParams.get("time_increment") || "1";
    const cacheKey = `${campaignId}:${datePreset}:${timeIncrement}`;

    // Return cached data if fresh
    if (cache && cache.key === cacheKey && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json({ insights: cache.data });
    }

    // Deduplicate concurrent requests
    if (inflight && inflight.key === cacheKey) {
      const insights = await inflight.promise;
      return NextResponse.json({ insights });
    }

    const promise = getCampaignInsights(campaignId, datePreset, timeIncrement);
    inflight = { promise, key: cacheKey };

    const insights = await promise;
    cache = { data: insights, ts: Date.now(), key: cacheKey };
    inflight = null;
    return NextResponse.json({ insights });
  } catch (error) {
    inflight = null;
    const message = error instanceof Error ? error.message : "Failed to fetch campaign insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
