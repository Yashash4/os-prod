import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { scopeQuery } from "@/lib/data-scope";
import { sendNotification } from "@/lib/notify";

export async function GET(req: NextRequest) {
  try {
    const result = await requireSubModuleAccess(req, "hr", "hr-leaves");
    if ("error" in result) return result.error;

    const employee_id = req.nextUrl.searchParams.get("employee_id");
    const status = req.nextUrl.searchParams.get("status");
    const year = req.nextUrl.searchParams.get("year");

    let query = supabaseAdmin
      .from("leave_requests")
      .select(
        "id, employee_id, leave_type_id, start_date, end_date, days, reason, status, approved_by, created_at, leave_type:leave_types(id, name), employee:hr_employees(id, full_name, user_id)"
      )
      .order("created_at", { ascending: false });

    if (employee_id) query = query.eq("employee_id", employee_id);
    if (status) query = query.eq("status", status);
    query = scopeQuery(query, result.scope, "employee_id", true);
    if (year) {
      query = query
        .gte("start_date", `${year}-01-01`)
        .lte("start_date", `${year}-12-31`);
    }

    const { data: leaves, error } = await query;

    if (error) {
      console.error("leave_requests GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ leaves: leaves || [], _permissions: result.permissions });
  } catch (err) {
    console.error("leave_requests GET uncaught:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const result = await requireSubModuleAccess(req, "hr", "hr-leaves");
    if ("error" in result) return result.error;
    if (!result.permissions.canCreate) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

    const body = await req.json();
    const { employee_id, leave_type_id, start_date, end_date, days, reason } = body;

    if (!employee_id || !leave_type_id || !start_date || !end_date || !days) {
      return NextResponse.json(
        { error: "employee_id, leave_type_id, start_date, end_date, and days are required" },
        { status: 400 }
      );
    }

    // Validate employee exists
    const { data: employee, error: empError } = await supabaseAdmin
      .from("hr_employees")
      .select("id, full_name, reporting_to, user_id")
      .eq("id", employee_id)
      .single();

    if (empError || !employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from("leave_requests")
      .insert({
        employee_id,
        leave_type_id,
        start_date,
        end_date,
        days,
        reason: reason || null,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("leave_requests POST error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify manager if employee has a reporting_to
    if (employee.reporting_to) {
      const { data: manager } = await supabaseAdmin
        .from("hr_employees")
        .select("user_id")
        .eq("id", employee.reporting_to)
        .single();

      if (manager?.user_id) {
        await sendNotification(manager.user_id, {
          title: "Leave Request",
          body: `${employee.full_name} requested ${days} days leave`,
          type: "leave_requested",
          module: "hr",
          link: "/m/hr/leaves",
        });
      }
    }

    return NextResponse.json({ leave: data });
  } catch (err) {
    console.error("leave_requests POST uncaught:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const result = await requireSubModuleAccess(req, "hr", "hr-leaves");
    if ("error" in result) return result.error;
    if (!result.permissions.canApprove) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

    const body = await req.json();
    const { id, status, approved_by } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "id and status are required" },
        { status: 400 }
      );
    }

    if (!["approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "status must be 'approved' or 'rejected'" },
        { status: 400 }
      );
    }

    // Get the leave request first
    const { data: leaveReq, error: fetchErr } = await supabaseAdmin
      .from("leave_requests")
      .select("id, employee_id, leave_type_id, days, employee:hr_employees(id, full_name, user_id, reporting_to)")
      .eq("id", id)
      .single();

    if (fetchErr || !leaveReq) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    // Verify approver is the reporting manager (or admin)
    if (!result.auth.isAdmin) {
      const employee = Array.isArray(leaveReq.employee) ? leaveReq.employee[0] : leaveReq.employee;
      if (employee) {
        // Find the approver's employee record
        const { data: approverEmp } = await supabaseAdmin
          .from("hr_employees")
          .select("id")
          .eq("user_id", result.auth.userId)
          .maybeSingle();

        const reportingTo = (employee as Record<string, unknown>).reporting_to as string | null;
        if (!approverEmp || approverEmp.id !== reportingTo) {
          return NextResponse.json({ error: "Only the reporting manager or admin can approve/reject leaves" }, { status: 403 });
        }
      }
    }

    // Update the leave request
    const { data, error } = await supabaseAdmin
      .from("leave_requests")
      .update({ status, approved_by: approved_by || null })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("leave_requests PUT error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If approved, deduct from leave balance
    if (status === "approved") {
      const currentYear = new Date().getFullYear();
      const { data: balance } = await supabaseAdmin
        .from("leave_balances")
        .select("id, used")
        .eq("employee_id", leaveReq.employee_id)
        .eq("leave_type_id", leaveReq.leave_type_id)
        .eq("year", currentYear)
        .single();

      if (balance) {
        await supabaseAdmin
          .from("leave_balances")
          .update({ used: (balance.used || 0) + leaveReq.days })
          .eq("id", balance.id);
      }
    }

    // Notify employee about status change
    const empData = leaveReq.employee;
    const employee = (Array.isArray(empData) ? empData[0] : empData) as { id: string; full_name: string; user_id: string | null } | null;
    if (employee?.user_id) {
      const statusLabel = status === "approved" ? "approved" : "rejected";
      await sendNotification(employee.user_id, {
        title: `Leave ${statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)}`,
        body: `Your leave request has been ${statusLabel}`,
        type: `leave_${statusLabel}`,
        module: "hr",
        link: "/m/hr/leaves",
      });
    }

    return NextResponse.json({ leave: data });
  } catch (err) {
    console.error("leave_requests PUT uncaught:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
