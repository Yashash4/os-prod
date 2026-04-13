import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { getAccountInsightsByRange } from "@/lib/meta";

/**
 * Cohort Sync — Nightly cron + manual trigger endpoint
 *
 * Vercel Cron: GET /api/analytics/cohort-sync?secret=CRON_SECRET
 * Manual:      POST /api/analytics/cohort-sync (authenticated user)
 * Optionally pass ?date=YYYY-MM-DD to sync a specific date only.
 */

const ADS_START = "2026-03-01"; // Ads went live March 1st
const CAMPAIGN_END = "2026-05-16";

interface MetaInsight {
  date_start: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
}

interface MeetRecord {
  created_at?: string;
  meet_status?: string;
  outcome?: string;
}

function authorizeCron(req: NextRequest): boolean {
  const secret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
  return !!secret && secret === process.env.CRON_SECRET;
}

async function runSync(req: NextRequest) {

  try {
    const specificDate = req.nextUrl.searchParams.get("date");

    // ── 1. Fetch Meta Ads daily data (from ads start Mar 1) ──
    const today = new Date().toISOString().slice(0, 10);
    const untilDate = today <= CAMPAIGN_END ? today : CAMPAIGN_END;
    let metaDaily: MetaInsight[] = [];
    try {
      const since = specificDate || ADS_START;
      const until = specificDate || untilDate;
      const insights = await getAccountInsightsByRange(since, until, "1");
      metaDaily = (insights || []) as MetaInsight[];
    } catch (e) {
      console.error("Cohort sync: Meta fetch failed", e);
    }

    const metaMap: Record<string, MetaInsight> = {};
    for (const row of metaDaily) {
      metaMap[row.date_start] = row;
    }

    // ── 2. Fetch meetings data (Maverick + Jobin) ─────
    let meetRecords: MeetRecord[] = [];
    try {
      const [mavRes, jobRes] = await Promise.all([
        supabaseAdmin.from("sales_meetings").select("*"),
        supabaseAdmin.from("sales_meetings").select("*"),
      ]);
      meetRecords = [
        ...((mavRes.data || []) as MeetRecord[]),
        ...((jobRes.data || []) as MeetRecord[]),
      ];
    } catch (e) {
      console.error("Cohort sync: Meet data fetch failed", e);
    }

    // ── 3. Fetch call booked data (all meetings booked) ─
    let callBookedRecords: { created_at?: string }[] = [];
    try {
      const { data } = await supabaseAdmin
        .from("sales_opportunities")
        .select("created_at");
      callBookedRecords = (data || []) as { created_at?: string }[];
    } catch (e) {
      console.error("Cohort sync: Call booked fetch failed", e);
    }

    // ── 4. Fetch won deals (admissions = ghl_status='won') ──
    let wonDeals: { opportunity_id: string; created_at?: string; fees_collected?: number }[] = [];
    try {
      const { data: wonData } = await supabaseAdmin
        .from("sales_opportunities")
        .select("opportunity_id, created_at")
        .eq("ghl_status", "won");

      const [mavSales, jobSales] = await Promise.all([
        supabaseAdmin.from("sales_deals").select("opportunity_id, fees_collected"),
        supabaseAdmin.from("sales_deals").select("opportunity_id, fees_collected"),
      ]);
      const feesMap: Record<string, number> = {};
      for (const r of [...(mavSales.data || []), ...(jobSales.data || [])]) {
        feesMap[r.opportunity_id] = Math.max(feesMap[r.opportunity_id] || 0, r.fees_collected || 0);
      }

      wonDeals = (wonData || []).map((r) => ({
        opportunity_id: r.opportunity_id,
        created_at: r.created_at,
        fees_collected: feesMap[r.opportunity_id] || 0,
      }));
    } catch (e) {
      console.error("Cohort sync: Won deals fetch failed", e);
    }

    // ── 5. Fetch optins (from sales_optin_tracking) ──
    let optinRecords: { created_at?: string }[] = [];
    try {
      const { data } = await supabaseAdmin
        .from("sales_optins")
        .select("created_at");
      optinRecords = (data || []) as { created_at?: string }[];
    } catch (e) {
      console.error("Cohort sync: Optin fetch failed", e);
    }

    // ── 6. Fetch payments (from sales_payment_done_tracking) ──
    let paymentRecords: { created_at?: string }[] = [];
    try {
      const { data } = await supabaseAdmin
        .from("sales_payment_done")
        .select("created_at");
      paymentRecords = (data || []) as { created_at?: string }[];
    } catch (e) {
      console.error("Cohort sync: Payment fetch failed", e);
    }

    // ── 7. Aggregate by date ──────────────────────────
    const dates = specificDate ? [specificDate] : getDatesInRange(ADS_START, CAMPAIGN_END);

    const upsertRows = dates
      .filter((d) => d <= today)
      .map((date) => {
        const meta = metaMap[date];

        const optins = optinRecords.filter(
          (r) => r.created_at && r.created_at.slice(0, 10) === date
        ).length;

        const meetingsBooked = callBookedRecords.filter(
          (r) => r.created_at && r.created_at.slice(0, 10) === date
        ).length;

        const callsCompleted = meetRecords.filter(
          (r) =>
            r.created_at &&
            r.created_at.slice(0, 10) === date &&
            r.outcome &&
            r.outcome !== "pending"
        ).length;

        const showUps = meetRecords.filter(
          (r) =>
            r.created_at &&
            r.created_at.slice(0, 10) === date &&
            (r.meet_status === "attended" || r.meet_status === "completed")
        ).length;

        const admissionsOnDate = wonDeals.filter(
          (r) => r.created_at && r.created_at.slice(0, 10) === date
        );
        const admissions = admissionsOnDate.length;

        const revenueCollected = admissionsOnDate.reduce(
          (sum, r) => sum + (r.fees_collected || 0),
          0
        );

        const payments = paymentRecords.filter(
          (r) => r.created_at && r.created_at.slice(0, 10) === date
        ).length;

        return {
          date,
          ad_spend: meta ? parseFloat(meta.spend || "0") : 0,
          impressions: meta ? parseInt(meta.impressions || "0") : 0,
          clicks: meta ? parseInt(meta.clicks || "0") : 0,
          reach: meta ? parseInt(meta.reach || "0") : 0,
          optins,
          meetings_booked: meetingsBooked,
          calls_completed: callsCompleted,
          show_ups: showUps,
          admissions,
          revenue_collected: revenueCollected,
          payments,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

    // ── 8. Upsert into DB ─────────────────────────────
    if (upsertRows.length > 0) {
      const { error } = await supabaseAdmin
        .from("analytics_cohort_metrics")
        .upsert(upsertRows, { onConflict: "date" });

      if (error) throw error;
    }

    return NextResponse.json({
      success: true,
      synced: upsertRows.length,
      dates: upsertRows.map((r) => r.date),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === "object" && error !== null ? JSON.stringify(error) : "Cohort sync failed";
    console.error("Cohort sync error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Vercel Cron uses GET — requires CRON_SECRET
export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runSync(req);
}

// Manual trigger from UI uses POST — requires admin
export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "analytics", "analytics-cohort");
  if ("error" in result) return result.error;
  if (!result.auth.isAdmin) {
    return NextResponse.json({ error: "Only admins can trigger cohort sync" }, { status: 403 });
  }
  return runSync(req);
}

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  const endDate = new Date(end);
  while (current <= endDate) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}
