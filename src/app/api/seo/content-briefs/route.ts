import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { scopeQuery, verifyScopeAccess } from "@/lib/data-scope";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "seo", "seo-content-briefs");
  if ("error" in result) return result.error;

  try {
    let query = supabaseAdmin
      .from("seo_content_briefs")
      .select("*")
      .order("created_at", { ascending: false });

    const status = req.nextUrl.searchParams.get("status");
    const assignedTo = req.nextUrl.searchParams.get("assigned_to");

    if (status) query = query.eq("status", status);
    if (assignedTo) query = query.eq("assigned_to", assignedTo);

    query = scopeQuery(query, result.scope, "created_by");

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ briefs: data || [], _permissions: result.permissions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch content briefs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "seo", "seo-content-briefs");
  if ("error" in result) return result.error;

  if (!result.permissions.canCreate) {
    return NextResponse.json({ error: "You do not have permission to create content briefs" }, { status: 403 });
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
      .from("seo_content_briefs")
      .insert({ ...body, created_by: result.auth.userId })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ brief: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create content brief";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "seo", "seo-content-briefs");
  if ("error" in result) return result.error;

  if (!result.permissions.canEdit) {
    return NextResponse.json({ error: "You do not have permission to edit content briefs" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const allowed = await verifyScopeAccess(result.scope, "seo_content_briefs", id, "created_by");
    if (!allowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from("seo_content_briefs")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ brief: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update content brief";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "seo", "seo-content-briefs");
  if ("error" in result) return result.error;

  if (!result.scope.scopeLevel.can_delete) {
    return NextResponse.json({ error: "Only admins can delete content briefs" }, { status: 403 });
  }

  try {
    const id = req.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const allowed = await verifyScopeAccess(result.scope, "seo_content_briefs", id, "created_by");
    if (!allowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });

    const { error } = await supabaseAdmin
      .from("seo_content_briefs")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete content brief";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
