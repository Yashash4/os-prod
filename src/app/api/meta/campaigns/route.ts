import { NextRequest, NextResponse } from "next/server";
import { getCampaigns } from "@/lib/meta";
import { requireModuleAccess } from "@/lib/api-auth";

// In-memory cache + in-flight dedup
let cache: { data: unknown; ts: number; key: string } | null = null;
let inflight: { promise: Promise<unknown>; key: string } | null = null;
const CACHE_TTL = 120_000; // 2 minutes

export async function GET(req: NextRequest) {
  const auth = await requireModuleAccess(req, "meta");
  if ("error" in auth) return auth.error;
  try {
    const cacheKey = "__all__";

    // Return cached data if fresh
    if (cache && cache.key === cacheKey && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json({ campaigns: cache.data });
    }

    // Deduplicate concurrent requests
    if (inflight && inflight.key === cacheKey) {
      const campaigns = await inflight.promise;
      return NextResponse.json({ campaigns });
    }

    const promise = getCampaigns();
    inflight = { promise, key: cacheKey };

    const campaigns = await promise;
    cache = { data: campaigns, ts: Date.now(), key: cacheKey };
    inflight = null;
    return NextResponse.json({ campaigns });
  } catch (error) {
    inflight = null;
    const message = error instanceof Error ? error.message : "Failed to fetch campaigns";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
