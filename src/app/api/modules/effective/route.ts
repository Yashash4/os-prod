import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if ("error" in authResult) return authResult.error;

  try {
    const { searchParams } = new URL(req.url);
    const roleId = searchParams.get("role_id");

    // Admins see all active modules — no role/override filtering needed
    if (authResult.auth.isAdmin) {
      const { data: allModules } = await supabaseAdmin
        .from("modules")
        .select("*")
        .eq("is_active", true)
        .order("order", { ascending: true });
      return NextResponse.json({ modules: allModules || [] });
    }

    // If a role_id is provided, verify it belongs to the authenticated user
    if (roleId) {
      let userRoleId: string | null = null;
      try {
        const { data: userProfile, error } = await supabaseAdmin
          .from("users")
          .select("role_id")
          .eq("id", authResult.auth.userId)
          .maybeSingle();
        if (!error) {
          userRoleId = userProfile?.role_id ?? null;
        }
      } catch {
        // users table may not exist or lack role_id column — skip verification
      }

      if (userRoleId !== roleId && !authResult.auth.isAdmin) {
        return NextResponse.json(
          { error: "Not authorized to view modules for this role", modules: [] },
          { status: 403 }
        );
      }
    }

    // Get role-based modules (empty if no role)
    let roleModules: Record<string, unknown>[] = [];
    if (roleId) {
      const { data: roleModuleRows } = await supabaseAdmin
        .from("role_modules")
        .select("module:modules(*)")
        .eq("role_id", roleId);

      roleModules = (roleModuleRows || [])
        .map((rm: Record<string, unknown>) => rm.module)
        .filter((m: unknown) => m && (m as { is_active: boolean }).is_active) as Record<string, unknown>[];
    }

    // Get user overrides (works even without a role — supports override-only access)
    // Wrapped in try-catch: if user_module_overrides table doesn't exist yet, continue without overrides
    let overrides: { module_id: string; access_type: string }[] = [];
    try {
      const { data, error } = await supabaseAdmin
        .from("user_module_overrides")
        .select("module_id, access_type")
        .eq("user_id", authResult.auth.userId);
      if (!error) {
        overrides = data || [];
      }
    } catch {
      // Table may not exist yet — continue without overrides
    }

    if (overrides.length === 0) {
      return NextResponse.json({ modules: roleModules });
    }

    // Apply revokes
    const revokedIds = new Set(
      overrides.filter((o) => o.access_type === "revoke").map((o) => o.module_id)
    );
    let effective = (roleModules as { id: string }[]).filter((m) => !revokedIds.has(m.id));

    // Apply grants
    const grantedIds = overrides
      .filter((o) => o.access_type === "grant")
      .map((o) => o.module_id);

    if (grantedIds.length > 0) {
      const existingIds = new Set(effective.map((m) => m.id));
      const newGrantIds = grantedIds.filter((id) => !existingIds.has(id));

      if (newGrantIds.length > 0) {
        const { data: grantedModules } = await supabaseAdmin
          .from("modules")
          .select("*")
          .in("id", newGrantIds)
          .eq("is_active", true);

        if (grantedModules) {
          effective.push(...grantedModules);
        }
      }
    }

    return NextResponse.json({ modules: effective });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch modules", modules: [] },
      { status: 500 }
    );
  }
}
