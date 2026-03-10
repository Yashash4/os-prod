import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const result = await requireAdmin(req);
  if ("error" in result) return result.error;

  try {
    const [empRes, usersRes, desigRes, rolesRes] = await Promise.all([
      supabaseAdmin
        .from("hr_employees")
        .select("id, full_name, email, user_id, department_id, designation_id, status")
        .eq("status", "active")
        .order("full_name"),
      supabaseAdmin
        .from("users")
        .select("id, email, full_name, role_id")
        .order("full_name"),
      supabaseAdmin
        .from("hr_designations")
        .select("id, title, level, department_id, role_id, is_active")
        .eq("is_active", true)
        .order("title"),
      supabaseAdmin.from("roles").select("id, name, description").order("name"),
    ]);

    const employees = empRes.data || [];
    const users = usersRes.data || [];
    const linkedUserIds = new Set(
      employees
        .filter((e: Record<string, unknown>) => e.user_id)
        .map((e: Record<string, unknown>) => e.user_id)
    );

    return NextResponse.json({
      unlinked_employees: employees.filter(
        (e: Record<string, unknown>) => !e.user_id
      ),
      linked_employees: employees.filter(
        (e: Record<string, unknown>) => e.user_id
      ),
      unlinked_users: users.filter(
        (u: Record<string, unknown>) => !linkedUserIds.has(u.id as string)
      ),
      all_users: users,
      designations: desigRes.data || [],
      roles: rolesRes.data || [],
    });
  } catch (err) {
    console.error("hr/settings GET error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const result = await requireAdmin(req);
  if ("error" in result) return result.error;

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "link_user") {
      const { employee_id, user_id } = body;
      if (!employee_id || !user_id)
        return NextResponse.json(
          { error: "employee_id and user_id required" },
          { status: 400 }
        );

      // Check employee exists and has no user
      const { data: emp } = await supabaseAdmin
        .from("hr_employees")
        .select("id, user_id, full_name")
        .eq("id", employee_id)
        .single();
      if (!emp)
        return NextResponse.json(
          { error: "Employee not found" },
          { status: 404 }
        );
      if (emp.user_id)
        return NextResponse.json(
          { error: "Employee already linked to a user" },
          { status: 400 }
        );

      // Check user not already linked
      const { data: existing } = await supabaseAdmin
        .from("hr_employees")
        .select("id")
        .eq("user_id", user_id)
        .maybeSingle();
      if (existing)
        return NextResponse.json(
          { error: "User already linked to another employee" },
          { status: 400 }
        );

      const { error } = await supabaseAdmin
        .from("hr_employees")
        .update({ user_id, updated_at: new Date().toISOString() })
        .eq("id", employee_id);
      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });

      await supabaseAdmin.from("audit_logs").insert({
        user_id: result.auth.userId,
        tier: 1,
        action: "employee_user_linked",
        module: "hr",
        breadcrumb: "APEX OS > HR > Settings",
        entity_type: "hr_employee",
        entity_id: employee_id,
        after_value: { user_id },
      });

      return NextResponse.json({ success: true });
    }

    if (action === "unlink_user") {
      const { employee_id } = body;
      if (!employee_id)
        return NextResponse.json(
          { error: "employee_id required" },
          { status: 400 }
        );

      const { data: emp } = await supabaseAdmin
        .from("hr_employees")
        .select("id, user_id")
        .eq("id", employee_id)
        .single();
      if (!emp)
        return NextResponse.json(
          { error: "Employee not found" },
          { status: 404 }
        );

      const { error } = await supabaseAdmin
        .from("hr_employees")
        .update({ user_id: null, updated_at: new Date().toISOString() })
        .eq("id", employee_id);
      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });

      await supabaseAdmin.from("audit_logs").insert({
        user_id: result.auth.userId,
        tier: 1,
        action: "employee_user_unlinked",
        module: "hr",
        breadcrumb: "APEX OS > HR > Settings",
        entity_type: "hr_employee",
        entity_id: employee_id,
        before_value: { user_id: emp.user_id },
        after_value: { user_id: null },
      });

      return NextResponse.json({ success: true });
    }

    if (action === "map_designation_role") {
      const { designation_id, role_id } = body;
      if (!designation_id)
        return NextResponse.json(
          { error: "designation_id required" },
          { status: 400 }
        );

      const { data: before } = await supabaseAdmin
        .from("hr_designations")
        .select("role_id")
        .eq("id", designation_id)
        .single();

      const { error } = await supabaseAdmin
        .from("hr_designations")
        .update({ role_id: role_id || null })
        .eq("id", designation_id);
      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });

      await supabaseAdmin.from("audit_logs").insert({
        user_id: result.auth.userId,
        tier: 1,
        action: "designation_role_mapped",
        module: "hr",
        breadcrumb: "APEX OS > HR > Settings",
        entity_type: "hr_designation",
        entity_id: designation_id,
        before_value: { role_id: before?.role_id || null },
        after_value: { role_id: role_id || null },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("hr/settings PUT error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
