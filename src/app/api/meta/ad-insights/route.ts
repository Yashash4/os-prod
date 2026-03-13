import { NextRequest, NextResponse } from "next/server";
import { getAdInsights } from "@/lib/meta";
import { requireSubModuleAccess } from "@/lib/api-auth";

// In-memory cache + in-flight dedup
let cache: { data: unknown; ts: number; key: string } | null = null;
let inflight: { promise: Promise<unknown>; key: string } | null = null;
const CACHE_TTL = 120_000; // 2 minutes

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "meta", "meta-ads");
  if ("error" in result) return result.error;
  try {
    const adId = req.nextUrl.searchParams.get("adId");
    if (!adId) {
      return NextResponse.json({ error: "adId is required" }, { status: 400 });
    }
    const datePreset = req.nextUrl.searchParams.get("date_preset") || "last_30d";
    const timeIncrement = req.nextUrl.searchParams.get("time_increment") || "1";
    const cacheKey = `${adId}:${datePreset}:${timeIncrement}`;

    // Return cached data if fresh
    if (cache && cache.key === cacheKey && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json({ insights: cache.data, _permissions: result.permissions });
    }

    // Deduplicate concurrent requests
    if (inflight && inflight.key === cacheKey) {
      const insights = await inflight.promise;
      return NextResponse.json({ insights, _permissions: result.permissions });
    }

    const promise = getAdInsights(adId, datePreset, timeIncrement);
    inflight = { promise, key: cacheKey };

    const insights = await promise;
    cache = { data: insights, ts: Date.now(), key: cacheKey };
    inflight = null;
    return NextResponse.json({ insights, _permissions: result.permissions });
  } catch (error) {
    inflight = null;
    const message = error instanceof Error ? error.message : "Failed to fetch ad insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
