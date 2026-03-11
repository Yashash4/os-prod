import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireModuleAccess } from "@/lib/api-auth";
import { getAccountInsightsByRange } from "@/lib/meta";

export async function GET(req: NextRequest) {
  const auth = await requireModuleAccess(req, "analytics");
  if ("error" in auth) return auth.error;
  try {
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");

    let query = supabaseAdmin
      .from("analytics_daily_sheet")
      .select("*")
      .order("sheet_date", { ascending: false });

    if (from) query = query.gte("sheet_date", from);
    if (to) query = query.lte("sheet_date", to);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ records: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch daily sheet";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireModuleAccess(req, "analytics");
  if ("error" in auth) return auth.error;

  const action = req.nextUrl.searchParams.get("action");

  // ── Sync month: auto-generate rows with Meta spend ──
  if (action === "sync") {
    try {
      const body = await req.json();
      const { month } = body; // "2026-03"
      if (!month) return NextResponse.json({ error: "month is required" }, { status: 400 });

      const [year, mon] = month.split("-").map(Number);
      const lastDay = new Date(year, mon, 0).getDate();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Cap to today if current month
      const maxDay = (year === today.getFullYear() && mon === today.getMonth() + 1)
        ? Math.min(lastDay, today.getDate())
        : lastDay;

      const from = `${month}-01`;
      const to = `${month}-${String(maxDay).padStart(2, "0")}`;

      // Fetch existing rows for this month
      const { data: existing } = await supabaseAdmin
        .from("analytics_daily_sheet")
        .select("sheet_date")
        .gte("sheet_date", from)
        .lte("sheet_date", to);

      const existingDates = new Set((existing || []).map((r: { sheet_date: string }) => r.sheet_date));

      // Dates that need new rows
      const missingDates: string[] = [];
      for (let d = 1; d <= maxDay; d++) {
        const dateStr = `${month}-${String(d).padStart(2, "0")}`;
        if (!existingDates.has(dateStr)) missingDates.push(dateStr);
      }

      if (missingDates.length === 0) {
        return NextResponse.json({ synced: 0, message: "All dates already exist" });
      }

      // Fetch Meta spend for the range
      let spendByDate: Record<string, number> = {};
      try {
        const metaData = await getAccountInsightsByRange(from, to, "1");
        for (const d of metaData) {
          // Meta returns spend as string in the account currency (e.g. "123.45")
          // Convert to paise (×100)
          const spendRupees = parseFloat(d.spend || "0");
          spendByDate[d.date_start] = Math.round(spendRupees * 100);
        }
      } catch {
        // Meta API might fail — still create rows with 0 spend
      }

      // Insert missing rows
      const rows = missingDates.map((dateStr) => ({
        sheet_date: dateStr,
        meta_spend: spendByDate[dateStr] || 0,
        meetings_booked: 0,
        meetings_done: 0,
        showups: 0,
        converted: 0,
        amount_collected: 0,
        created_by: auth.auth.userId,
      }));

      const { data: inserted, error } = await supabaseAdmin
        .from("analytics_daily_sheet")
        .insert(rows)
        .select();

      if (error) throw error;

      // Also update meta_spend for existing rows that have 0 spend
      let updated = 0;
      if (Object.keys(spendByDate).length > 0) {
        for (const dateStr of Array.from(existingDates)) {
          if (spendByDate[dateStr] && spendByDate[dateStr] > 0) {
            // Only update if existing row has 0 meta_spend
            const { data: updatedRows } = await supabaseAdmin
              .from("analytics_daily_sheet")
              .update({ meta_spend: spendByDate[dateStr], updated_at: new Date().toISOString() })
              .eq("sheet_date", dateStr)
              .eq("meta_spend", 0)
              .select("id");
            if (updatedRows && updatedRows.length > 0) updated++;
          }
        }
      }

      return NextResponse.json({
        synced: (inserted || []).length,
        spend_updated: updated,
        message: `Created ${(inserted || []).length} rows, updated spend on ${updated} existing rows`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sync month";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ── Regular create ──
  try {
    const body = await req.json();
    const { sheet_date, meta_spend, meetings_booked, meetings_done, showups, converted, amount_collected, notes } = body;

    if (!sheet_date) {
      return NextResponse.json({ error: "sheet_date is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("analytics_daily_sheet")
      .insert({
        sheet_date,
        meta_spend: Math.round(meta_spend || 0),
        meetings_booked: meetings_booked || 0,
        meetings_done: meetings_done || 0,
        showups: showups || 0,
        converted: converted || 0,
        amount_collected: Math.round(amount_collected || 0),
        notes: notes || null,
        created_by: auth.auth.userId,
      })
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
  const auth = await requireModuleAccess(req, "analytics");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("analytics_daily_sheet")
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
  const auth = await requireModuleAccess(req, "analytics");
  if ("error" in auth) return auth.error;
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("analytics_daily_sheet")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
