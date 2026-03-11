import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const result = await requireModuleAccess(req, "hr");
  if ("error" in result) return result.error;

  const employee_id = req.nextUrl.searchParams.get("employee_id");

  let query = supabaseAdmin
    .from("hr_salaries")
    .select("*, employee:hr_employees(id, full_name)")
    .order("effective_from", { ascending: false });

  if (employee_id) query = query.eq("employee_id", employee_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ salaries: data || [] });
}

export async function POST(req: NextRequest) {
  const result = await requireModuleAccess(req, "hr");
  if ("error" in result) return result.error;

  const body = await req.json();
  const { employee_id, base_salary, effective_from, notes } = body;

  if (!employee_id || !base_salary || !effective_from) {
    return NextResponse.json({ error: "employee_id, base_salary, and effective_from are required" }, { status: 400 });
  }

  // Close previous active salary record
  await supabaseAdmin
    .from("hr_salaries")
    .update({ effective_to: effective_from })
    .eq("employee_id", employee_id)
    .is("effective_to", null);

  const { data, error } = await supabaseAdmin
    .from("hr_salaries")
    .insert({
      employee_id,
      base_salary: Math.round(base_salary),
      effective_from,
      notes: notes || null,
      created_by: result.auth.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("audit_logs").insert({
    user_id: result.auth.userId,
    tier: 1,
    action: "salary_updated",
    module: "hr",
    breadcrumb: "APEX OS > HR > Salary",
    entity_type: "hr_salary",
    entity_id: data.id,
    after_value: { employee_id, base_salary, effective_from },
  });

  return NextResponse.json({ salary: data });
}
