import { NextRequest, NextResponse } from "next/server";
import { getAccountInsights } from "@/lib/meta";
import { requireSubModuleAccess } from "@/lib/api-auth";

// In-memory cache + in-flight dedup
let cache: { data: unknown; ts: number; key: string } | null = null;
let inflight: { promise: Promise<unknown>; key: string } | null = null;
const CACHE_TTL = 120_000; // 2 minutes

export async function GET(req: NextRequest) {
  const auth = await requireSubModuleAccess(req, "meta", "meta-analytics");
  if ("error" in auth) return auth.error;

  try {
    const datePreset =
      req.nextUrl.searchParams.get("date_preset") || "today";
    const comparePreset =
      req.nextUrl.searchParams.get("compare_preset") || "yesterday";
    const cacheKey = `${datePreset}:${comparePreset}`;

    // Return cached data if fresh
    if (cache && cache.key === cacheKey && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    // Deduplicate concurrent requests
    if (inflight && inflight.key === cacheKey) {
      const data = await inflight.promise;
      return NextResponse.json(data);
    }

    const promise = Promise.all([
      getAccountInsights(datePreset),
      getAccountInsights(comparePreset),
    ]).then(([current, previous]) => ({ current, previous }));
    inflight = { promise, key: cacheKey };

    const data = await promise;
    cache = { data, ts: Date.now(), key: cacheKey };
    inflight = null;
    return NextResponse.json(data);
  } catch (error) {
    inflight = null;
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch comparison insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
