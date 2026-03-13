import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { logCritical } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 attempts per minute per IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit(ip, "login", 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Verify credentials using admin client
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      await logCritical("anonymous", {
        action: "LOGIN_FAILED",
        module: "auth",
        breadcrumb_path: "APEX OS > Login",
        details: { email, ip, reason: error.message },
      });
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    await logCritical(data.user.id, {
      action: "LOGIN_SUCCESS",
      module: "auth",
      breadcrumb_path: "APEX OS > Login",
      details: { email, ip },
    });

    // Return session data to the client
    return NextResponse.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
