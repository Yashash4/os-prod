import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const result = await requireModuleAccess(req, "finance");
  if ("error" in result) return result.error;

  const month = req.nextUrl.searchParams.get("month"); // YYYY-MM

  let query = supabaseAdmin
    .from("budgets")
    .select("*")
    .order("created_at", { ascending: false });

  if (month) query = query.eq("month", month);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ budgets: data || [] });
}

export async function POST(req: NextRequest) {
  const result = await requireModuleAccess(req, "finance");
  if ("error" in result) return result.error;

  const body = await req.json();
  const { name, department, month, planned_amount } = body;

  if (!name || !month || !planned_amount) {
    return NextResponse.json({ error: "Name, month, and planned_amount are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("budgets")
    .insert({
      name,
      department: department || null,
      month,
      planned_amount,
      created_by: result.auth.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("audit_logs").insert({
    user_id: result.auth.userId,
    tier: 2,
    action: "budget_created",
    module: "finance",
    breadcrumb: "APEX OS > Finance > Budgets",
    entity_type: "finance_budget",
    entity_id: data.id,
    after_value: { name, month, planned_amount },
  });

  return NextResponse.json({ budget: data });
}

export async function PUT(req: NextRequest) {
  const result = await requireModuleAccess(req, "finance");
  if ("error" in result) return result.error;

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("budgets")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ budget: data });
}
