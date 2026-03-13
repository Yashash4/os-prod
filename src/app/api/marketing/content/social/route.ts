import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { scopeQuery, verifyScopeAccess } from "@/lib/data-scope";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "content", "content-social");
  if ("error" in result) return result.error;
  try {
    const platform = req.nextUrl.searchParams.get("platform");
    const contentType = req.nextUrl.searchParams.get("content_type");

    let query = supabaseAdmin
      .from("content_social")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (platform) {
      query = query.eq("platform", platform);
    }

    if (contentType) {
      query = query.eq("content_type", contentType);
    }

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
  const result = await requireSubModuleAccess(req, "content", "content-social");
  if ("error" in result) return result.error;

  if (!result.permissions.canCreate) {
    return NextResponse.json({ error: "You do not have permission to create social content" }, { status: 403 });
  }

  try {
    const body = await req.json();

    const { data, error } = await supabaseAdmin
      .from("content_social")
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
  const result = await requireSubModuleAccess(req, "content", "content-social");
  if ("error" in result) return result.error;

  if (!result.permissions.canEdit) {
    return NextResponse.json({ error: "You do not have permission to edit social content" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    const allowed = await verifyScopeAccess(result.scope, "content_social", id, "created_by");
    if (!allowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from("content_social")
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
  const result = await requireSubModuleAccess(req, "content", "content-social");
  if ("error" in result) return result.error;

  if (!result.scope.scopeLevel.can_delete) {
    return NextResponse.json({ error: "Only admins can delete social content" }, { status: 403 });
  }

  try {
    const id = req.nextUrl.searchParams.get("id");

    const allowed = await verifyScopeAccess(result.scope, "content_social", id!, "created_by");
    if (!allowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });

    const { error } = await supabaseAdmin
      .from("content_social")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
