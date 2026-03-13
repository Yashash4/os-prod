import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyScopeAccess } from "@/lib/data-scope";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "finance", "finance-budgets");
  if ("error" in result) return result.error;

  const month = req.nextUrl.searchParams.get("month"); // YYYY-MM

  let query = supabaseAdmin
    .from("budgets")
    .select("*")
    .order("created_at", { ascending: false });

  if (month) {
    // month column is date type (e.g. 2026-03-01), filter by range for the given YYYY-MM
    const start = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    query = query.gte("month", start).lt("month", nextMonth);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ budgets: data || [], _permissions: result.permissions });
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "finance", "finance-budgets");
  if ("error" in result) return result.error;

  if (!result.permissions.canCreate) {
    return NextResponse.json({ error: "You do not have permission to create budgets" }, { status: 403 });
  }

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
  const result = await requireSubModuleAccess(req, "finance", "finance-budgets");
  if ("error" in result) return result.error;

  if (!result.permissions.canEdit) {
    return NextResponse.json({ error: "You do not have permission to edit budgets" }, { status: 403 });
  }

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  const allowed = await verifyScopeAccess(result.scope, "budgets", id, "created_by");
  if (!allowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("budgets")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ budget: data });
}

export async function DELETE(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "finance", "finance-budgets");
  if ("error" in result) return result.error;

  if (!result.scope.scopeLevel.can_delete) {
    return NextResponse.json({ error: "Only admins can delete budgets" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  const { error } = await supabaseAdmin.from("budgets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("audit_logs").insert({
    user_id: result.auth.userId,
    tier: 2,
    action: "budget_deleted",
    module: "finance",
    breadcrumb: "APEX OS > Finance > Budgets",
    entity_type: "finance_budget",
    entity_id: id,
  });

  return NextResponse.json({ success: true });
}
