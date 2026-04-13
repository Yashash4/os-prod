import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { scopeQuery, verifyScopeAccess } from "@/lib/data-scope";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-kpis");
  if ("error" in result) return result.error;

  const employee_id = req.nextUrl.searchParams.get("employee_id");
  const review_period = req.nextUrl.searchParams.get("review_period");

  let query = supabaseAdmin
    .from("hr_kras")
    .select("*, employee:hr_employees(id, full_name)")
    .order("created_at", { ascending: false });

  if (employee_id) query = query.eq("employee_id", employee_id);
  if (review_period) query = query.eq("review_period", review_period);

  query = scopeQuery(query, result.scope, "employee_id", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ kras: data || [], _permissions: result.permissions });
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-kpis");
  if ("error" in result) return result.error;
  if (!result.permissions.canCreate) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

  const body = await req.json();
  const { employee_id, title, description, weightage, review_period } = body;

  if (!employee_id || !title || !review_period) {
    return NextResponse.json({ error: "employee_id, title, and review_period are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("hr_kras")
    .insert({
      employee_id,
      title,
      description: description || null,
      weightage: weightage || 0,
      review_period,
      status: "active",
      created_by: result.auth.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ kra: data });
}

export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-kpis");
  if ("error" in result) return result.error;
  if (!result.permissions.canEdit) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  const allowed = await verifyScopeAccess(result.scope, "hr_kras", id, "employee_id", true);
  if (!allowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("hr_kras")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("audit_logs").insert({
    user_id: result.auth.userId,
    tier: 2,
    action: "kra_updated",
    module: "hr",
    breadcrumb_path: "APEX OS > HR > KPIs & KRAs",
    entity_type: "hr_kra",
    entity_id: id,
    after_value: updates,
  });

  return NextResponse.json({ kra: data });
}

export async function DELETE(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-kpis");
  if ("error" in result) return result.error;
  if (!result.scope.scopeLevel.can_delete) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  const allowed = await verifyScopeAccess(result.scope, "hr_kras", id, "employee_id", true);
  if (!allowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });

  const { error } = await supabaseAdmin.from("hr_kras").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
