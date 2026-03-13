import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logImportant } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-designations");
  if ("error" in result) return result.error;

  const { data, error } = await supabaseAdmin
    .from("hr_designations")
    .select("*, department:hr_departments(id, name)")
    .order("title");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ designations: data || [], _permissions: result.permissions });
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-designations");
  if ("error" in result) return result.error;
  if (!result.permissions.canCreate) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

  const body = await req.json();
  const { title, level, department_id, role_id } = body;

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("hr_designations")
    .insert({ title, level: level || "mid", department_id: department_id || null, role_id: role_id || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logImportant(result.auth.userId, {
    action: "designation.created",
    module: "hr",
    breadcrumb_path: "APEX OS > HR > Designations",
    details: { entity_type: "hr_designation", entity_id: data.id },
    after_value: { title, level, department_id, role_id },
  });

  return NextResponse.json({ designation: data });
}

export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-designations");
  if ("error" in result) return result.error;
  if (!result.permissions.canEdit) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  // Fetch before state for audit
  const { data: before } = await supabaseAdmin
    .from("hr_designations")
    .select("*")
    .eq("id", id)
    .single();

  const { data, error } = await supabaseAdmin
    .from("hr_designations")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logImportant(result.auth.userId, {
    action: "designation.updated",
    module: "hr",
    breadcrumb_path: "APEX OS > HR > Designations",
    details: { entity_type: "hr_designation", entity_id: id },
    before_value: before as Record<string, unknown> || undefined,
    after_value: data as Record<string, unknown>,
  });

  return NextResponse.json({ designation: data });
}

export async function DELETE(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-designations");
  if ("error" in result) return result.error;
  if (!result.scope.scopeLevel.can_delete) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  // Fetch before deletion for audit snapshot
  const { data: before } = await supabaseAdmin
    .from("hr_designations")
    .select("*")
    .eq("id", id)
    .single();

  const { error } = await supabaseAdmin.from("hr_designations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logImportant(result.auth.userId, {
    action: "designation.deleted",
    module: "hr",
    breadcrumb_path: "APEX OS > HR > Designations",
    details: { entity_type: "hr_designation", entity_id: id },
    before_value: before as Record<string, unknown> || undefined,
  });

  return NextResponse.json({ success: true });
}
