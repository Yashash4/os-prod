import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireModuleAccess, getAccessibleSubModules } from "@/lib/api-auth";
import { resolveDataScope, scopeQuery, verifyScopeAccess } from "@/lib/data-scope";
import { getModulePermissions } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const auth = await requireModuleAccess(req, "tasks");
  if ("error" in auth) return auth.error;

  const [scope, permissions] = await Promise.all([
    resolveDataScope(auth.auth.userId, auth.auth.roleId, auth.auth.isAdmin),
    getModulePermissions(auth.auth.userId, auth.auth.roleId, "tasks-projects", auth.auth.isAdmin),
  ]);

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let query = supabaseAdmin.from("projects").select("*");

    // Scope on created_by (owner_id)
    query = scopeQuery(query, scope, "owner_id");

    if (status) {
      query = query.eq("status", status);
    }

    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ projects: data || [], _permissions: permissions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireModuleAccess(req, "tasks");
  if ("error" in auth) return auth.error;

  const subModules = await getAccessibleSubModules(auth.auth, "tasks");
  if (!subModules.has("__admin__") && !subModules.has("tasks-projects")) {
    return NextResponse.json({ error: "Module access required" }, { status: 403 });
  }

  const permissions = await getModulePermissions(auth.auth.userId, auth.auth.roleId, "tasks-projects", auth.auth.isAdmin);
  if (!permissions.canCreate) {
    return NextResponse.json({ error: "Permission denied: canCreate" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("projects")
      .insert({
        name,
        description: description || null,
        owner_id: auth.auth.userId,
        status: "active",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ project: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create project" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireModuleAccess(req, "tasks");
  if ("error" in auth) return auth.error;

  const subModules = await getAccessibleSubModules(auth.auth, "tasks");
  if (!subModules.has("__admin__") && !subModules.has("tasks-projects")) {
    return NextResponse.json({ error: "Module access required" }, { status: 403 });
  }

  const permissions = await getModulePermissions(auth.auth.userId, auth.auth.roleId, "tasks-projects", auth.auth.isAdmin);
  if (!permissions.canEdit) {
    return NextResponse.json({ error: "Permission denied: canEdit" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Project id is required" }, { status: 400 });
    }

    const scope = await resolveDataScope(auth.auth.userId, auth.auth.roleId, auth.auth.isAdmin);
    const scopeAllowed = await verifyScopeAccess(scope, "projects", id, "owner_id");
    if (!scopeAllowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });

    const allowed: Record<string, unknown> = {};
    if (updates.name !== undefined) allowed.name = updates.name;
    if (updates.description !== undefined) allowed.description = updates.description;
    if (updates.status !== undefined) allowed.status = updates.status;
    allowed.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("projects")
      .update(allowed)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ project: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update project" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireModuleAccess(req, "tasks");
  if ("error" in auth) return auth.error;

  // Delete is admin-only
  const scope = await resolveDataScope(auth.auth.userId, auth.auth.roleId, auth.auth.isAdmin);
  if (!scope.scopeLevel.can_delete) {
    return NextResponse.json({ error: "Permission denied: delete is admin-only" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Project id is required" }, { status: 400 });
    }

    const scopeAllowed = await verifyScopeAccess(scope, "projects", id, "owner_id");
    if (!scopeAllowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });

    const { error } = await supabaseAdmin.from("projects").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete project" },
      { status: 500 }
    );
  }
}
