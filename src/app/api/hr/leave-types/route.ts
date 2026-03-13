import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logImportant } from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    const result = await requireSubModuleAccess(req, "hr", "hr-leaves");
    if ("error" in result) return result.error;

    const { data: leaveTypes, error } = await supabaseAdmin
      .from("leave_types")
      .select("id, name, days_per_year, is_active")
      .order("name");

    if (error) {
      console.error("leave_types GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ leave_types: leaveTypes || [], _permissions: result.permissions });
  } catch (err) {
    console.error("leave_types GET uncaught:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const result = await requireSubModuleAccess(req, "hr", "hr-leaves");
    if ("error" in result) return result.error;
    if (!result.permissions.canCreate) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

    const body = await req.json();
    const { name, days_per_year, is_active } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("leave_types")
      .insert({
        name,
        days_per_year: days_per_year ?? 0,
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error("leave_types POST error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logImportant(result.auth.userId, {
      action: "leave_type.created",
      module: "hr",
      breadcrumb_path: "APEX OS > HR > Leaves",
      details: { entity_type: "leave_type", entity_id: data.id },
      after_value: { name, days_per_year: days_per_year ?? 0, is_active: is_active ?? true },
    });

    return NextResponse.json({ leave_type: data });
  } catch (err) {
    console.error("leave_types POST uncaught:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
