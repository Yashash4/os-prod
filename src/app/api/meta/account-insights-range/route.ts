import { NextRequest, NextResponse } from "next/server";
import { getAccountInsightsByRange } from "@/lib/meta";
import { requireSubModuleAccess } from "@/lib/api-auth";

// In-memory cache + in-flight dedup
let cache: { data: unknown; ts: number; key: string } | null = null;
let inflight: { promise: Promise<unknown>; key: string } | null = null;
const CACHE_TTL = 120_000; // 2 minutes

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "meta", "meta-analytics");
  if ("error" in result) return result.error;
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
      return NextResponse.json({ insights: cache.data, _permissions: result.permissions });
    }

    // Deduplicate concurrent requests
    if (inflight && inflight.key === cacheKey) {
      const insights = await inflight.promise;
      return NextResponse.json({ insights, _permissions: result.permissions });
    }

    const promise = getAccountInsightsByRange(since, until, timeIncrement);
    inflight = { promise, key: cacheKey };

    const insights = await promise;
    cache = { data: insights, ts: Date.now(), key: cacheKey };
    inflight = null;
    return NextResponse.json({ insights, _permissions: result.permissions });
  } catch (error) {
    inflight = null;
    const message =
      error instanceof Error ? error.message : "Failed to fetch account insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
