import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { scopeQuery, verifyScopeAccess } from "@/lib/data-scope";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "meta", "meta-campaign-tracker");
  if ("error" in result) return result.error;
  try {
    const campaignId = req.nextUrl.searchParams.get("campaign_id");
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");

    let query = supabaseAdmin
      .from("meta_campaign_tracker")
      .select("*")
      .order("log_date", { ascending: false });

    if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    }
    if (from) {
      query = query.gte("log_date", from);
    }
    if (to) {
      query = query.lte("log_date", to);
    }

    query = scopeQuery(query, result.scope, "decided_by");

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ entries: data || [], _permissions: result.permissions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch campaign tracker entries";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "meta", "meta-campaign-tracker");
  if ("error" in result) return result.error;

  if (!result.permissions.canCreate) {
    return NextResponse.json({ error: "You do not have permission to create campaign tracker entries" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { campaign_id, campaign_name, action } = body;

    if (!campaign_id || !campaign_name || !action) {
      return NextResponse.json({ error: "campaign_id, campaign_name, and action are required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("meta_campaign_tracker")
      .insert({ ...body, decided_by: result.auth.userId })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ entry: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create campaign tracker entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "meta", "meta-campaign-tracker");
  if ("error" in result) return result.error;

  if (!result.permissions.canEdit) {
    return NextResponse.json({ error: "You do not have permission to edit campaign tracker entries" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const allowed = await verifyScopeAccess(result.scope, "meta_campaign_tracker", id, "decided_by");
    if (!allowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from("meta_campaign_tracker")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ entry: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update campaign tracker entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "meta", "meta-campaign-tracker");
  if ("error" in result) return result.error;

  if (!result.scope.scopeLevel.can_delete) {
    return NextResponse.json({ error: "Only admins can delete campaign tracker entries" }, { status: 403 });
  }

  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const allowed = await verifyScopeAccess(result.scope, "meta_campaign_tracker", id, "decided_by");
    if (!allowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });

    const { error } = await supabaseAdmin
      .from("meta_campaign_tracker")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete campaign tracker entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
