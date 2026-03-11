import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "finance", "finance-expenses");
  if ("error" in result) return result.error;

  const { data, error } = await supabaseAdmin
    .from("expense_categories")
    .select("*")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get expense count per category
  const { data: counts } = await supabaseAdmin
    .from("expenses")
    .select("category_id");

  const countMap: Record<string, number> = {};
  (counts || []).forEach((e: { category_id: string | null }) => {
    if (e.category_id) countMap[e.category_id] = (countMap[e.category_id] || 0) + 1;
  });

  const categories = (data || []).map((c: Record<string, unknown>) => ({
    ...c,
    expense_count: countMap[c.id as string] || 0,
  }));

  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "finance", "finance-expenses");
  if ("error" in result) return result.error;

  const body = await req.json();
  const { name, icon } = body;

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("expense_categories")
    .insert({ name, icon: icon || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("audit_logs").insert({
    user_id: result.auth.userId,
    tier: 2,
    action: "expense_category_created",
    module: "finance",
    breadcrumb: "APEX OS > Finance > Categories",
    entity_type: "expense_category",
    entity_id: data.id,
    after_value: { name, icon },
  });

  return NextResponse.json({ category: data });
}

export async function DELETE(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "finance", "finance-expenses");
  if ("error" in result) return result.error;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("expense_categories")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("audit_logs").insert({
    user_id: result.auth.userId,
    tier: 2,
    action: "expense_category_deleted",
    module: "finance",
    breadcrumb: "APEX OS > Finance > Categories",
    entity_type: "expense_category",
    entity_id: id,
  });

  return NextResponse.json({ success: true });
}
