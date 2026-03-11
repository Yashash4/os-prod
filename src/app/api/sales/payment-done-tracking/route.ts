import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireModuleAccess(req, "sales");
  if ("error" in auth) return auth.error;

  try {
    const { data, error } = await supabaseAdmin
      .from("sales_payment_done_tracking")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) throw error;
    return NextResponse.json({ records: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch payment done tracking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireModuleAccess(req, "sales");
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const records = Array.isArray(body) ? body : [body];

    const oppIds = records.map((r: Record<string, unknown>) => r.opportunity_id as string);
    const { data: existing } = await supabaseAdmin
      .from("sales_payment_done_tracking")
      .select("opportunity_id, status, notes, last_contacted_at, call_scheduled_at")
      .in("opportunity_id", oppIds);

    const existingMap = new Map(
      (existing || []).map((r) => [r.opportunity_id, r])
    );

    const { data, error } = await supabaseAdmin
      .from("sales_payment_done_tracking")
      .upsert(
        records.map((r: Record<string, unknown>) => {
          const prev = existingMap.get(r.opportunity_id as string);
          return {
            opportunity_id: r.opportunity_id,
            contact_name: r.contact_name,
            contact_email: r.contact_email,
            contact_phone: r.contact_phone,
            pipeline_name: r.pipeline_name,
            stage_name: r.stage_name,
            source: r.source,
            status: prev?.status || (r.status as string) || "new",
            notes: prev?.notes ?? (r.notes as string) ?? null,
            last_contacted_at: prev?.last_contacted_at ?? null,
            call_scheduled_at: prev?.call_scheduled_at ?? null,
            assigned_to: r.assigned_to || null,
          };
        }),
        { onConflict: "opportunity_id" }
      )
      .select();

    if (error) throw error;
    return NextResponse.json({ records: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save payment done tracking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireModuleAccess(req, "sales");
  if ("error" in auth) return auth.error;

  try {
    const oppIds = req.nextUrl.searchParams.get("keep_ids");

    if (oppIds) {
      const keepSet = new Set(oppIds.split(",").map((id) => id.trim()).filter(Boolean));
      const { data: allRecords } = await supabaseAdmin
        .from("sales_payment_done_tracking")
        .select("opportunity_id");
      const toDelete = (allRecords || [])
        .map((r) => r.opportunity_id as string)
        .filter((id) => !keepSet.has(id));
      if (toDelete.length > 0) {
        const { error } = await supabaseAdmin
          .from("sales_payment_done_tracking")
          .delete()
          .in("opportunity_id", toDelete);
        if (error) throw error;
      }
    } else {
      const { error } = await supabaseAdmin
        .from("sales_payment_done_tracking")
        .delete()
        .neq("opportunity_id", "");
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete records";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireModuleAccess(req, "sales");
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { opportunity_id, ...updates } = body;

    if (!opportunity_id) {
      return NextResponse.json({ error: "opportunity_id is required" }, { status: 400 });
    }

    if (updates.status === "contacted") {
      updates.last_contacted_at = new Date().toISOString();
    }
    if (updates.status === "call_scheduled" && !updates.call_scheduled_at) {
      updates.call_scheduled_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from("sales_payment_done_tracking")
      .update(updates)
      .eq("opportunity_id", opportunity_id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }
    return NextResponse.json({ record: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update payment done tracking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
