import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { scopeQuery } from "@/lib/data-scope";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "seo", "seo-task-log");
  if ("error" in result) return result.error;

  try {
    let query = supabaseAdmin
      .from("seo_task_log")
      .select("*")
      .order("created_at", { ascending: false });

    const status = req.nextUrl.searchParams.get("status");
    const taskType = req.nextUrl.searchParams.get("task_type");
    const assignedTo = req.nextUrl.searchParams.get("assigned_to");

    if (status) query = query.eq("status", status);
    if (taskType) query = query.eq("task_type", taskType);
    if (assignedTo) query = query.eq("assigned_to", assignedTo);

    query = scopeQuery(query, result.scope, "created_by");

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ entries: data || [], _permissions: result.permissions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch task log";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "seo", "seo-task-log");
  if ("error" in result) return result.error;

  if (!result.permissions.canCreate) {
    return NextResponse.json({ error: "You do not have permission to create task log entries" }, { status: 403 });
  }

  try {
    const body = await req.json();

    if (!body.title) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("seo_task_log")
      .insert({ ...body, created_by: result.auth.userId })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ entry: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create task log entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "seo", "seo-task-log");
  if ("error" in result) return result.error;

  if (!result.permissions.canEdit) {
    return NextResponse.json({ error: "You do not have permission to edit task log entries" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("seo_task_log")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ entry: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update task log entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "seo", "seo-task-log");
  if ("error" in result) return result.error;

  if (!result.scope.scopeLevel.can_delete) {
    return NextResponse.json({ error: "Only admins can delete task log entries" }, { status: 403 });
  }

  try {
    const id = req.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("seo_task_log")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete task log entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
