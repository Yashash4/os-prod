import { supabase } from "./supabase";
import type { Module } from "@/types";

export async function getModulesForRole(roleId: string): Promise<Module[]> {
  const { data, error } = await supabase
    .from("role_modules")
    .select("module:modules(*)")
    .eq("role_id", roleId);

  if (error) throw error;

  return (data || [])
    .map((rm: Record<string, unknown>) => rm.module as Module)
    .filter((m: Module) => m.is_active)
    .sort((a: Module, b: Module) => a.order - b.order);
}

export async function getEffectiveModules(
  roleId: string,
  userId: string
): Promise<Module[]> {
  // 1. Get base modules from role
  const roleModules = await getModulesForRole(roleId);

  // 2. Get user overrides
  const { data: overrides } = await supabase
    .from("user_module_overrides")
    .select("module_id, access_type")
    .eq("user_id", userId);

  if (!overrides || overrides.length === 0) return roleModules;

  // 3. Apply revokes
  const revokedIds = new Set(
    overrides.filter((o) => o.access_type === "revoke").map((o) => o.module_id)
  );
  let effective = roleModules.filter((m) => !revokedIds.has(m.id));

  // 4. Apply grants
  const grantedIds = overrides
    .filter((o) => o.access_type === "grant")
    .map((o) => o.module_id);

  if (grantedIds.length > 0) {
    const existingIds = new Set(effective.map((m) => m.id));
    const newGrantIds = grantedIds.filter((id) => !existingIds.has(id));

    if (newGrantIds.length > 0) {
      const { data: grantedModules } = await supabase
        .from("modules")
        .select("*")
        .in("id", newGrantIds)
        .eq("is_active", true);

      if (grantedModules) {
        effective.push(...(grantedModules as Module[]));
      }
    }
  }

  return effective.sort((a, b) => a.order - b.order);
}

export async function getTopLevelModules(roleId: string): Promise<Module[]> {
  const modules = await getModulesForRole(roleId);
  return modules.filter((m) => m.parent_slug === null);
}

export async function getChildModules(
  roleId: string,
  parentSlug: string
): Promise<Module[]> {
  const modules = await getModulesForRole(roleId);
  return modules.filter((m) => m.parent_slug === parentSlug);
}

export async function canAccessModule(
  roleId: string,
  moduleSlug: string,
  userId?: string
): Promise<boolean> {
  const modules = userId
    ? await getEffectiveModules(roleId, userId)
    : await getModulesForRole(roleId);
  return modules.some((m) => m.slug === moduleSlug);
}

export async function isAdmin(roleId: string): Promise<boolean> {
  const { data } = await supabase
    .from("roles")
    .select("is_admin")
    .eq("id", roleId)
    .single();

  return data?.is_admin ?? false;
}
