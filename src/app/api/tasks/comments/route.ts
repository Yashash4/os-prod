import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireModuleAccess, getAccessibleSubModules } from "@/lib/api-auth";
import { getModulePermissions } from "@/lib/permissions";
import { logImportant } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const auth = await requireModuleAccess(req, "tasks");
  if ("error" in auth) return auth.error;

  const subModules = await getAccessibleSubModules(auth.auth, "tasks");
  const isAdmin     = subModules.has("__admin__");
  const canSeeBoard = isAdmin || subModules.has("tasks-board");
  const canSeeTeam  = isAdmin || subModules.has("tasks-team");
  const canSeeMy    = isAdmin || subModules.has("tasks-my");

  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("task_id");

    if (!taskId) {
      return NextResponse.json({ error: "task_id is required" }, { status: 400 });
    }

    // If user only has tasks-my, verify the task is assigned to them
    if (!canSeeBoard && !canSeeTeam && canSeeMy) {
      const { data: task } = await supabaseAdmin.from("tasks").select("assigned_to").eq("id", taskId).maybeSingle();
      if (!task || task.assigned_to !== auth.auth.userId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const { data: comments, error } = await supabaseAdmin
      .from("task_comments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Fetch user details separately (FK is to auth.users, not public.users)
    const userIds = [...new Set((comments || []).map((c: { user_id: string }) => c.user_id))];
    let userMap: Record<string, { id: string; full_name: string | null; email: string; avatar_url: string | null }> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from("users")
        .select("id, full_name, email, avatar_url")
        .in("id", userIds);
      if (users) {
        userMap = Object.fromEntries(users.map((u) => [u.id, u]));
      }
    }

    const enriched = (comments || []).map((c: Record<string, unknown>) => ({
      ...c,
      user: userMap[c.user_id as string] || null,
    }));

    const permissions = await getModulePermissions(auth.auth.userId, auth.auth.roleId, "tasks-board", auth.auth.isAdmin);
    return NextResponse.json({ comments: enriched, _permissions: permissions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch comments" },
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

  const permissions = await getModulePermissions(auth.auth.userId, auth.auth.roleId, "tasks-board", auth.auth.isAdmin);
  if (!permissions.canCreate) {
    return NextResponse.json({ error: "Permission denied: canCreate" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { task_id, body: commentBody } = body;

    if (!task_id || !commentBody) {
      return NextResponse.json(
        { error: "task_id and body are required" },
        { status: 400 }
      );
    }

    // If user only has tasks-my, verify the task is assigned to them before commenting
    if (!canSeeBoard && !canSeeTeam && canSeeMy) {
      const { data: task } = await supabaseAdmin.from("tasks").select("assigned_to").eq("id", task_id).maybeSingle();
      if (!task || task.assigned_to !== auth.auth.userId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const { data, error } = await supabaseAdmin
      .from("task_comments")
      .insert({
        task_id,
        body: commentBody,
        user_id: auth.auth.userId,
      })
      .select("*")
      .single();

    if (error) throw error;

    // Fetch user details separately (FK is to auth.users, not public.users)
    let user = null;
    if (data) {
      const { data: userData } = await supabaseAdmin
        .from("users")
        .select("id, full_name, email, avatar_url")
        .eq("id", auth.auth.userId)
        .maybeSingle();
      user = userData;
    }
    const commentWithUser = data ? { ...data, user } : data;

    await logImportant(auth.auth.userId, {
      action: "create",
      module: "tasks",
      breadcrumb_path: "APEX OS > Tasks > Comments",
      details: { task_id, comment_id: data?.id },
      after_value: { body: commentBody },
    });

    return NextResponse.json({ comment: commentWithUser }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create comment" },
      { status: 500 }
    );
  }
}
