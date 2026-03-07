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
  moduleSlug: string
): Promise<boolean> {
  const modules = await getModulesForRole(roleId);
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
