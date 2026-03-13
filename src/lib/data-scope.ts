import { supabaseAdmin } from "./supabase-admin";
import type { DataScope, ScopeLevel } from "@/types";

/**
 * Default scope levels matching the seeded `scope_levels` table rows.
 * Used as fallback if DB query fails or table doesn't exist yet.
 */
const DEFAULT_SCOPE_LEVELS: Record<string, ScopeLevel> = {
  admin: {
    id: "admin",
    name: "Admin",
    slug: "admin",
    rank: 1,
    data_visibility: "all",
    can_delete: true,
    is_system: true,
    created_at: "",
  },
  manager: {
    id: "manager",
    name: "Manager",
    slug: "manager",
    rank: 2,
    data_visibility: "team",
    can_delete: false,
    is_system: true,
    created_at: "",
  },
  employee: {
    id: "employee",
    name: "Employee",
    slug: "employee",
    rank: 3,
    data_visibility: "self",
    can_delete: false,
    is_system: true,
    created_at: "",
  },
  client: {
    id: "client",
    name: "Client",
    slug: "client",
    rank: 4,
    data_visibility: "self",
    can_delete: false,
    is_system: true,
    created_at: "",
  },
};

/**
 * Fetch a scope level row from the DB by slug, falling back to defaults.
 */
async function getScopeLevel(slug: string): Promise<ScopeLevel> {
  const { data } = await supabaseAdmin
    .from("scope_levels")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (data) return data as ScopeLevel;
  return DEFAULT_SCOPE_LEVELS[slug] || DEFAULT_SCOPE_LEVELS.employee;
}

/**
 * Resolves the data scope for a user based on their role and employee record.
 *
 * Logic:
 * 1. Admin → scope level "admin" (sees all, can delete)
 * 2. No employee record → scope level "client" (sees own only)
 * 3. Has direct reports → scope level "manager" (sees team)
 * 4. Otherwise → scope level "employee" (sees own only)
 * 5. Role's `scope_level_id` can override auto-detected level
 */
export async function resolveDataScope(
  userId: string,
  roleId: string | null,
  isAdmin: boolean
): Promise<DataScope> {
  // Step 1: Admin shortcut
  if (isAdmin) {
    return {
      scopeLevel: await getScopeLevel("admin"),
      userId,
      teamEmployeeIds: [],
      teamUserIds: [],
    };
  }

  // Step 2: Find employee record for this user
  const { data: employee } = await supabaseAdmin
    .from("hr_employees")
    .select("id, department_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!employee) {
    // No employee record → client scope
    return {
      scopeLevel: await getScopeLevel("client"),
      userId,
      teamEmployeeIds: [],
      teamUserIds: [],
    };
  }

  const employeeId = employee.id;
  const departmentId = employee.department_id || undefined;

  // Step 3: Check if this employee has direct reports
  const { data: directReports } = await supabaseAdmin
    .from("hr_employees")
    .select("id, user_id")
    .eq("reporting_to", employeeId)
    .eq("status", "active");

  let detectedSlug: string;
  const teamEmployeeIds: string[] = [];
  const teamUserIds: string[] = [];

  if (directReports && directReports.length > 0) {
    // Manager — collect team IDs
    detectedSlug = "manager";
    for (const report of directReports) {
      teamEmployeeIds.push(report.id);
      if (report.user_id) teamUserIds.push(report.user_id);
    }
  } else {
    // Step 4: No direct reports → employee
    detectedSlug = "employee";
  }

  // Step 5: Check if role has a custom scope_level_id override
  if (roleId) {
    const { data: role } = await supabaseAdmin
      .from("roles")
      .select("scope_level_id")
      .eq("id", roleId)
      .maybeSingle();

    if (role?.scope_level_id) {
      const { data: customScope } = await supabaseAdmin
        .from("scope_levels")
        .select("*")
        .eq("id", role.scope_level_id)
        .maybeSingle();

      if (customScope) {
        return {
          scopeLevel: customScope as ScopeLevel,
          userId,
          employeeId,
          teamEmployeeIds,
          teamUserIds,
          departmentId,
        };
      }
    }
  }

  return {
    scopeLevel: await getScopeLevel(detectedSlug),
    userId,
    employeeId,
    teamEmployeeIds,
    teamUserIds,
    departmentId,
  };
}

/**
 * Apply scope-based WHERE clauses to a Supabase query.
 *
 * @param query - The Supabase query builder (from `.from().select()`)
 * @param scope - The resolved DataScope
 * @param column - The column to filter on (e.g. "employee_id", "created_by", "assigned_to")
 * @param useEmployeeIds - If true, filter by employee IDs; if false, filter by user IDs
 * @returns The query with scope filters applied
 */
export function scopeQuery<T>(
  query: T,
  scope: DataScope,
  column: string,
  useEmployeeIds = false
): T {
  const { scopeLevel, userId, employeeId, teamEmployeeIds, teamUserIds } = scope;
  const typedQuery = query as T & { eq: (col: string, val: string) => T; in: (col: string, vals: string[]) => T };

  if (scopeLevel.data_visibility === "all") {
    return query;
  }

  if (scopeLevel.data_visibility === "team") {
    if (useEmployeeIds) {
      const allIds = employeeId ? [employeeId, ...teamEmployeeIds] : teamEmployeeIds;
      return typedQuery.in(column, allIds);
    }
    const allIds = [userId, ...teamUserIds];
    return typedQuery.in(column, allIds);
  }

  // "self"
  if (useEmployeeIds && employeeId) {
    return typedQuery.eq(column, employeeId);
  }
  return typedQuery.eq(column, userId);
}

/**
 * Verify that the current user's scope allows access to a specific record.
 * Used before PUT/DELETE operations to ensure the user can modify the target row.
 *
 * @param scope - The resolved DataScope
 * @param table - The DB table name
 * @param id - The record's primary key value
 * @param column - The column to check ownership against (e.g. "created_by", "employee_id")
 * @param useEmployeeIds - If true, compare against employee IDs; if false, compare against user IDs
 * @returns true if access is allowed, false otherwise
 */
export async function verifyScopeAccess(
  scope: DataScope,
  table: string,
  id: string,
  column: string,
  useEmployeeIds = false,
  idColumn = "id"
): Promise<boolean> {
  const { scopeLevel, userId, employeeId, teamEmployeeIds, teamUserIds } = scope;

  // Admin sees all
  if (scopeLevel.data_visibility === "all") {
    return true;
  }

  // Fetch the target row's ownership column
  const { data: row, error } = await supabaseAdmin
    .from(table)
    .select(column)
    .eq(idColumn, id)
    .single();

  if (error || !row) {
    return false;
  }

  const rowValue = (row as unknown as Record<string, unknown>)[column] as string | null;
  if (!rowValue) return false;

  if (scopeLevel.data_visibility === "team") {
    if (useEmployeeIds) {
      const allIds = employeeId ? [employeeId, ...teamEmployeeIds] : teamEmployeeIds;
      return allIds.includes(rowValue);
    }
    const allIds = [userId, ...teamUserIds];
    return allIds.includes(rowValue);
  }

  // "self"
  if (useEmployeeIds && employeeId) {
    return rowValue === employeeId;
  }
  return rowValue === userId;
}
