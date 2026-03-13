import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { scopeQuery } from "@/lib/data-scope";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "meta", "meta-creative-tracker");
  if ("error" in result) return result.error;
  try {
    const status = req.nextUrl.searchParams.get("status");
    const adId = req.nextUrl.searchParams.get("ad_id");

    let query = supabaseAdmin
      .from("meta_creative_tracker")
      .select("*")
      .order("updated_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }
    if (adId) {
      query = query.eq("ad_id", adId);
    }

    query = scopeQuery(query, result.scope, "reviewed_by");

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ entries: data || [], _permissions: result.permissions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch creative tracker entries";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "meta", "meta-creative-tracker");
  if ("error" in result) return result.error;

  if (!result.permissions.canCreate) {
    return NextResponse.json({ error: "You do not have permission to create creative tracker entries" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { ad_id, ad_name } = body;

    if (!ad_id || !ad_name) {
      return NextResponse.json({ error: "ad_id and ad_name are required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("meta_creative_tracker")
      .insert({ ...body, reviewed_by: result.auth.userId })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ entry: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create creative tracker entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "meta", "meta-creative-tracker");
  if ("error" in result) return result.error;

  if (!result.permissions.canEdit) {
    return NextResponse.json({ error: "You do not have permission to edit creative tracker entries" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("meta_creative_tracker")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ entry: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update creative tracker entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
