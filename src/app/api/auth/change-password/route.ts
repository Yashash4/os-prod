import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { authenticateRequest } from "@/lib/api-auth";
import { logCritical } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 3 attempts per minute per IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit(ip, "change-password", 3, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    // User must be authenticated
    const result = await authenticateRequest(req);
    if ("error" in result) return result.error;

    const { password } = await req.json();

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Update password via admin client
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      result.auth.userId,
      { password }
    );

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    await logCritical(result.auth.userId, {
      action: "PASSWORD_CHANGED",
      module: "auth",
      breadcrumb_path: "APEX OS > Change Password",
      details: { email: result.auth.email },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
