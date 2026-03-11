import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

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
  return NextResponse.json({ kpis: data || [] });
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-kpis");
  if ("error" in result) return result.error;

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
  return NextResponse.json({ kpi: data });
}

export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-kpis");
  if ("error" in result) return result.error;

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("hr_kpis")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ kpi: data });
}

export async function DELETE(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-kpis");
  if ("error" in result) return result.error;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("hr_kpis")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
