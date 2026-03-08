import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if ("error" in authResult) return authResult.error;

  try {
    // Use the authenticated user's identity — ignore query params for user_id
    // role_id is still accepted because it comes from the user's own profile
    const { searchParams } = new URL(req.url);
    const roleId = searchParams.get("role_id");

    if (!roleId) {
      return NextResponse.json({ modules: [] });
    }

    // Verify the role_id belongs to the authenticated user
    const { data: userProfile } = await supabaseAdmin
      .from("users")
      .select("role_id")
      .eq("id", authResult.auth.userId)
      .single();

    if (userProfile?.role_id !== roleId && !authResult.auth.isAdmin) {
      return NextResponse.json({ modules: [] });
    }

    // Get role modules
    const { data: roleModuleRows } = await supabaseAdmin
      .from("role_modules")
      .select("module:modules(*)")
      .eq("role_id", roleId);

    const roleModules = (roleModuleRows || [])
      .map((rm: Record<string, unknown>) => rm.module)
      .filter((m: unknown) => m && (m as { is_active: boolean }).is_active);

    // Get user overrides using the authenticated user's ID
    const { data: overrides } = await supabaseAdmin
      .from("user_module_overrides")
      .select("module_id, access_type")
      .eq("user_id", authResult.auth.userId);

    if (!overrides || overrides.length === 0) {
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
