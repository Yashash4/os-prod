import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
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

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ entries: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch creative tracker entries";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const { ad_id, ad_name } = body;

    if (!ad_id || !ad_name) {
      return NextResponse.json({ error: "ad_id and ad_name are required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("meta_creative_tracker")
      .insert({ ...body, reviewed_by: auth.auth.userId })
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
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
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
