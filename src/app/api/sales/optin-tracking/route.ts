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

    const { data, error } = await supabaseAdmin
      .from("sales_optin_tracking")
      .upsert(
        records.map((r: Record<string, unknown>) => ({
          opportunity_id: r.opportunity_id,
          contact_name: r.contact_name,
          contact_email: r.contact_email,
          contact_phone: r.contact_phone,
          pipeline_name: r.pipeline_name,
          stage_name: r.stage_name,
          source: r.source,
          monetary_value: r.monetary_value || 0,
          status: r.status || "new",
          notes: r.notes || null,
          assigned_to: r.assigned_to || null,
        })),
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
      .single();

    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update opt-in tracking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
