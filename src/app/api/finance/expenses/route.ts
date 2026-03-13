import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { scopeQuery, verifyScopeAccess } from "@/lib/data-scope";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "finance", "finance-expenses");
  if ("error" in result) return result.error;

  const url = req.nextUrl;
  const categoryId = url.searchParams.get("category_id");
  const month = url.searchParams.get("month"); // YYYY-MM
  const status = url.searchParams.get("status");

  let query = supabaseAdmin
    .from("expenses")
    .select("*, category:expense_categories(id, name, icon)")
    .order("date", { ascending: false });

  if (categoryId) query = query.eq("category_id", categoryId);
  if (status) query = query.eq("status", status);
  if (month) {
    const start = `${month}-01`;
    const endDate = new Date(parseInt(month.split("-")[0]), parseInt(month.split("-")[1]), 0);
    const end = `${month}-${String(endDate.getDate()).padStart(2, "0")}`;
    query = query.gte("date", start).lte("date", end);
  }

  query = scopeQuery(query, result.scope, "created_by");

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data || [], _permissions: result.permissions });
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "finance", "finance-expenses");
  if ("error" in result) return result.error;

  if (!result.permissions.canCreate) {
    return NextResponse.json({ error: "You do not have permission to create expenses" }, { status: 403 });
  }

  const body = await req.json();
  const {
    category_id,
    title,
    amount,
    date,
    paid_by,
    receipt_url,
    notes,
    is_recurring,
    recurring_interval,
    status,
  } = body;

  if (!title || !amount) {
    return NextResponse.json({ error: "Title and amount are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("expenses")
    .insert({
      category_id: category_id || null,
      title,
      amount,
      date: date || new Date().toISOString().split("T")[0],
      paid_by: paid_by || null,
      receipt_url: receipt_url || null,
      notes: notes || null,
      is_recurring: is_recurring || false,
      recurring_interval: recurring_interval || null,
      status: status || "pending",
      created_by: result.auth.userId,
    })
    .select("*, category:expense_categories(id, name, icon)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("audit_logs").insert({
    user_id: result.auth.userId,
    tier: 2,
    action: "expense_created",
    module: "finance",
    breadcrumb: "APEX OS > Finance > Expenses",
    entity_type: "expense",
    entity_id: data.id,
    after_value: { title, amount },
  });

  return NextResponse.json({ record: data });
}

export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "finance", "finance-expenses");
  if ("error" in result) return result.error;

  if (!result.permissions.canEdit) {
    return NextResponse.json({ error: "You do not have permission to edit expenses" }, { status: 403 });
  }

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  const allowed = await verifyScopeAccess(result.scope, "expenses", id, "created_by");
  if (!allowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("expenses")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*, category:expense_categories(id, name, icon)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ record: data });
}

export async function DELETE(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "finance", "finance-expenses");
  if ("error" in result) return result.error;

  if (!result.scope.scopeLevel.can_delete) {
    return NextResponse.json({ error: "Only admins can delete expenses" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  const allowed = await verifyScopeAccess(result.scope, "expenses", id, "created_by");
  if (!allowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });

  const { error } = await supabaseAdmin.from("expenses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("audit_logs").insert({
    user_id: result.auth.userId,
    tier: 2,
    action: "expense_deleted",
    module: "finance",
    breadcrumb: "APEX OS > Finance > Expenses",
    entity_type: "expense",
    entity_id: id,
  });

  return NextResponse.json({ success: true });
}
