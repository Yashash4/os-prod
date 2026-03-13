import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { scopeQuery } from "@/lib/data-scope";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "seo", "seo-competitor-tracker");
  if ("error" in result) return result.error;

  try {
    let query = supabaseAdmin
      .from("seo_competitor_tracker")
      .select("*")
      .order("keyword", { ascending: true });

    const keyword = req.nextUrl.searchParams.get("keyword");
    const competitorDomain = req.nextUrl.searchParams.get("competitor_domain");

    if (keyword) query = query.eq("keyword", keyword);
    if (competitorDomain) query = query.eq("competitor_domain", competitorDomain);

    query = scopeQuery(query, result.scope, "created_by");

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ entries: data || [], _permissions: result.permissions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch competitor tracker";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "seo", "seo-competitor-tracker");
  if ("error" in result) return result.error;

  if (!result.permissions.canCreate) {
    return NextResponse.json({ error: "You do not have permission to create competitor tracker entries" }, { status: 403 });
  }

  try {
    const body = await req.json();

    if (!body.competitor_domain || !body.keyword) {
      return NextResponse.json(
        { error: "competitor_domain and keyword are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("seo_competitor_tracker")
      .insert({ ...body, created_by: result.auth.userId })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ entry: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create competitor tracker entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "seo", "seo-competitor-tracker");
  if ("error" in result) return result.error;

  if (!result.permissions.canEdit) {
    return NextResponse.json({ error: "You do not have permission to edit competitor tracker entries" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("seo_competitor_tracker")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ entry: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update competitor tracker entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "seo", "seo-competitor-tracker");
  if ("error" in result) return result.error;

  if (!result.scope.scopeLevel.can_delete) {
    return NextResponse.json({ error: "Only admins can delete competitor tracker entries" }, { status: 403 });
  }

  try {
    const id = req.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("seo_competitor_tracker")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete competitor tracker entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
