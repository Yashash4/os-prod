import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { scopeQuery } from "@/lib/data-scope";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "meta", "meta-conversion-log");
  if ("error" in result) return result.error;
  try {
    const date = req.nextUrl.searchParams.get("date");
    const campaignId = req.nextUrl.searchParams.get("campaign_id");
    const leadQuality = req.nextUrl.searchParams.get("lead_quality");

    let query = supabaseAdmin
      .from("meta_conversion_log")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (date) {
      query = query.eq("date", date);
    }
    if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    }
    if (leadQuality) {
      query = query.eq("lead_quality", leadQuality);
    }

    query = scopeQuery(query, result.scope, "created_by");

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ entries: data || [], _permissions: result.permissions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch conversion log entries";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "meta", "meta-conversion-log");
  if ("error" in result) return result.error;

  if (!result.permissions.canCreate) {
    return NextResponse.json({ error: "You do not have permission to create conversion log entries" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { lead_name } = body;

    if (!lead_name) {
      return NextResponse.json({ error: "lead_name is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("meta_conversion_log")
      .insert({ ...body, created_by: result.auth.userId })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ entry: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create conversion log entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "meta", "meta-conversion-log");
  if ("error" in result) return result.error;

  if (!result.permissions.canEdit) {
    return NextResponse.json({ error: "You do not have permission to edit conversion log entries" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("meta_conversion_log")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ entry: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update conversion log entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "meta", "meta-conversion-log");
  if ("error" in result) return result.error;

  if (!result.scope.scopeLevel.can_delete) {
    return NextResponse.json({ error: "Only admins can delete conversion log entries" }, { status: 403 });
  }

  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("meta_conversion_log")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete conversion log entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
