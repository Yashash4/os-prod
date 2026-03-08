import { NextRequest, NextResponse } from "next/server";
import { createPaymentLink, getPaymentLinks } from "@/lib/razorpay";
import { authenticateRequest } from "@/lib/api-auth";

// In-memory cache for payment links
let cache: { data: unknown[]; ts: number } | null = null;
const CACHE_TTL = 120_000;

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  try {
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json({ paymentLinks: cache.data });
    }

    const from = req.nextUrl.searchParams.get("from") || undefined;
    const to = req.nextUrl.searchParams.get("to") || undefined;
    const fromTs = from ? parseInt(from) : undefined;
    const toTs = to ? parseInt(to) : undefined;

    const data = (await getPaymentLinks(fromTs, toTs)) as Record<string, unknown>[];
    const normalized = data.map((item) => ({
      ...item,
      razorpay_created_at: item.created_at,
    }));
    cache = { data: normalized, ts: Date.now() };
    return NextResponse.json({ paymentLinks: normalized });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch payment links";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const {
      amount,
      currency,
      description,
      customerName,
      customerEmail,
      customerPhone,
      notifySms,
      notifyEmail,
      expireByUnix,
      notes,
    } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    if (!customerEmail && !customerPhone) {
      return NextResponse.json(
        { error: "At least one of email or phone is required" },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    const result = await createPaymentLink({
      amountInRupees: amount,
      currency: currency || "INR",
      description,
      customerName: customerName || "",
      customerEmail: customerEmail || undefined,
      customerPhone: customerPhone || undefined,
      notifySms: !!notifySms,
      notifyEmail: !!notifyEmail,
      expireByUnix: expireByUnix || undefined,
      notes: notes || undefined,
    });

    return NextResponse.json({
      success: true,
      paymentLink: {
        id: result.id,
        short_url: result.short_url,
        amount: result.amount,
        status: result.status,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create payment link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
