import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/api-auth";
import { resolveDataScope } from "@/lib/data-scope";
import { getModulePermissions } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { PermissionMatrix } from "@/types";

/**
 * GET /api/user/permissions?module=<parentSlug>
 *
 * Returns the current user's scope level and permission matrix
 * for each sub-module under the given parent module.
 */
export async function GET(req: NextRequest) {
  const moduleSlug = req.nextUrl.searchParams.get("module");

  if (!moduleSlug) {
    return NextResponse.json(
      { error: "Query param 'module' is required" },
      { status: 400 }
    );
  }

  // Auth + module access check
  const result = await requireModuleAccess(req, moduleSlug);
  if ("error" in result) return result.error;

  const { auth } = result;

  // Resolve scope
  const scope = await resolveDataScope(auth.userId, auth.roleId, auth.isAdmin);

  // Fetch all sub-modules under this parent
  const { data: subModules } = await supabaseAdmin
    .from("modules")
    .select("id, slug, name")
    .eq("parent_slug", moduleSlug)
    .eq("is_active", true)
    .order("order");

  const actions: Record<string, PermissionMatrix> = {};

  if (subModules) {
    // Fetch permissions for all sub-modules in parallel
    const permPromises = subModules.map(async (sub) => {
      const perms = await getModulePermissions(
        auth.userId,
        auth.roleId,
        sub.slug,
        auth.isAdmin
      );
      return { slug: sub.slug, perms };
    });

    const results = await Promise.all(permPromises);
    for (const { slug, perms } of results) {
      actions[slug] = perms;
    }
  }

  return NextResponse.json({
    scopeLevel: scope.scopeLevel.slug,
    dataVisibility: scope.scopeLevel.data_visibility,
    canDelete: scope.scopeLevel.can_delete,
    actions,
  });
}
