import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    const platform = req.nextUrl.searchParams.get("platform");
    const contentType = req.nextUrl.searchParams.get("content_type");

    let query = supabaseAdmin
      .from("content_social")
      .select("*")
      .order("created_at", { ascending: false });

    if (platform) {
      query = query.eq("platform", platform);
    }

    if (contentType) {
      query = query.eq("content_type", contentType);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ records: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { data, error } = await supabaseAdmin
      .from("content_social")
      .insert(body)
      .select()
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ record: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    const { data, error } = await supabaseAdmin
      .from("content_social")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ record: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");

    const { error } = await supabaseAdmin
      .from("content_social")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
