import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireModuleAccess, getAccessibleSubModules } from "@/lib/api-auth";
import { getModulePermissions } from "@/lib/permissions";

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
      const { data: task } = await supabaseAdmin.from("tasks").select("assigned_to").eq("id", taskId).single();
      if (!task || task.assigned_to !== auth.auth.userId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const { data, error } = await supabaseAdmin
      .from("task_comments")
      .select("*, user:users!task_comments_user_id_fkey(id, full_name, email, avatar_url)")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const permissions = await getModulePermissions(auth.auth.userId, auth.auth.roleId, "tasks-board", auth.auth.isAdmin);
    return NextResponse.json({ comments: data || [], _permissions: permissions });
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

    // If user only has tasks-my, verify the task is assigned to them before commenting
    if (!canSeeBoard && !canSeeTeam && canSeeMy) {
      const { data: task } = await supabaseAdmin.from("tasks").select("assigned_to").eq("id", task_id).single();
      if (!task || task.assigned_to !== auth.auth.userId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    if (!task_id || !commentBody) {
      return NextResponse.json(
        { error: "task_id and body are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("task_comments")
      .insert({
        task_id,
        body: commentBody,
        user_id: auth.auth.userId,
      })
      .select("*, user:users!task_comments_user_id_fkey(id, full_name, email, avatar_url)")
      .single();

    if (error) throw error;

    return NextResponse.json({ comment: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create comment" },
      { status: 500 }
    );
  }
}
