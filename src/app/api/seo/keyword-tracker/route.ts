import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { scopeQuery, verifyScopeAccess } from "@/lib/data-scope";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "seo", "seo-keyword-tracker");
  if ("error" in result) return result.error;

  try {
    let query = supabaseAdmin
      .from("seo_keyword_tracker")
      .select("*")
      .order("updated_at", { ascending: false });

    const status = req.nextUrl.searchParams.get("status");
    const priority = req.nextUrl.searchParams.get("priority");

    if (status) query = query.eq("status", status);
    if (priority) query = query.eq("priority", priority);

    query = scopeQuery(query, result.scope, "created_by");

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ entries: data || [], _permissions: result.permissions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch keyword tracker";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "seo", "seo-keyword-tracker");
  if ("error" in result) return result.error;

  if (!result.permissions.canCreate) {
    return NextResponse.json({ error: "You do not have permission to create keyword tracker entries" }, { status: 403 });
  }

  try {
    const body = await req.json();

    if (!body.keyword || !body.target_position) {
      return NextResponse.json(
        { error: "keyword and target_position are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("seo_keyword_tracker")
      .insert({ ...body, created_by: result.auth.userId })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ entry: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create keyword tracker entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "seo", "seo-keyword-tracker");
  if ("error" in result) return result.error;

  if (!result.permissions.canEdit) {
    return NextResponse.json({ error: "You do not have permission to edit keyword tracker entries" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const allowed = await verifyScopeAccess(result.scope, "seo_keyword_tracker", id, "created_by");
    if (!allowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from("seo_keyword_tracker")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ entry: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update keyword tracker entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "seo", "seo-keyword-tracker");
  if ("error" in result) return result.error;

  if (!result.scope.scopeLevel.can_delete) {
    return NextResponse.json({ error: "Only admins can delete keyword tracker entries" }, { status: 403 });
  }

  try {
    const id = req.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const allowed = await verifyScopeAccess(result.scope, "seo_keyword_tracker", id, "created_by");
    if (!allowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });

    const { error } = await supabaseAdmin
      .from("seo_keyword_tracker")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete keyword tracker entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
