import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logImportant } from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    const result = await requireSubModuleAccess(req, "hr", "hr-holidays");
    if ("error" in result) return result.error;

    const { data: holidays, error } = await supabaseAdmin
      .from("holidays")
      .select("id, name, date, is_optional")
      .order("date");

    if (error) {
      console.error("holidays GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ holidays: holidays || [], _permissions: result.permissions });
  } catch (err) {
    console.error("holidays GET uncaught:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const result = await requireSubModuleAccess(req, "hr", "hr-holidays");
    if ("error" in result) return result.error;
    if (!result.permissions.canCreate) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

    const body = await req.json();
    const { name, date, is_optional } = body;

    if (!name || !date) {
      return NextResponse.json(
        { error: "name and date are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("holidays")
      .insert({
        name,
        date,
        is_optional: is_optional ?? false,
      })
      .select()
      .single();

    if (error) {
      console.error("holidays POST error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logImportant(result.auth.userId, {
      action: "holiday.created",
      module: "hr",
      breadcrumb_path: "APEX OS > HR > Holidays",
      details: { entity_type: "holiday", entity_id: data.id },
      after_value: { name, date, is_optional: is_optional ?? false },
    });

    return NextResponse.json({ holiday: data });
  } catch (err) {
    console.error("holidays POST uncaught:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const result = await requireSubModuleAccess(req, "hr", "hr-holidays");
    if ("error" in result) return result.error;
    if (!result.scope.scopeLevel.can_delete) return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Fetch before deletion for audit snapshot
    const { data: before } = await supabaseAdmin
      .from("holidays")
      .select("*")
      .eq("id", id)
      .single();

    const { error } = await supabaseAdmin
      .from("holidays")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("holidays DELETE error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logImportant(result.auth.userId, {
      action: "holiday.deleted",
      module: "hr",
      breadcrumb_path: "APEX OS > HR > Holidays",
      details: { entity_type: "holiday", entity_id: id },
      before_value: before as Record<string, unknown> || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("holidays DELETE uncaught:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
