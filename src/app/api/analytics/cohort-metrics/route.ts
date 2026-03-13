import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSubModuleAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "analytics", "analytics-cohort");
  if ("error" in result) return result.error;
  const { permissions } = result;
  try {
    const { data, error } = await supabaseAdmin
      .from("cohort_daily_metrics")
      .select("*")
      .order("date", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ metrics: data || [], _permissions: permissions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch cohort metrics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
