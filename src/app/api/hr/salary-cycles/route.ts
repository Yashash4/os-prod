import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { scopeQuery } from "@/lib/data-scope";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-payroll");
  if ("error" in result) return result.error;

  const cycle_month = req.nextUrl.searchParams.get("cycle_month");

  let query = supabaseAdmin
    .from("hr_salary_cycles")
    .select("*, employee:hr_employees(id, full_name, department:hr_departments(id, name))")
    .order("created_at", { ascending: false });

  if (cycle_month) query = query.eq("cycle_month", cycle_month);

  query = scopeQuery(query, result.scope, "employee_id", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cycles: data || [], _permissions: result.permissions });
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-payroll");
  if ("error" in result) return result.error;
  if (!result.permissions.canCreate) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

  const body = await req.json();

  // Bulk generate for a month
  if (body.action === "generate") {
    const { cycle_month } = body;
    if (!cycle_month) return NextResponse.json({ error: "cycle_month required" }, { status: 400 });

    // Get all active employees with current salaries
    const { data: employees } = await supabaseAdmin
      .from("hr_employees")
      .select("id, full_name")
      .eq("status", "active");

    if (!employees?.length) return NextResponse.json({ cycles: [] });

    const rows = [];
    for (const emp of employees) {
      // Check if cycle already exists
      const { data: existing } = await supabaseAdmin
        .from("hr_salary_cycles")
        .select("id")
        .eq("employee_id", emp.id)
        .eq("cycle_month", cycle_month)
        .maybeSingle();

      if (existing) continue;

      // Get current salary
      const { data: salary } = await supabaseAdmin
        .from("hr_salaries")
        .select("base_salary")
        .eq("employee_id", emp.id)
        .is("effective_to", null)
        .maybeSingle();

      const base = salary?.base_salary || 0;

      rows.push({
        employee_id: emp.id,
        cycle_month,
        base_amount: base,
        commission_amount: 0,
        deductions: 0,
        net_amount: base,
        status: "pending",
        created_by: result.auth.userId,
      });
    }

    if (rows.length > 0) {
      const { error } = await supabaseAdmin.from("hr_salary_cycles").insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Re-fetch all cycles for the month
    const { data: allCycles } = await supabaseAdmin
      .from("hr_salary_cycles")
      .select("*, employee:hr_employees(id, full_name, department:hr_departments(id, name))")
      .eq("cycle_month", cycle_month);

    return NextResponse.json({ cycles: allCycles || [] });
  }

  // Single entry
  const { employee_id, cycle_month, base_amount, commission_amount, deductions, net_amount } = body;
  const { data, error } = await supabaseAdmin
    .from("hr_salary_cycles")
    .insert({
      employee_id,
      cycle_month,
      base_amount: base_amount || 0,
      commission_amount: commission_amount || 0,
      deductions: deductions || 0,
      net_amount: net_amount || 0,
      status: "pending",
      created_by: result.auth.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cycle: data });
}

export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-payroll");
  if ("error" in result) return result.error;
  if (!result.permissions.canEdit) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  // Recalculate net if amounts change
  if (updates.base_amount !== undefined || updates.commission_amount !== undefined || updates.deductions !== undefined) {
    const { data: current } = await supabaseAdmin
      .from("hr_salary_cycles")
      .select("base_amount, commission_amount, deductions")
      .eq("id", id)
      .single();

    if (current) {
      const base = updates.base_amount ?? current.base_amount;
      const comm = updates.commission_amount ?? current.commission_amount;
      const ded = updates.deductions ?? current.deductions;
      updates.net_amount = base + comm - ded;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("hr_salary_cycles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (updates.status === "paid") {
    await supabaseAdmin.from("audit_logs").insert({
      user_id: result.auth.userId,
      tier: 1,
      action: "salary_paid",
      module: "hr",
      breadcrumb: "APEX OS > HR > Payroll Tracker",
      entity_type: "hr_salary_cycle",
      entity_id: id,
      after_value: updates,
    });
  }

  return NextResponse.json({ cycle: data });
}
