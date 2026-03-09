import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  try {
    const campaignId = req.nextUrl.searchParams.get("campaign_id");

    let query = supabaseAdmin
      .from("meta_budget_plans")
      .select("*")
      .order("period_start", { ascending: false });

    if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ plans: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch budget plans";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const { campaign_id, campaign_name, period_start, period_end, planned_budget } = body;

    if (!campaign_id || !campaign_name || !period_start || !period_end || !planned_budget) {
      return NextResponse.json({ error: "campaign_id, campaign_name, period_start, period_end, and planned_budget are required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("meta_budget_plans")
      .insert({ ...body, created_by: auth.auth.userId })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ plan: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create budget plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("meta_budget_plans")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ plan: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update budget plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("meta_budget_plans")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete budget plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
