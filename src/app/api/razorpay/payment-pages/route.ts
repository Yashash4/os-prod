import { NextRequest, NextResponse } from "next/server";
import { getPaymentPages } from "@/lib/razorpay";
import { requireSubModuleAccess } from "@/lib/api-auth";

let cache: { data: unknown[]; ts: number } | null = null;
let inflight: Promise<unknown[]> | null = null;
const CACHE_TTL = 120_000;

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "payments", "payments-pages");
  if ("error" in result) return result.error;
  try {
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json({ pages: cache.data, _permissions: result.permissions });
    }

    if (inflight) {
      const data = await inflight;
      return NextResponse.json({ pages: data, _permissions: result.permissions });
    }

    const promise = getPaymentPages() as Promise<unknown[]>;
    inflight = promise;

    const data = await promise;
    cache = { data, ts: Date.now() };
    inflight = null;
    return NextResponse.json({ pages: data, _permissions: result.permissions });
  } catch (error) {
    inflight = null;
    const message = error instanceof Error ? error.message : "Failed to fetch payment pages";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
