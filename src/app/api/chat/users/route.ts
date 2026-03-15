import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/chat/users
 *
 * Returns users eligible for DM conversations.
 * - If the current user is admin: returns all users (they can DM anyone)
 * - If the current user is NOT admin: returns only admin users (non-admins can only DM admins)
 *
 * Also used by the channel creation modal to list users for adding as members.
 * Query params:
 *   ?for=dm   — filter by DM rules (default)
 *   ?for=all  — return all users (for channel member selection, admin only)
 */
export async function GET(req: NextRequest) {
  const result = await requireModuleAccess(req, "chat");
  if ("error" in result) return result.error;

  const { userId, isAdmin } = result.auth;
  const { searchParams } = new URL(req.url);
  const forParam = searchParams.get("for") || "dm";

  try {
    if (isAdmin || forParam === "all") {
      // Admins can see all users; for channel member selection show all
      const { data: users, error } = await supabaseAdmin
        .from("users")
        .select("id, full_name, email, avatar_url, role:roles(is_admin)")
        .neq("id", userId)
        .limit(500);

      if (error) throw error;

      const records = (users || []).map((u: Record<string, unknown>) => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        avatar_url: u.avatar_url,
        is_admin: (u.role as { is_admin?: boolean } | null)?.is_admin === true,
      }));

      return NextResponse.json({ users: records });
    }

    // Non-admin user requesting DM targets: only show admin users
    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("id, full_name, email, avatar_url, role:roles!inner(is_admin)")
      .neq("id", userId)
      .eq("roles.is_admin", true)
      .limit(500);

    if (error) throw error;

    const records = (users || []).map((u: Record<string, unknown>) => ({
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      avatar_url: u.avatar_url,
      is_admin: true,
    }));

    return NextResponse.json({ users: records });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch users" },
      { status: 500 }
    );
  }
}
