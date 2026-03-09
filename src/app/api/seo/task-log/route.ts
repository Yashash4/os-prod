import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;

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

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ entries: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch task log";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;

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
      .insert({ ...body, created_by: auth.auth.userId })
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
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;

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
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;

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
