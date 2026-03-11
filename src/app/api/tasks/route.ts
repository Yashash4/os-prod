import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("project_id");
    const assignedTo = searchParams.get("assigned_to");
    const status = searchParams.get("status");

    let query = supabaseAdmin
      .from("tasks")
      .select("*, assigned_user:users!tasks_assigned_to_fkey(id, full_name, email, avatar_url), project:projects!tasks_project_id_fkey(id, name)");

    if (projectId) query = query.eq("project_id", projectId);
    if (assignedTo) query = query.eq("assigned_to", assignedTo);
    if (status) query = query.eq("status", status);

    query = query.order("order", { ascending: true }).order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ tasks: data || [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { project_id, title, description, status, priority, assigned_to, due_date, label } = body;

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
      .select("*, assigned_user:users!tasks_assigned_to_fkey(id, full_name, email, avatar_url), project:projects!tasks_project_id_fkey(id, name)")
      .single();

    if (error) throw error;

    return NextResponse.json({ task: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create task" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Task id is required" }, { status: 400 });
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
      .select("*, assigned_user:users!tasks_assigned_to_fkey(id, full_name, email, avatar_url), project:projects!tasks_project_id_fkey(id, name)")
      .single();

    if (error) throw error;

    return NextResponse.json({ task: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Task id is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("tasks").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete task" },
      { status: 500 }
    );
  }
}
