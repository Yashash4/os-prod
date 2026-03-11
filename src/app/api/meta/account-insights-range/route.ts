import { NextRequest, NextResponse } from "next/server";
import { getAccountInsightsByRange } from "@/lib/meta";
import { requireModuleAccess } from "@/lib/api-auth";

// In-memory cache + in-flight dedup
let cache: { data: unknown; ts: number; key: string } | null = null;
let inflight: { promise: Promise<unknown>; key: string } | null = null;
const CACHE_TTL = 120_000; // 2 minutes

export async function GET(req: NextRequest) {
  const auth = await requireModuleAccess(req, "meta");
  if ("error" in auth) return auth.error;
  try {
    const since = req.nextUrl.searchParams.get("since") || "";
    const until = req.nextUrl.searchParams.get("until") || "";
    const timeIncrement = req.nextUrl.searchParams.get("time_increment") || "1";

    if (!since || !until) {
      return NextResponse.json(
        { error: "since and until are required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const cacheKey = `${since}:${until}:${timeIncrement}`;

    // Return cached data if fresh
    if (cache && cache.key === cacheKey && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json({ insights: cache.data });
    }

    // Deduplicate concurrent requests
    if (inflight && inflight.key === cacheKey) {
      const insights = await inflight.promise;
      return NextResponse.json({ insights });
    }

    const promise = getAccountInsightsByRange(since, until, timeIncrement);
    inflight = { promise, key: cacheKey };

    const insights = await promise;
    cache = { data: insights, ts: Date.now(), key: cacheKey };
    inflight = null;
    return NextResponse.json({ insights });
  } catch (error) {
    inflight = null;
    const message =
      error instanceof Error ? error.message : "Failed to fetch account insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
