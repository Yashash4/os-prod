import { NextRequest, NextResponse } from "next/server";
import { getCampaigns } from "@/lib/meta";
import { requireSubModuleAccess } from "@/lib/api-auth";

// In-memory cache + in-flight dedup
let cache: { data: unknown; ts: number; key: string } | null = null;
let inflight: { promise: Promise<unknown>; key: string } | null = null;
const CACHE_TTL = 120_000; // 2 minutes

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "meta", "meta-campaigns");
  if ("error" in result) return result.error;
  try {
    const cacheKey = "__all__";

    // Return cached data if fresh
    if (cache && cache.key === cacheKey && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json({ campaigns: cache.data, _permissions: result.permissions });
    }

    // Deduplicate concurrent requests
    if (inflight && inflight.key === cacheKey) {
      const campaigns = await inflight.promise;
      return NextResponse.json({ campaigns, _permissions: result.permissions });
    }

    const promise = getCampaigns();
    inflight = { promise, key: cacheKey };

    const campaigns = await promise;
    cache = { data: campaigns, ts: Date.now(), key: cacheKey };
    inflight = null;
    return NextResponse.json({ campaigns, _permissions: result.permissions });
  } catch (error) {
    inflight = null;
    const message = error instanceof Error ? error.message : "Failed to fetch campaigns";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
