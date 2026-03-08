import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("sales_optin_tracking")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ records: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch opt-in tracking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const records = Array.isArray(body) ? body : [body];

    // Fetch existing records to preserve user-edited fields during sync
    const oppIds = records.map((r: Record<string, unknown>) => r.opportunity_id as string);
    const { data: existing } = await supabaseAdmin
      .from("sales_optin_tracking")
      .select("opportunity_id, status, notes, last_contacted_at")
      .in("opportunity_id", oppIds);

    const existingMap = new Map(
      (existing || []).map((r) => [r.opportunity_id, r])
    );

    const { data, error } = await supabaseAdmin
      .from("sales_optin_tracking")
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
            monetary_value: r.monetary_value || 0,
            // Preserve user-edited fields if record already exists
            status: prev?.status || (r.status as string) || "new",
            notes: prev?.notes ?? (r.notes as string) ?? null,
            last_contacted_at: prev?.last_contacted_at ?? null,
            assigned_to: r.assigned_to || null,
          };
        }),
        { onConflict: "opportunity_id" }
      )
      .select();

    if (error) throw error;
    return NextResponse.json({ records: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save opt-in tracking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const oppIds = req.nextUrl.searchParams.get("keep_ids");

    if (oppIds) {
      // Delete all records NOT in the provided list
      const keepList = oppIds.split(",");
      const { error } = await supabaseAdmin
        .from("sales_optin_tracking")
        .delete()
        .not("opportunity_id", "in", `(${keepList.map((id) => `"${id}"`).join(",")})`);
      if (error) throw error;
    } else {
      // Delete all records
      const { error } = await supabaseAdmin
        .from("sales_optin_tracking")
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
  try {
    const body = await req.json();
    const { opportunity_id, ...updates } = body;

    if (!opportunity_id) {
      return NextResponse.json({ error: "opportunity_id is required" }, { status: 400 });
    }

    // If status is changing, track when last contacted
    if (updates.status === "contacted") {
      updates.last_contacted_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from("sales_optin_tracking")
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
    const message = error instanceof Error ? error.message : "Failed to update opt-in tracking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
