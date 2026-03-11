import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const result = await requireModuleAccess(req, "hr");
  if ("error" in result) return result.error;

  const { data, error } = await supabaseAdmin
    .from("hr_departments")
    .select("*")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get employee counts per department
  const { data: counts } = await supabaseAdmin
    .from("hr_employees")
    .select("department_id")
    .eq("status", "active");

  const countMap: Record<string, number> = {};
  (counts || []).forEach((e: { department_id: string | null }) => {
    if (e.department_id) countMap[e.department_id] = (countMap[e.department_id] || 0) + 1;
  });

  const departments = (data || []).map((d: Record<string, unknown>) => ({
    ...d,
    employee_count: countMap[d.id as string] || 0,
  }));

  return NextResponse.json({ departments });
}

export async function POST(req: NextRequest) {
  const result = await requireModuleAccess(req, "hr");
  if ("error" in result) return result.error;

  const body = await req.json();
  const { name, description } = body;

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("hr_departments")
    .insert({ name, description: description || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("audit_logs").insert({
    user_id: result.auth.userId,
    tier: 2,
    action: "department_created",
    module: "hr",
    breadcrumb: "APEX OS > HR > Departments",
    entity_type: "hr_department",
    entity_id: data.id,
    after_value: { name, description },
  });

  return NextResponse.json({ department: data });
}

export async function PUT(req: NextRequest) {
  const result = await requireModuleAccess(req, "hr");
  if ("error" in result) return result.error;

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("hr_departments")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ department: data });
}

export async function DELETE(req: NextRequest) {
  const result = await requireModuleAccess(req, "hr");
  if ("error" in result) return result.error;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("hr_departments")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("audit_logs").insert({
    user_id: result.auth.userId,
    tier: 2,
    action: "department_deleted",
    module: "hr",
    breadcrumb: "APEX OS > HR > Departments",
    entity_type: "hr_department",
    entity_id: id,
  });

  return NextResponse.json({ success: true });
}
