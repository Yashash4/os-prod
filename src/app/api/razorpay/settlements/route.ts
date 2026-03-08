import { NextRequest, NextResponse } from "next/server";
import { getSettlements } from "@/lib/razorpay";

let cache: { data: unknown[]; ts: number; key: string } | null = null;
let inflight: { promise: Promise<unknown[]>; key: string } | null = null;
const CACHE_TTL = 120_000;

export async function GET(req: NextRequest) {
  try {
    const from = req.nextUrl.searchParams.get("from") || undefined;
    const to = req.nextUrl.searchParams.get("to") || undefined;
    const cacheKey = `${from || "all"}_${to || "all"}`;

    if (cache && cache.key === cacheKey && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json({ settlements: cache.data });
    }

    if (inflight && inflight.key === cacheKey) {
      const data = await inflight.promise;
      return NextResponse.json({ settlements: data });
    }

    const fromTs = from ? parseInt(from) : undefined;
    const toTs = to ? parseInt(to) : undefined;
    const promise = getSettlements(fromTs, toTs) as Promise<unknown[]>;
    inflight = { promise, key: cacheKey };

    const data = await promise;
    const normalized = (data as Record<string, unknown>[]).map((item) => ({
      ...item,
      razorpay_created_at: item.created_at,
    }));
    cache = { data: normalized, ts: Date.now(), key: cacheKey };
    inflight = null;
    return NextResponse.json({ settlements: normalized });
  } catch (error) {
    inflight = null;
    const message = error instanceof Error ? error.message : "Failed to fetch settlements";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
