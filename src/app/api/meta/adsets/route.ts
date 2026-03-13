import { NextRequest, NextResponse } from "next/server";
import { getAdSets } from "@/lib/meta";
import { requireSubModuleAccess } from "@/lib/api-auth";

let adsetsCache: { data: unknown[]; ts: number; key: string } | null = null;
let inflight: { promise: Promise<unknown[]>; key: string } | null = null;
const CACHE_TTL = 120_000;

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "meta", "meta-adsets");
  if ("error" in result) return result.error;
  try {
    const campaignId = req.nextUrl.searchParams.get("campaignId") || undefined;
    const cacheKey = campaignId || "__all__";

    if (adsetsCache && adsetsCache.key === cacheKey && Date.now() - adsetsCache.ts < CACHE_TTL) {
      return NextResponse.json({ adsets: adsetsCache.data, _permissions: result.permissions });
    }

    if (inflight && inflight.key === cacheKey) {
      const adsets = await inflight.promise;
      return NextResponse.json({ adsets, _permissions: result.permissions });
    }

    const promise = getAdSets(campaignId);
    inflight = { promise, key: cacheKey };

    const adsets = await promise;
    adsetsCache = { data: adsets, ts: Date.now(), key: cacheKey };
    inflight = null;
    return NextResponse.json({ adsets, _permissions: result.permissions });
  } catch (error) {
    inflight = null;
    const message = error instanceof Error ? error.message : "Failed to fetch ad sets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
