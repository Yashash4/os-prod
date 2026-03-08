import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET: Fetch all jobin meet tracking records joined with call_booked_tracking
export async function GET() {
  try {
    const { data: callBooked, error: cbError } = await supabaseAdmin
      .from("sales_call_booked_tracking")
      .select("*")
      .order("created_at", { ascending: false });

    if (cbError) throw cbError;

    const { data: meetData, error: meetError } = await supabaseAdmin
      .from("jobin_meet_tracking")
      .select("*");

    if (meetError) throw meetError;

    const meetMap: Record<string, typeof meetData[0]> = {};
    (meetData || []).forEach((m) => {
      meetMap[m.opportunity_id] = m;
    });

    const merged = (callBooked || []).map((cb) => ({
      ...cb,
      meet_status: meetMap[cb.opportunity_id]?.meet_status || "pending",
      meet_notes: meetMap[cb.opportunity_id]?.meet_notes || null,
      meet_date: meetMap[cb.opportunity_id]?.meet_date || null,
      follow_up_date: meetMap[cb.opportunity_id]?.follow_up_date || null,
      outcome: meetMap[cb.opportunity_id]?.outcome || null,
    }));

    return NextResponse.json({ records: merged });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch meet management data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Upsert jobin meet tracking record
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const records = Array.isArray(body) ? body : [body];

    const { data, error } = await supabaseAdmin
      .from("jobin_meet_tracking")
      .upsert(
        records.map((r: Record<string, unknown>) => ({
          opportunity_id: r.opportunity_id,
          meet_status: r.meet_status || "pending",
          meet_notes: r.meet_notes || null,
          meet_date: r.meet_date || null,
          follow_up_date: r.follow_up_date || null,
          outcome: r.outcome || null,
        })),
        { onConflict: "opportunity_id" }
      )
      .select();

    if (error) throw error;
    return NextResponse.json({ records: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save meet tracking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT: Update a single jobin meet tracking record
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { opportunity_id, ...updates } = body;

    if (!opportunity_id) {
      return NextResponse.json({ error: "opportunity_id is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("jobin_meet_tracking")
      .upsert(
        { opportunity_id, ...updates },
        { onConflict: "opportunity_id" }
      )
      .select()
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update meet tracking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
