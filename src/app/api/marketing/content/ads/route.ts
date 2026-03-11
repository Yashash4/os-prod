import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireModuleAccess(req, "content");
  if ("error" in auth) return auth.error;
  try {
    const type = req.nextUrl.searchParams.get("type");

    let query = supabaseAdmin
      .from("content_ads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (type) {
      query = query.eq("type", type);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ records: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireModuleAccess(req, "content");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();

    const { data, error } = await supabaseAdmin
      .from("content_ads")
      .insert(body)
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
  const auth = await requireModuleAccess(req, "content");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    const { data, error } = await supabaseAdmin
      .from("content_ads")
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
  const auth = await requireModuleAccess(req, "content");
  if ("error" in auth) return auth.error;
  try {
    const id = req.nextUrl.searchParams.get("id");

    const { error } = await supabaseAdmin
      .from("content_ads")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
