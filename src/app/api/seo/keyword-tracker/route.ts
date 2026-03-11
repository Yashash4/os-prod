import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSubModuleAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireSubModuleAccess(req, "seo", "seo-keyword-tracker");
  if ("error" in auth) return auth.error;

  try {
    let query = supabaseAdmin
      .from("seo_keyword_tracker")
      .select("*")
      .order("updated_at", { ascending: false });

    const status = req.nextUrl.searchParams.get("status");
    const priority = req.nextUrl.searchParams.get("priority");

    if (status) query = query.eq("status", status);
    if (priority) query = query.eq("priority", priority);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ entries: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch keyword tracker";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSubModuleAccess(req, "seo", "seo-keyword-tracker");
  if ("error" in auth) return auth.error;

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
      .insert({ ...body, created_by: auth.auth.userId })
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
  const auth = await requireSubModuleAccess(req, "seo", "seo-keyword-tracker");
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

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
  const auth = await requireSubModuleAccess(req, "seo", "seo-keyword-tracker");
  if ("error" in auth) return auth.error;

  try {
    const id = req.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

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
