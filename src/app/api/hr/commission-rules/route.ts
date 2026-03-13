import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { scopeQuery } from "@/lib/data-scope";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-salary");
  if ("error" in result) return result.error;

  const employee_id = req.nextUrl.searchParams.get("employee_id");

  let query = supabaseAdmin
    .from("hr_commission_rules")
    .select("*, employee:hr_employees(id, full_name), designation:hr_designations(id, title)")
    .order("rule_name");

  if (employee_id) query = query.eq("employee_id", employee_id);

  query = scopeQuery(query, result.scope, "employee_id", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data || [], _permissions: result.permissions });
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-salary");
  if ("error" in result) return result.error;
  if (!result.permissions.canCreate) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

  const body = await req.json();
  const { employee_id, designation_id, rule_name, type, value, slab_config, metric } = body;

  if (!rule_name || !type || !metric) {
    return NextResponse.json({ error: "rule_name, type, and metric are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("hr_commission_rules")
    .insert({
      employee_id: employee_id || null,
      designation_id: designation_id || null,
      rule_name,
      type,
      value: value || null,
      slab_config: slab_config || null,
      metric,
      is_active: true,
      created_by: result.auth.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data });
}

export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-salary");
  if ("error" in result) return result.error;
  if (!result.permissions.canEdit) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("hr_commission_rules")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data });
}

export async function DELETE(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-salary");
  if ("error" in result) return result.error;
  if (!result.scope.scopeLevel.can_delete) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  const { error } = await supabaseAdmin.from("hr_commission_rules").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
