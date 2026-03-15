import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Simple in-memory rate limiter: max 10 requests per IP per minute
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

// Public endpoint — no auth required (invoice links shared via email)
export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const invoiceNumber = req.nextUrl.searchParams.get("invoice_number");

    if (!invoiceNumber) {
      return NextResponse.json({ error: "invoice_number is required" }, { status: 400 });
    }

    // Only select non-sensitive fields — exclude recipient_email
    const { data, error } = await supabaseAdmin
      .from("sent_invoices")
      .select("invoice_number, recipient_name, amount, sent_at")
      .eq("invoice_number", invoiceNumber)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json({ invoice: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
