import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    // Fetch users with their roles from the users table (direct role_id FK)
    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("*, role:roles(*)");

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
  try {
    const body = await req.json();
    const { email, password, full_name, role_id } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    // Create auth user
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError) throw authError;
    const userId = authData.user.id;

    // Create user profile row
    await supabaseAdmin.from("users").insert({
      id: userId,
      email,
      full_name: full_name || null,
      role_id: role_id || null,
    });

    // Audit log
    await supabaseAdmin.from("audit_logs").insert({
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
      const { error } = await supabaseAdmin
        .from("users")
        .update(updates)
        .eq("id", user_id);
      if (error) throw error;
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
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");

    if (!userId) {
      return NextResponse.json({ error: "user_id required" }, { status: 400 });
    }

    // Delete from users table first (cascade should handle it, but be safe)
    await supabaseAdmin.from("users").delete().eq("id", userId);

    // Delete auth user
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;

    // Audit log
    await supabaseAdmin.from("audit_logs").insert({
      action: "user_deleted",
      tier: 1,
      module: "admin",
      breadcrumb: "APEX OS > Admin > People",
      entity_type: "user",
      entity_id: userId,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete user" },
      { status: 500 }
    );
  }
}
