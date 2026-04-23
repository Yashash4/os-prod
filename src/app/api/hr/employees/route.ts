import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { scopeQuery, verifyScopeAccess } from "@/lib/data-scope";

export async function GET(req: NextRequest) {
  try {
    const result = await requireSubModuleAccess(req, "hr", "hr-employees");
    if ("error" in result) return result.error;

    const department_id = req.nextUrl.searchParams.get("department_id");
    const status = req.nextUrl.searchParams.get("status");

    let query = supabaseAdmin
      .from("hr_employees")
      .select("*")
      .order("full_name");

    if (department_id) query = query.eq("department_id", department_id);
    if (status) query = query.eq("status", status);
    const isSalesRep = req.nextUrl.searchParams.get("is_sales_rep");
    if (isSalesRep === "true") query = query.eq("is_sales_rep", true);

    query = scopeQuery(query, result.scope, "id", true);

    const { data: employees, error } = await query;

    if (error) {
      console.error("hr_employees GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const empList = employees || [];

    if (empList.length === 0) {
      return NextResponse.json({ employees: [], _permissions: result.permissions });
    }

    const deptIds = [...new Set(empList.map((e: Record<string, unknown>) => e.department_id).filter(Boolean))] as string[];
    const desIds = [...new Set(empList.map((e: Record<string, unknown>) => e.designation_id).filter(Boolean))] as string[];

    const [deptResult, desResult] = await Promise.all([
      deptIds.length > 0
        ? supabaseAdmin.from("hr_departments").select("id, name").in("id", deptIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      desIds.length > 0
        ? supabaseAdmin.from("hr_designations").select("id, title, level").in("id", desIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ]);

    const depts = deptResult.data || [];
    const desigs = desResult.data || [];

    const deptMap = new Map(depts.map((d: Record<string, unknown>) => [d.id, d]));
    const desMap = new Map(desigs.map((d: Record<string, unknown>) => [d.id, d]));

    const enriched = empList.map((e: Record<string, unknown>) => ({
      ...e,
      department: e.department_id ? deptMap.get(e.department_id) || null : null,
      designation: e.designation_id ? desMap.get(e.designation_id) || null : null,
      manager: null,
    }));

    return NextResponse.json({ employees: enriched, _permissions: result.permissions });
  } catch (err) {
    console.error("hr_employees GET uncaught:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-employees");
  if ("error" in result) return result.error;
  if (!result.permissions.canCreate) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

  const body = await req.json();
  const { full_name, email, phone, department_id, designation_id, employment_type, join_date, reporting_to, user_id } = body;

  if (!full_name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  // Auto-create user account if email provided and no existing user_id
  let linkedUserId = user_id || null;
  let autoCreatedUser = false;

  if (email && !linkedUserId) {
    // Check if a user with this email already exists
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!existingUser) {
      try {
        // Create user with random password (account exists immediately)
        const randomPassword = `Apex${crypto.randomUUID().slice(0, 12)}!`;
        const { data: authData, error: authError } =
          await supabaseAdmin.auth.admin.createUser({
            email,
            password: randomPassword,
            email_confirm: true,
            user_metadata: { full_name },
          });

        if (!authError && authData.user) {
          // Send password reset email so user can set their own password
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
          await supabaseAdmin.auth.resetPasswordForEmail(email, {
            redirectTo: `${appUrl}/auth/reset-password`,
          });
          linkedUserId = authData.user.id;
          autoCreatedUser = true;

          // Get role_id from designation if mapped
          let roleId = null;
          if (designation_id) {
            const { data: desig, error: dError } = await supabaseAdmin
              .from("hr_designations")
              .select("role_id")
              .eq("id", designation_id)
              .maybeSingle();
            if (!dError && desig?.role_id) roleId = desig.role_id;
          }

          // Trigger already inserted into public.users — upsert to set role_id + full_name
          await supabaseAdmin.from("users").upsert({
            id: linkedUserId,
            email,
            full_name,
            role_id: roleId,
          }, { onConflict: "id" });

          await supabaseAdmin.from("audit_logs").insert({
            user_id: result.auth.userId,
            tier: 1,
            action: "user_invited",
            module: "hr",
            breadcrumb_path: "APEX OS > HR > Employees",
            entity_type: "user",
            entity_id: linkedUserId,
            after_value: { email, full_name, role_id: roleId, source: "hr_employee_creation" },
          });
        }
      } catch (err) {
        console.error("Invite user failed:", err);
      }
    } else {
      // Link to existing user if not already linked to another employee
      const { data: alreadyLinked } = await supabaseAdmin
        .from("hr_employees")
        .select("id")
        .eq("user_id", existingUser.id)
        .maybeSingle();
      if (!alreadyLinked) {
        linkedUserId = existingUser.id;
      }
    }
  }

  const { data, error } = await supabaseAdmin
    .from("hr_employees")
    .insert({
      full_name,
      email: email || null,
      phone: phone || null,
      department_id: department_id || null,
      designation_id: designation_id || null,
      employment_type: employment_type || "full_time",
      ...(join_date ? { join_date } : {}),
      reporting_to: reporting_to || null,
      user_id: linkedUserId,
      status: "active",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("audit_logs").insert({
    user_id: result.auth.userId,
    tier: 1,
    action: "employee_created",
    module: "hr",
    breadcrumb_path: "APEX OS > HR > Employees",
    entity_type: "hr_employee",
    entity_id: data.id,
    after_value: { full_name, email, department_id, designation_id, user_id: linkedUserId },
  });

  return NextResponse.json({
    employee: data,
    auto_created_user: autoCreatedUser,
  });
}

export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-employees");
  if ("error" in result) return result.error;
  if (!result.permissions.canEdit) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  // Scope-check: verify the target employee is within the user's data scope
  const allowed = await verifyScopeAccess(result.scope, "hr_employees", id, "id", true);
  if (!allowed) {
    return NextResponse.json({ error: "Not authorized to edit this employee" }, { status: 403 });
  }

  // Capture before state if user_id is being changed
  let beforeUserId: string | null = null;
  if ("user_id" in updates) {
    const { data: before } = await supabaseAdmin
      .from("hr_employees")
      .select("user_id")
      .eq("id", id)
      .maybeSingle();
    beforeUserId = before?.user_id || null;
  }

  const { data, error } = await supabaseAdmin
    .from("hr_employees")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit log user_id changes
  if ("user_id" in updates && updates.user_id !== beforeUserId) {
    await supabaseAdmin.from("audit_logs").insert({
      user_id: result.auth.userId,
      tier: 1,
      action: updates.user_id ? "employee_user_linked" : "employee_user_unlinked",
      module: "hr",
      breadcrumb_path: "APEX OS > HR > Employees",
      entity_type: "hr_employee",
      entity_id: id,
      before_value: { user_id: beforeUserId },
      after_value: { user_id: updates.user_id || null },
    });
  }

  return NextResponse.json({ employee: data });
}

export async function DELETE(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-employees");
  if ("error" in result) return result.error;
  if (!result.scope.scopeLevel.can_delete) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  const { error } = await supabaseAdmin.from("hr_employees").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("audit_logs").insert({
    user_id: result.auth.userId,
    tier: 1,
    action: "employee_deleted",
    module: "hr",
    breadcrumb_path: "APEX OS > HR > Employees",
    entity_type: "hr_employee",
    entity_id: id,
  });

  return NextResponse.json({ success: true });
}
