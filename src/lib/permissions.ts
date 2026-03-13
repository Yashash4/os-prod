import { supabaseAdmin } from "./supabase-admin";
import type { PermissionMatrix } from "@/types";

/**
 * Get the effective permission matrix for a user on a specific module.
 *
 * Merges role-level permissions with per-user overrides.
 * User overrides always win over role defaults.
 * Admins get all permissions including delete.
 */
export async function getModulePermissions(
  userId: string,
  roleId: string | null,
  moduleSlug: string,
  isAdmin = false
): Promise<PermissionMatrix> {
  // Admins get everything
  if (isAdmin) {
    return {
      canRead: true,
      canCreate: true,
      canEdit: true,
      canApprove: true,
      canExport: true,
      canDelete: true,
    };
  }

  // Step 1: Look up module by slug
  const { data: mod } = await supabaseAdmin
    .from("modules")
    .select("id")
    .eq("slug", moduleSlug)
    .maybeSingle();

  if (!mod) {
    return {
      canRead: false,
      canCreate: false,
      canEdit: false,
      canApprove: false,
      canExport: false,
      canDelete: false,
    };
  }

  const moduleId = mod.id;

  // Step 2: Get role-level permissions
  let canRead = false;
  let canCreate = false;
  let canEdit = false;
  let canApprove = false;
  let canExport = false;

  if (roleId) {
    const { data: rolePerm } = await supabaseAdmin
      .from("role_module_permissions")
      .select("can_read, can_create, can_edit, can_approve, can_export")
      .eq("role_id", roleId)
      .eq("module_id", moduleId)
      .maybeSingle();

    if (rolePerm) {
      canRead = rolePerm.can_read ?? false;
      canCreate = rolePerm.can_create ?? false;
      canEdit = rolePerm.can_edit ?? false;
      canApprove = rolePerm.can_approve ?? false;
      canExport = rolePerm.can_export ?? false;
    }
  }

  // Step 3: Apply user-level overrides
  const { data: overrides } = await supabaseAdmin
    .from("user_permission_overrides")
    .select("action, granted")
    .eq("user_id", userId)
    .eq("module_id", moduleId);

  if (overrides) {
    for (const o of overrides) {
      switch (o.action) {
        case "read":
          canRead = o.granted;
          break;
        case "create":
          canCreate = o.granted;
          break;
        case "edit":
          canEdit = o.granted;
          break;
        case "approve":
          canApprove = o.granted;
          break;
        case "export":
          canExport = o.granted;
          break;
      }
    }
  }

  return {
    canRead,
    canCreate,
    canEdit,
    canApprove,
    canExport,
    canDelete: false, // Delete is admin-only, never in matrix
  };
}

/**
 * Check if the user has a specific permission. Throws 403-style error if denied.
 */
export function requirePermission(
  matrix: PermissionMatrix,
  action: keyof PermissionMatrix
): void {
  if (!matrix[action]) {
    const error = new Error(`Permission denied: ${action}`);
    (error as Error & { status: number }).status = 403;
    throw error;
  }
}
