import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const { data: roles, error } = await supabaseAdmin
      .from("roles")
      .select("*")
      .order("name");

    if (error) throw error;

    // Get user counts per role from users table (direct role_id)
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("role_id");

    const countMap: Record<string, number> = {};
    for (const u of users || []) {
      if (u.role_id) countMap[u.role_id] = (countMap[u.role_id] || 0) + 1;
    }

    const records = (roles || []).map((r: Record<string, unknown>) => ({
      ...r,
      user_count: countMap[r.id as string] || 0,
    }));

    return NextResponse.json({ roles: records });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch roles" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, is_admin } = body;

    if (!name) {
      return NextResponse.json({ error: "Role name required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("roles")
      .insert({ name, description: description || null, is_admin: is_admin || false })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ role: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create role" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, description, is_admin } = body;

    if (!id) {
      return NextResponse.json({ error: "Role ID required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (is_admin !== undefined) updates.is_admin = is_admin;

    const { error } = await supabaseAdmin
      .from("roles")
      .update(updates)
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update role" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Role ID required" }, { status: 400 });
    }

    // Check if role has users assigned
    const { data: usersWithRole } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("role_id", id)
      .limit(1);

    if (usersWithRole && usersWithRole.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete role with assigned users. Reassign them first." },
        { status: 400 }
      );
    }

    // Delete role_modules for this role
    await supabaseAdmin.from("role_modules").delete().eq("role_id", id);

    const { error } = await supabaseAdmin.from("roles").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete role" },
      { status: 500 }
    );
  }
}
