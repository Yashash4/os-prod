import { NextRequest, NextResponse } from "next/server";
import { getAdSets } from "@/lib/meta";

let adsetsCache: { data: unknown[]; ts: number; key: string } | null = null;
let inflight: { promise: Promise<unknown[]>; key: string } | null = null;
const CACHE_TTL = 120_000;

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get("campaignId") || undefined;
    const cacheKey = campaignId || "__all__";

    if (adsetsCache && adsetsCache.key === cacheKey && Date.now() - adsetsCache.ts < CACHE_TTL) {
      return NextResponse.json({ adsets: adsetsCache.data });
    }

    if (inflight && inflight.key === cacheKey) {
      const adsets = await inflight.promise;
      return NextResponse.json({ adsets });
    }

    const promise = getAdSets(campaignId);
    inflight = { promise, key: cacheKey };

    const adsets = await promise;
    adsetsCache = { data: adsets, ts: Date.now(), key: cacheKey };
    inflight = null;
    return NextResponse.json({ adsets });
  } catch (error) {
    inflight = null;
    const message = error instanceof Error ? error.message : "Failed to fetch ad sets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
