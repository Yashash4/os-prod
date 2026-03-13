import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { scopeQuery } from "@/lib/data-scope";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-kpis");
  if ("error" in result) return result.error;

  const employee_id = req.nextUrl.searchParams.get("employee_id");
  const period = req.nextUrl.searchParams.get("period");

  let query = supabaseAdmin
    .from("hr_kpi_entries")
    .select("*, kpi:hr_kpis(id, name, unit, target_value, frequency), employee:hr_employees(id, full_name)")
    .order("period", { ascending: false });

  if (employee_id) query = query.eq("employee_id", employee_id);
  if (period) query = query.eq("period", period);

  query = scopeQuery(query, result.scope, "employee_id", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data || [], _permissions: result.permissions });
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-kpis");
  if ("error" in result) return result.error;
  if (!result.permissions.canCreate) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

  const body = await req.json();
  const { kpi_id, employee_id, period, actual_value, target_value, notes } = body;

  if (!kpi_id || !employee_id || !period) {
    return NextResponse.json({ error: "kpi_id, employee_id, and period are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("hr_kpi_entries")
    .upsert({
      kpi_id,
      employee_id,
      period,
      actual_value: actual_value || 0,
      target_value: target_value || 0,
      notes: notes || null,
      created_by: result.auth.userId,
    }, { onConflict: "kpi_id,employee_id,period" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("audit_logs").insert({
    user_id: result.auth.userId,
    tier: 2,
    action: "kpi_entry_logged",
    module: "hr",
    breadcrumb: "APEX OS > HR > KPIs",
    entity_type: "hr_kpi_entry",
    entity_id: data.id,
    after_value: { kpi_id, employee_id, period, actual_value },
  });

  return NextResponse.json({ entry: data });
}

export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-kpis");
  if ("error" in result) return result.error;
  if (!result.permissions.canEdit) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("hr_kpi_entries")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}
