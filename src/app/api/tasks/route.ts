import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireModuleAccess, getAccessibleSubModules } from "@/lib/api-auth";
import { resolveDataScope } from "@/lib/data-scope";
import { getModulePermissions } from "@/lib/permissions";
import { logImportant } from "@/lib/logger";

type RawTask = Record<string, unknown> & { assigned_to: string | null };
type PublicUser = { id: string; full_name: string | null; email: string; avatar_url: string | null };

async function enrichTasksWithUsers(tasks: RawTask[]) {
  const userIds = [...new Set(tasks.map((t) => t.assigned_to).filter(Boolean))] as string[];
  let userMap: Record<string, PublicUser> = {};
  if (userIds.length > 0) {
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id, full_name, email, avatar_url")
      .in("id", userIds);
    if (users) {
      userMap = Object.fromEntries(users.map((u: PublicUser) => [u.id, u]));
    }
  }
  return tasks.map((t) => ({
    ...t,
    assigned_user: t.assigned_to ? (userMap[t.assigned_to] || null) : null,
  }));
}

export async function GET(req: NextRequest) {
  const auth = await requireModuleAccess(req, "tasks");
  if ("error" in auth) return auth.error;

  const subModules = await getAccessibleSubModules(auth.auth, "tasks");
  const isAdmin     = subModules.has("__admin__");
  const canSeeBoard = isAdmin || subModules.has("tasks-board");
  const canSeeTeam  = isAdmin || subModules.has("tasks-team");
  const canSeeMy    = isAdmin || subModules.has("tasks-my");

  // Resolve scope and permissions
  const [scope, permissions] = await Promise.all([
    resolveDataScope(auth.auth.userId, auth.auth.roleId, auth.auth.isAdmin),
    getModulePermissions(auth.auth.userId, auth.auth.roleId, "tasks-board", auth.auth.isAdmin),
  ]);

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const projectId = searchParams.get("project_id");
    const assignedTo = searchParams.get("assigned_to");
    const status = searchParams.get("status");

    // Single task fetch
    if (id) {
      const { data, error } = await supabaseAdmin
        .from("tasks")
        .select("*, project:projects!tasks_project_id_fkey(id, name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      // If user can only see their own tasks, enforce ownership
      if (!canSeeBoard && !canSeeTeam && canSeeMy && data.assigned_to !== auth.auth.userId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      const [enriched] = await enrichTasksWithUsers([data as RawTask]);
      return NextResponse.json({ task: enriched, _permissions: permissions });
    }

    let query = supabaseAdmin
      .from("tasks")
      .select("*, project:projects!tasks_project_id_fkey(id, name)");

    // Scope data: if user only has tasks-my (not board/team), force filter to assigned self
    if (!canSeeBoard && !canSeeTeam) {
      if (canSeeMy) {
        query = query.eq("assigned_to", auth.auth.userId);
      } else {
        return NextResponse.json({ tasks: [], _permissions: permissions });
      }
    } else if (canSeeTeam && !canSeeBoard) {
      // Team scope: filter assigned_to by team user IDs
      const teamIds = [auth.auth.userId, ...scope.teamUserIds];
      query = query.in("assigned_to", teamIds);
    }

    if (projectId) query = query.eq("project_id", projectId);
    if (assignedTo && (canSeeBoard || canSeeTeam)) query = query.eq("assigned_to", assignedTo);
    if (status) query = query.eq("status", status);

    query = query.order("order", { ascending: true }).order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    const enriched = await enrichTasksWithUsers((data || []) as RawTask[]);

    return NextResponse.json({ tasks: enriched, _permissions: permissions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireModuleAccess(req, "tasks");
  if ("error" in auth) return auth.error;

  const subModules = await getAccessibleSubModules(auth.auth, "tasks");
  const isAdmin     = subModules.has("__admin__");
  const canSeeBoard = isAdmin || subModules.has("tasks-board");
  const canSeeTeam  = isAdmin || subModules.has("tasks-team");
  const canSeeMy    = isAdmin || subModules.has("tasks-my");

  // Permission check
  const permissions = await getModulePermissions(auth.auth.userId, auth.auth.roleId, "tasks-board", auth.auth.isAdmin);
  if (!permissions.canCreate) {
    return NextResponse.json({ error: "Permission denied: canCreate" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { project_id, title, description, status, priority, due_date, label } = body;
    // If user only has tasks-my, they can only create tasks assigned to themselves
    let assigned_to = body.assigned_to;
    if (!canSeeBoard && !canSeeTeam && canSeeMy) {
      assigned_to = auth.auth.userId;
    }

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("tasks")
      .insert({
        project_id: project_id || null,
        title,
        description: description || null,
        status: status || "todo",
        priority: priority || "medium",
        assigned_to: assigned_to || null,
        due_date: due_date || null,
        label: label || null,
        created_by: auth.auth.userId,
      })
      .select("*, project:projects!tasks_project_id_fkey(id, name)")
      .single();

    if (error) throw error;

    const [enriched] = await enrichTasksWithUsers([data as RawTask]);

    return NextResponse.json({ task: enriched }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create task" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireModuleAccess(req, "tasks");
  if ("error" in auth) return auth.error;

  const subModules = await getAccessibleSubModules(auth.auth, "tasks");
  const isAdmin     = subModules.has("__admin__");
  const canSeeBoard = isAdmin || subModules.has("tasks-board");
  const canSeeTeam  = isAdmin || subModules.has("tasks-team");
  const canSeeMy    = isAdmin || subModules.has("tasks-my");

  // Permission check
  const permissions = await getModulePermissions(auth.auth.userId, auth.auth.roleId, "tasks-board", auth.auth.isAdmin);
  if (!permissions.canEdit) {
    return NextResponse.json({ error: "Permission denied: canEdit" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Task id is required" }, { status: 400 });
    }

    // If user only has tasks-my, verify task is assigned to them before updating
    if (!canSeeBoard && !canSeeTeam && canSeeMy) {
      const { data: existing } = await supabaseAdmin.from("tasks").select("assigned_to").eq("id", id).single();
      if (!existing || existing.assigned_to !== auth.auth.userId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const allowed: Record<string, unknown> = {};
    const fields = ["project_id", "title", "description", "status", "priority", "assigned_to", "due_date", "label", "order"];
    for (const f of fields) {
      if (updates[f] !== undefined) allowed[f] = updates[f];
    }
    allowed.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("tasks")
      .update(allowed)
      .eq("id", id)
      .select("*, project:projects!tasks_project_id_fkey(id, name)")
      .single();

    if (error) throw error;

    const [enriched] = await enrichTasksWithUsers([data as RawTask]);

    return NextResponse.json({ task: enriched });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update task" },
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
      return NextResponse.json({ error: "Task id is required" }, { status: 400 });
    }

    // Fetch task before deletion for audit snapshot
    const { data: beforeTask } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("id", id)
      .single();

    const { error } = await supabaseAdmin.from("tasks").delete().eq("id", id);
    if (error) throw error;

    await logImportant(auth.auth.userId, {
      action: "task.deleted",
      module: "tasks",
      breadcrumb_path: "APEX OS > Tasks",
      details: { entity_type: "task", entity_id: id },
      before_value: beforeTask as Record<string, unknown> || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete task" },
      { status: 500 }
    );
  }
}
