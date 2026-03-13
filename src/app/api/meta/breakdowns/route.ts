import { NextRequest, NextResponse } from "next/server";
import { getInsightsBreakdown } from "@/lib/meta";
import { requireSubModuleAccess } from "@/lib/api-auth";

// In-memory cache + in-flight dedup
let cache: { data: unknown; ts: number; key: string } | null = null;
let inflight: { promise: Promise<unknown>; key: string } | null = null;
const CACHE_TTL = 120_000; // 2 minutes

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "meta", "meta-analytics");
  if ("error" in result) return result.error;
  try {
    const breakdown = req.nextUrl.searchParams.get("breakdown") || "age";
    const datePreset = req.nextUrl.searchParams.get("date_preset") || "last_30d";
    const cacheKey = `${breakdown}:${datePreset}`;

    // Return cached data if fresh
    if (cache && cache.key === cacheKey && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json({ ...(cache.data as object), _permissions: result.permissions });
    }

    // Deduplicate concurrent requests
    if (inflight && inflight.key === cacheKey) {
      const r = await inflight.promise;
      return NextResponse.json({ ...(r as object), _permissions: result.permissions });
    }

    const promise = (async () => {
      const data = await getInsightsBreakdown(breakdown, datePreset);
      return { data };
    })();

    inflight = { promise, key: cacheKey };
    const r = await promise;
    cache = { data: r, ts: Date.now(), key: cacheKey };
    inflight = null;
    return NextResponse.json({ ...r, _permissions: result.permissions });
  } catch (error) {
    inflight = null;
    const message = error instanceof Error ? error.message : "Failed to fetch breakdown data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
