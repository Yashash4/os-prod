import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("error" in authResult) return authResult.error;

  try {
    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("*, role:roles(*)")
      .limit(500);

    if (error) throw error;

    const records = (users || []).map((u: Record<string, unknown>) => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      avatar_url: u.avatar_url,
      role: u.role || null,
      created_at: u.created_at,
    }));

    return NextResponse.json({ users: records });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("error" in authResult) return authResult.error;

  try {
    const body = await req.json();
    const { email, full_name, role_id } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Create user with a random password (account exists immediately)
    const randomPassword = `Apex${crypto.randomUUID().slice(0, 12)}!`;
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: randomPassword,
        email_confirm: true,
        user_metadata: { full_name: full_name || undefined },
      });

    if (authError) throw authError;
    const userId = authData.user.id;

    // Send password reset email so user can set their own password
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/reset-password`,
    });

    // Create user profile row
    await supabaseAdmin.from("users").insert({
      id: userId,
      email,
      full_name: full_name || null,
      role_id: role_id || null,
    });

    // Audit log
    await supabaseAdmin.from("audit_logs").insert({
      user_id: authResult.auth.userId,
      action: "user_invited",
      tier: 1,
      module: "admin",
      breadcrumb: "APEX OS > Admin > People",
      entity_type: "user",
      entity_id: userId,
      after_value: { email, full_name, role_id },
    });

    return NextResponse.json({
      record: { id: userId, email, full_name, role_id },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to invite user" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("error" in authResult) return authResult.error;

  try {
    const body = await req.json();
    const { user_id, full_name, role_id } = body;

    if (!user_id) {
      return NextResponse.json({ error: "user_id required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (role_id !== undefined) updates.role_id = role_id || null;

    if (Object.keys(updates).length > 0) {
      // Capture before state for audit
      const { data: before } = await supabaseAdmin
        .from("users")
        .select("full_name, role_id")
        .eq("id", user_id)
        .maybeSingle();

      const { error } = await supabaseAdmin
        .from("users")
        .update(updates)
        .eq("id", user_id);
      if (error) throw error;

      // Audit log
      await supabaseAdmin.from("audit_logs").insert({
        user_id: authResult.auth.userId,
        action: "user_updated",
        tier: 1,
        module: "admin",
        breadcrumb: "APEX OS > Admin > People",
        entity_type: "user",
        entity_id: user_id,
        before_value: before || {},
        after_value: updates,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update user" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("error" in authResult) return authResult.error;

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");

    if (!userId) {
      return NextResponse.json({ error: "user_id required" }, { status: 400 });
    }

    // Audit log first — capture the action before data is gone
    await supabaseAdmin.from("audit_logs").insert({
      user_id: authResult.auth.userId,
      action: "user_deleted",
      tier: 1,
      module: "admin",
      breadcrumb: "APEX OS > Admin > People",
      entity_type: "user",
      entity_id: userId,
    });

    // Delete auth user first — if this fails, DB row stays intact (recoverable)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;

    // Then delete from users table (cascade handles related rows)
    await supabaseAdmin.from("users").delete().eq("id", userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete user" },
      { status: 500 }
    );
  }
}
