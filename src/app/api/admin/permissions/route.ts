import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("error" in authResult) return authResult.error;

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");

    // Get all roles
    const { data: roles } = await supabaseAdmin
      .from("roles")
      .select("*")
      .order("name");

    // Get all modules
    const { data: modules } = await supabaseAdmin
      .from("modules")
      .select("*")
      .eq("is_active", true)
      .order("order");

    // Get all role-module mappings
    const { data: roleModules } = await supabaseAdmin
      .from("role_modules")
      .select("*");

    // Get role_module_permissions (permission matrix)
    const { data: roleModulePermissions } = await supabaseAdmin
      .from("role_module_permissions")
      .select("*");

    // Get user overrides if user_id provided
    let userOverrides = null;
    if (userId) {
      const { data } = await supabaseAdmin
        .from("user_module_overrides")
        .select("*")
        .eq("user_id", userId);
      userOverrides = data;
    }

    // Get scope levels
    const { data: scopeLevels } = await supabaseAdmin
      .from("scope_levels")
      .select("*")
      .order("rank", { ascending: true });

    return NextResponse.json({
      roles: roles || [],
      modules: modules || [],
      roleModules: roleModules || [],
      roleModulePermissions: roleModulePermissions || [],
      scopeLevels: scopeLevels || [],
      userOverrides,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch permissions" },
      { status: 500 }
    );
  }
}

// Toggle role-module assignment or update permission matrix
export async function PUT(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("error" in authResult) return authResult.error;

  try {
    const body = await req.json();

    // Handle permission matrix update
    if (body.type === "permission_matrix") {
      const { role_id, module_id, can_read, can_create, can_edit, can_approve, can_export } = body;

      if (!role_id || !module_id) {
        return NextResponse.json(
          { error: "role_id and module_id required for permission_matrix" },
          { status: 400 }
        );
      }

      const { error } = await supabaseAdmin
        .from("role_module_permissions")
        .upsert(
          {
            role_id,
            module_id,
            can_read: can_read ?? false,
            can_create: can_create ?? false,
            can_edit: can_edit ?? false,
            can_approve: can_approve ?? false,
            can_export: can_export ?? false,
          },
          { onConflict: "role_id,module_id" }
        );
      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    // Handle role-module access toggle (existing behavior)
    const { role_id, module_id, action } = body;

    if (!role_id || !module_id || !action) {
      return NextResponse.json(
        { error: "role_id, module_id, and action required" },
        { status: 400 }
      );
    }

    if (action === "grant") {
      const { error } = await supabaseAdmin
        .from("role_modules")
        .upsert({ role_id, module_id }, { onConflict: "role_id,module_id" });
      if (error) throw error;
    } else if (action === "revoke") {
      const { error } = await supabaseAdmin
        .from("role_modules")
        .delete()
        .eq("role_id", role_id)
        .eq("module_id", module_id);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update permission" },
      { status: 500 }
    );
  }
}

// Set user module override
export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("error" in authResult) return authResult.error;

  try {
    const body = await req.json();
    const { user_id, module_id, access_type } = body;

    if (!user_id || !module_id || !access_type) {
      return NextResponse.json(
        { error: "user_id, module_id, and access_type required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("user_module_overrides")
      .upsert(
        { user_id, module_id, access_type },
        { onConflict: "user_id,module_id" }
      );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to set override" },
      { status: 500 }
    );
  }
}

// Remove user module override
export async function DELETE(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("error" in authResult) return authResult.error;

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");
    const moduleId = searchParams.get("module_id");

    if (!userId || !moduleId) {
      return NextResponse.json(
        { error: "user_id and module_id required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("user_module_overrides")
      .delete()
      .eq("user_id", userId)
      .eq("module_id", moduleId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to remove override" },
      { status: 500 }
    );
  }
}
