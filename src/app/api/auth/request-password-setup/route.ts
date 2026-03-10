import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
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
