import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "./supabase-admin";

/**
 * Server-side auth helper for API routes.
 * Extracts the Supabase session from cookies/headers and verifies the user.
 * Returns the authenticated user or a 401 response.
 */

interface AuthResult {
  userId: string;
  email: string;
  roleId: string | null;
  isAdmin: boolean;
}

/**
 * Authenticate the request using the Authorization header (Bearer token)
 * or Supabase cookie-based session.
 */
export async function authenticateRequest(
  req: NextRequest
): Promise<{ auth: AuthResult } | { error: NextResponse }> {
  try {
    // Try Bearer token first
    const authHeader = req.headers.get("authorization");
    let accessToken: string | undefined;

    if (authHeader?.startsWith("Bearer ")) {
      accessToken = authHeader.slice(7);
    }

    // Try cookie-based session (only if cookies are present)
    if (!accessToken) {
      const cookieHeader = req.headers.get("cookie");
      if (cookieHeader) {
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseServer = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              headers: { cookie: cookieHeader },
            },
          }
        );
        const {
          data: { session },
        } = await supabaseServer.auth.getSession();
        accessToken = session?.access_token;
      }
    }

    if (!accessToken) {
      return {
        error: NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        ),
      };
    }

    // Verify the token with Supabase
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user) {
      return {
        error: NextResponse.json(
          { error: "Invalid or expired session" },
          { status: 401 }
        ),
      };
    }

    // Get user's role
    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("role_id, role:roles(is_admin)")
      .eq("id", user.id)
      .single();

    const roleId = profile?.role_id || null;
    const isAdmin =
      profile?.role && typeof profile.role === "object"
        ? (profile.role as { is_admin?: boolean }).is_admin === true
        : false;

    return {
      auth: {
        userId: user.id,
        email: user.email || "",
        roleId,
        isAdmin,
      },
    };
  } catch {
    return {
      error: NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 }
      ),
    };
  }
}

/**
 * Require the user to be an admin. Returns 403 if not.
 */
export async function requireAdmin(
  req: NextRequest
): Promise<{ auth: AuthResult } | { error: NextResponse }> {
  const result = await authenticateRequest(req);
  if ("error" in result) return result;

  if (!result.auth.isAdmin) {
    return {
      error: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      ),
    };
  }

  return result;
}

/**
 * Require the user to have access to a specific module.
 * Access is granted if: admin, role grants the module, or user has an override grant.
 */
export async function requireModuleAccess(
  req: NextRequest,
  moduleSlug: string
): Promise<{ auth: AuthResult } | { error: NextResponse }> {
  const result = await authenticateRequest(req);
  if ("error" in result) return result;

  // Admins always have access
  if (result.auth.isAdmin) return result;

  const { userId, roleId } = result.auth;

  // Check role-based access
  if (roleId) {
    const { data: roleAccess } = await supabaseAdmin
      .from("role_modules")
      .select("id, module:modules!inner(slug)")
      .eq("role_id", roleId)
      .eq("modules.slug", moduleSlug)
      .maybeSingle();

    if (roleAccess) return result;
  }

  // Check user override grant
  const { data: override } = await supabaseAdmin
    .from("user_module_overrides")
    .select("id, module:modules!inner(slug)")
    .eq("user_id", userId)
    .eq("access_type", "grant")
    .eq("modules.slug", moduleSlug)
    .maybeSingle();

  if (override) return result;

  return {
    error: NextResponse.json(
      { error: "Module access required" },
      { status: 403 }
    ),
  };
}

/**
 * Returns the set of sub-module slugs the user can access under a given parent.
 * Call this after requireModuleAccess has already verified the user is authenticated.
 *
 * Returns a Set of accessible sub-module slugs.
 * Admins get a Set containing "__admin__" which signals full access.
 */
export async function getAccessibleSubModules(
  auth: AuthResult,
  parentSlug: string
): Promise<Set<string>> {
  if (auth.isAdmin) return new Set(["__admin__"]);

  const { userId, roleId } = auth;

  const { data: allSubModules } = await supabaseAdmin
    .from("modules")
    .select("id, slug")
    .eq("parent_slug", parentSlug)
    .eq("is_active", true);

  if (!allSubModules?.length) return new Set();

  const subModuleIds = allSubModules.map((m: { id: string; slug: string }) => m.id);
  const subModuleById = new Map(allSubModules.map((m: { id: string; slug: string }) => [m.id, m.slug]));
  const accessibleIds = new Set<string>();

  if (roleId) {
    const { data: roleAccess } = await supabaseAdmin
      .from("role_modules")
      .select("module_id")
      .eq("role_id", roleId)
      .in("module_id", subModuleIds);
    for (const row of roleAccess || []) accessibleIds.add(row.module_id);
  }

  const { data: overrides } = await supabaseAdmin
    .from("user_module_overrides")
    .select("module_id, access_type")
    .eq("user_id", userId)
    .in("module_id", subModuleIds);
  for (const o of overrides || []) {
    if (o.access_type === "revoke") accessibleIds.delete(o.module_id);
    else if (o.access_type === "grant") accessibleIds.add(o.module_id);
  }

  const slugSet = new Set<string>();
  for (const id of accessibleIds) {
    const slug = subModuleById.get(id);
    if (slug) slugSet.add(slug);
  }
  return slugSet;
}
