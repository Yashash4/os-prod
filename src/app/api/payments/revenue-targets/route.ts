import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSubModuleAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireSubModuleAccess(req, "payments", "payments-dashboard");
  if ("error" in auth) return auth.error;
  try {
    const periodType = req.nextUrl.searchParams.get("period_type");

    let query = supabaseAdmin
      .from("revenue_targets")
      .select("*")
      .order("period_start", { ascending: false });

    if (periodType) {
      query = query.eq("period_type", periodType);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ targets: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch targets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSubModuleAccess(req, "payments", "payments-dashboard");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const { period_type, period_start, target_amount } = body;

    if (!period_type || !period_start || !target_amount) {
      return NextResponse.json({ error: "period_type, period_start, and target_amount are required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("revenue_targets")
      .upsert(
        { period_type, period_start, target_amount: Math.round(target_amount), created_by: auth.auth.userId },
        { onConflict: "period_type,period_start" }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ target: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save target";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireSubModuleAccess(req, "payments", "payments-dashboard");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("revenue_targets")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ target: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update target";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSubModuleAccess(req, "payments", "payments-dashboard");
  if ("error" in auth) return auth.error;
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("revenue_targets")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete target";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
