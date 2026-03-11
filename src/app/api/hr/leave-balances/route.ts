import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    const result = await requireModuleAccess(req, "hr");
    if ("error" in result) return result.error;

    const employee_id = req.nextUrl.searchParams.get("employee_id");
    if (!employee_id) {
      return NextResponse.json(
        { error: "employee_id is required" },
        { status: 400 }
      );
    }

    const year = req.nextUrl.searchParams.get("year") || String(new Date().getFullYear());

    const { data: balances, error } = await supabaseAdmin
      .from("leave_balances")
      .select("id, employee_id, leave_type_id, year, total, used, leave_type:leave_types(id, name)")
      .eq("employee_id", employee_id)
      .eq("year", parseInt(year, 10));

    if (error) {
      console.error("leave_balances GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ balances: balances || [] });
  } catch (err) {
    console.error("leave_balances GET uncaught:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
