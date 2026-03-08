import { NextRequest, NextResponse } from "next/server";
import { getAds } from "@/lib/meta";
import { authenticateRequest } from "@/lib/api-auth";

// In-memory cache + in-flight dedup to avoid concurrent Meta API calls
let adsCache: { data: unknown[]; ts: number; key: string } | null = null;
let inflight: { promise: Promise<unknown[]>; key: string } | null = null;
const CACHE_TTL = 120_000; // 2 minutes

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  try {
    const adSetId = req.nextUrl.searchParams.get("adSetId") || undefined;
    const cacheKey = adSetId || "__all__";

    // Return cached data if fresh
    if (adsCache && adsCache.key === cacheKey && Date.now() - adsCache.ts < CACHE_TTL) {
      return NextResponse.json({ ads: adsCache.data });
    }

    // Deduplicate concurrent requests
    if (inflight && inflight.key === cacheKey) {
      const ads = await inflight.promise;
      return NextResponse.json({ ads });
    }

    const promise = getAds(adSetId);
    inflight = { promise, key: cacheKey };

    const ads = await promise;
    adsCache = { data: ads, ts: Date.now(), key: cacheKey };
    inflight = null;
    return NextResponse.json({ ads });
  } catch (error) {
    inflight = null;
    const message = error instanceof Error ? error.message : "Failed to fetch ads";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
