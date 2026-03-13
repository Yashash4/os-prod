import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireModuleAccess } from "@/lib/api-auth";
import { getModulePermissions } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const auth = await requireModuleAccess(req, "tasks");
  if ("error" in auth) return auth.error;

  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, full_name, email, avatar_url")
      .order("full_name", { ascending: true });

    if (error) throw error;

    const permissions = await getModulePermissions(auth.auth.userId, auth.auth.roleId, "tasks-board", auth.auth.isAdmin);
    return NextResponse.json({ users: data || [], _permissions: permissions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch users" },
      { status: 500 }
    );
  }
}
