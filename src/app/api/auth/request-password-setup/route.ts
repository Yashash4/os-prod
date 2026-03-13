import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 3 requests per minute per IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit(ip, "request-password-setup", 3, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if user exists in our users table
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!existingUser) {
      // Don't reveal whether the email exists — always return success
      return NextResponse.json({ success: true });
    }

    // Send password reset email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/reset-password`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("request-password-setup error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
