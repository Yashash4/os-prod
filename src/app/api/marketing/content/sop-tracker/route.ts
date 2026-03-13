import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { scopeQuery } from "@/lib/data-scope";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "content", "content-sop-tracker");
  if ("error" in result) return result.error;
  try {
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");

    let query = supabaseAdmin
      .from("content_sop_daily")
      .select("*")
      .order("sop_date", { ascending: true });

    if (from) query = query.gte("sop_date", from);
    if (to) query = query.lte("sop_date", to);

    query = scopeQuery(query, result.scope, "created_by");

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ records: data || [], _permissions: result.permissions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch SOP tracker";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "content", "content-sop-tracker");
  if ("error" in result) return result.error;

  if (!result.permissions.canCreate) {
    return NextResponse.json({ error: "You do not have permission to create SOP entries" }, { status: 403 });
  }

  const action = req.nextUrl.searchParams.get("action");

  // Sync month: auto-generate rows
  if (action === "sync") {
    try {
      const body = await req.json();
      const { month } = body;
      if (!month) return NextResponse.json({ error: "month is required" }, { status: 400 });

      const [year, mon] = month.split("-").map(Number);
      const lastDay = new Date(year, mon, 0).getDate();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const maxDay =
        year === today.getFullYear() && mon === today.getMonth() + 1
          ? Math.min(lastDay, today.getDate())
          : lastDay;

      const from = `${month}-01`;
      const to = `${month}-${String(maxDay).padStart(2, "0")}`;

      const { data: existing } = await supabaseAdmin
        .from("content_sop_daily")
        .select("sop_date")
        .gte("sop_date", from)
        .lte("sop_date", to);

      const existingDates = new Set(
        (existing || []).map((r: { sop_date: string }) => r.sop_date)
      );

      const missingDates: string[] = [];
      for (let d = 1; d <= maxDay; d++) {
        const dateStr = `${month}-${String(d).padStart(2, "0")}`;
        if (!existingDates.has(dateStr)) missingDates.push(dateStr);
      }

      if (missingDates.length === 0) {
        return NextResponse.json({ synced: 0, message: "All dates already exist" });
      }

      const rows = missingDates.map((dateStr) => ({
        sop_date: dateStr,
        created_by: result.auth.userId,
      }));

      const { data: inserted, error } = await supabaseAdmin
        .from("content_sop_daily")
        .insert(rows)
        .select();

      if (error) throw error;

      return NextResponse.json({
        synced: (inserted || []).length,
        message: `Created ${(inserted || []).length} rows`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sync month";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Regular create
  try {
    const body = await req.json();
    const { sop_date } = body;
    if (!sop_date) return NextResponse.json({ error: "sop_date is required" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("content_sop_daily")
      .insert({ sop_date, created_by: result.auth.userId })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "content", "content-sop-tracker");
  if ("error" in result) return result.error;

  if (!result.permissions.canEdit) {
    return NextResponse.json({ error: "You do not have permission to edit SOP entries" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("content_sop_daily")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "content", "content-sop-tracker");
  if ("error" in result) return result.error;

  if (!result.scope.scopeLevel.can_delete) {
    return NextResponse.json({ error: "Only admins can delete SOP entries" }, { status: 403 });
  }

  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("content_sop_daily")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
