import { NextRequest, NextResponse } from "next/server";
import { getPaymentPages } from "@/lib/razorpay";
import { requireSubModuleAccess } from "@/lib/api-auth";

let cache: { data: unknown[]; ts: number } | null = null;
let inflight: Promise<unknown[]> | null = null;
const CACHE_TTL = 120_000;

export async function GET(req: NextRequest) {
  const auth = await requireSubModuleAccess(req, "payments", "payments-pages");
  if ("error" in auth) return auth.error;
  try {
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json({ pages: cache.data });
    }

    if (inflight) {
      const data = await inflight;
      return NextResponse.json({ pages: data });
    }

    const promise = getPaymentPages() as Promise<unknown[]>;
    inflight = promise;

    const data = await promise;
    cache = { data, ts: Date.now() };
    inflight = null;
    return NextResponse.json({ pages: data });
  } catch (error) {
    inflight = null;
    const message = error instanceof Error ? error.message : "Failed to fetch payment pages";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
