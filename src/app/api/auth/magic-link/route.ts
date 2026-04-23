import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { logCritical } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(ip, "magic-link", 3, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Only send magic links to accounts that exist in our users table
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!existingUser) {
      // Don't reveal whether email exists — always return success
      return NextResponse.json({ success: true });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const { error } = await supabaseAdmin.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${appUrl}/auth/callback` },
    });

    if (error) {
      if (error.status === 429 || error.code === "over_email_send_rate_limit") {
        return NextResponse.json(
          { error: "Too many emails sent. Please wait a few minutes and try again." },
          { status: 429 }
        );
      }
      throw error;
    }

    await logCritical("anonymous", {
      action: "MAGIC_LINK_REQUESTED",
      module: "auth",
      breadcrumb_path: "APEX OS > Magic Link",
      details: { email, ip },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("magic-link error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
