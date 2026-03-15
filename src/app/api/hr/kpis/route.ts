import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logImportant } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-kpis");
  if ("error" in result) return result.error;

  const department_id = req.nextUrl.searchParams.get("department_id");

  let query = supabaseAdmin
    .from("hr_kpis")
    .select("*, department:hr_departments(id, name), designation:hr_designations(id, title)")
    .eq("is_active", true)
    .order("name");

  if (department_id) query = query.eq("department_id", department_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ kpis: data || [], _permissions: result.permissions });
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-kpis");
  if ("error" in result) return result.error;
  if (!result.permissions.canCreate) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

  const body = await req.json();
  const { name, description, department_id, designation_id, unit, target_value, frequency } = body;

  if (!name || !unit) return NextResponse.json({ error: "name and unit are required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("hr_kpis")
    .insert({
      name,
      description: description || null,
      department_id: department_id || null,
      designation_id: designation_id || null,
      unit,
      target_value: target_value || 0,
      frequency: frequency || "monthly",
      is_active: true,
      created_by: result.auth.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logImportant(result.auth.userId, {
    action: "kpi.created",
    module: "hr",
    breadcrumb_path: "APEX OS > HR > KPIs",
    details: { entity_type: "hr_kpi", entity_id: data.id },
    after_value: { name, description, department_id, designation_id, unit, target_value, frequency },
  });

  return NextResponse.json({ kpi: data });
}

export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-kpis");
  if ("error" in result) return result.error;
  if (!result.permissions.canEdit) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  // Fetch before state for audit
  const { data: before } = await supabaseAdmin
    .from("hr_kpis")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabaseAdmin
    .from("hr_kpis")
    .update(updates)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logImportant(result.auth.userId, {
    action: "kpi.updated",
    module: "hr",
    breadcrumb_path: "APEX OS > HR > KPIs",
    details: { entity_type: "hr_kpi", entity_id: id },
    before_value: before as Record<string, unknown> || undefined,
    after_value: data as Record<string, unknown>,
  });

  return NextResponse.json({ kpi: data });
}

export async function DELETE(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-kpis");
  if ("error" in result) return result.error;
  if (!result.scope.scopeLevel.can_delete) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  // Fetch before state for audit snapshot
  const { data: before } = await supabaseAdmin
    .from("hr_kpis")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabaseAdmin
    .from("hr_kpis")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logImportant(result.auth.userId, {
    action: "kpi.deleted",
    module: "hr",
    breadcrumb_path: "APEX OS > HR > KPIs",
    details: { entity_type: "hr_kpi", entity_id: id },
    before_value: before as Record<string, unknown> || undefined,
    after_value: { is_active: false },
  });

  return NextResponse.json({ success: true });
}
