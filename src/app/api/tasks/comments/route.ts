import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("task_id");

    if (!taskId) {
      return NextResponse.json({ error: "task_id is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("task_comments")
      .select("*, user:users!task_comments_user_id_fkey(id, full_name, email, avatar_url)")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ comments: data || [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { task_id, body: commentBody } = body;

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
