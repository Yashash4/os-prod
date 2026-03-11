import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "hr", "hr-dashboard");
  if ("error" in result) return result.error;

  const [
    { data: employees },
    { data: departments },
    { data: currentCycles },
  ] = await Promise.all([
    supabaseAdmin.from("hr_employees").select("id, full_name, status, department_id, employment_type, join_date"),
    supabaseAdmin.from("hr_departments").select("id, name").eq("is_active", true),
    supabaseAdmin.from("hr_salary_cycles").select("status, net_amount").eq("cycle_month", new Date().toISOString().slice(0, 7)),
  ]);

  const allEmps = employees || [];
  const active = allEmps.filter((e: { status: string }) => e.status === "active");

  // Dept breakdown
  const deptCounts: Record<string, { name: string; count: number }> = {};
  for (const d of departments || []) {
    deptCounts[d.id] = { name: d.name, count: 0 };
  }
  for (const e of active) {
    if (e.department_id && deptCounts[e.department_id]) {
      deptCounts[e.department_id].count++;
    }
  }

  // Employment type breakdown
  const typeCounts: Record<string, number> = {};
  for (const e of active) {
    typeCounts[e.employment_type] = (typeCounts[e.employment_type] || 0) + 1;
  }

  // Average tenure in months
  const now = Date.now();
  const tenures = active
    .filter((e: { join_date: string | null }) => e.join_date)
    .map((e: { join_date: string }) => Math.round((now - new Date(e.join_date).getTime()) / (1000 * 60 * 60 * 24 * 30)));
  const avgTenure = tenures.length > 0 ? Math.round(tenures.reduce((a: number, b: number) => a + b, 0) / tenures.length) : 0;

  // Recent hires (last 30 days)
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const recentHires = active
    .filter((e: { join_date: string | null }) => e.join_date && e.join_date >= thirtyDaysAgo)
    .map((e: { full_name: string; join_date: string }) => ({ name: e.full_name, join_date: e.join_date }));

  // Payroll summary
  const cycles = currentCycles || [];
  const payrollTotal = cycles.reduce((s: number, c: { net_amount: number }) => s + (c.net_amount || 0), 0);
  const payrollPaid = cycles.filter((c: { status: string }) => c.status === "paid").length;

  return NextResponse.json({
    stats: {
      total: allEmps.length,
      active: active.length,
      onLeave: allEmps.filter((e: { status: string }) => e.status === "on_leave").length,
      exited: allEmps.filter((e: { status: string }) => e.status === "exited").length,
      avgTenureMonths: avgTenure,
      payrollTotal,
      payrollPaid,
      payrollTotal_count: cycles.length,
    },
    deptBreakdown: Object.values(deptCounts).filter((d) => d.count > 0),
    typeBreakdown: typeCounts,
    recentHires,
  });
}
