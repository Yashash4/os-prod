import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { scopeQuery, verifyScopeAccess } from "@/lib/data-scope";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "content", "content-video");
  if ("error" in result) return result.error;
  try {
    let query = supabaseAdmin
      .from("content_video_editing")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    query = scopeQuery(query, result.scope, "created_by");

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ records: data || [], _permissions: result.permissions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "content", "content-video");
  if ("error" in result) return result.error;

  if (!result.permissions.canCreate) {
    return NextResponse.json({ error: "You do not have permission to create video editing entries" }, { status: 403 });
  }

  try {
    const body = await req.json();

    const { data, error } = await supabaseAdmin
      .from("content_video_editing")
      .insert({ ...body, created_by: result.auth.userId })
      .select()
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ record: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "content", "content-video");
  if ("error" in result) return result.error;

  if (!result.permissions.canEdit) {
    return NextResponse.json({ error: "You do not have permission to edit video editing entries" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    const allowed = await verifyScopeAccess(result.scope, "content_video_editing", id, "created_by");
    if (!allowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from("content_video_editing")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ record: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "content", "content-video");
  if ("error" in result) return result.error;

  if (!result.scope.scopeLevel.can_delete) {
    return NextResponse.json({ error: "Only admins can delete video editing entries" }, { status: 403 });
  }

  try {
    const id = req.nextUrl.searchParams.get("id");

    const allowed = await verifyScopeAccess(result.scope, "content_video_editing", id!, "created_by");
    if (!allowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });

    const { error } = await supabaseAdmin
      .from("content_video_editing")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
