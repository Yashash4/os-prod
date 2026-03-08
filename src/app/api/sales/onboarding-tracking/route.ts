import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const DEFAULT_CHECKLIST = [
  { id: "intro", label: "Introduction call completed", done: false },
  { id: "brand_brief", label: "Brand brief collected", done: false },
  { id: "goals", label: "Goals & expectations documented", done: false },
  { id: "assets", label: "Brand assets received (logo, photos, etc.)", done: false },
  { id: "social_access", label: "Social media access granted", done: false },
  { id: "strategy", label: "Strategy presentation delivered", done: false },
  { id: "onboarded", label: "Fully onboarded & active", done: false },
];

// GET: Auto-sync onboarding with won deals, then return merged records
export async function GET() {
  try {
    // 1. Fetch all won deals from call_booked_tracking
    const { data: wonDeals, error: wonErr } = await supabaseAdmin
      .from("sales_call_booked_tracking")
      .select("*")
      .eq("ghl_status", "won")
      .order("created_at", { ascending: false });

    if (wonErr) throw wonErr;

    const wonList = wonDeals || [];
    const wonIds = wonList.map((d) => d.opportunity_id);

    // 2. Fetch existing onboarding records
    const { data: onboardingData, error: obErr } = await supabaseAdmin
      .from("onboarding_tracking")
      .select("*");

    if (obErr) throw obErr;

    const existingMap: Record<string, (typeof onboardingData)[0]> = {};
    (onboardingData || []).forEach((r) => {
      existingMap[r.opportunity_id] = r;
    });

    // 3. Auto-create onboarding records for new won deals
    const newRecords = wonList
      .filter((d) => !existingMap[d.opportunity_id])
      .map((d) => ({
        opportunity_id: d.opportunity_id,
        contact_name: d.contact_name,
        contact_email: d.contact_email,
        contact_phone: d.contact_phone,
        source_rep: d.assigned_to || null,
        fees_quoted: 0,
        fees_collected: 0,
        onboarding_status: "scheduled",
        checklist: DEFAULT_CHECKLIST,
      }));

    if (newRecords.length > 0) {
      const { error: insertErr } = await supabaseAdmin
        .from("onboarding_tracking")
        .upsert(newRecords, { onConflict: "opportunity_id" });
      if (insertErr) console.error("Auto-insert error:", insertErr);
    }

    // 4. Remove onboarding records for deals no longer won
    const staleIds = (onboardingData || [])
      .map((r) => r.opportunity_id)
      .filter((id) => !wonIds.includes(id));

    if (staleIds.length > 0) {
      const { error: delErr } = await supabaseAdmin
        .from("onboarding_tracking")
        .delete()
        .in("opportunity_id", staleIds);
      if (delErr) console.error("Auto-delete error:", delErr);
    }

    // 5. Re-fetch the final merged state
    const { data: finalData, error: finalErr } = await supabaseAdmin
      .from("onboarding_tracking")
      .select("*")
      .order("created_at", { ascending: false });

    if (finalErr) throw finalErr;

    // 6. Fetch fees from sales tracking tables (source of truth)
    const oppIds = (finalData || []).map((r) => r.opportunity_id);

    const [{ data: mavSales }, { data: jobSales }] = await Promise.all([
      supabaseAdmin.from("maverick_sales_tracking").select("opportunity_id, fees_quoted, fees_collected").in("opportunity_id", oppIds.length > 0 ? oppIds : [""]),
      supabaseAdmin.from("jobin_sales_tracking").select("opportunity_id, fees_quoted, fees_collected").in("opportunity_id", oppIds.length > 0 ? oppIds : [""]),
    ]);

    const feesMap: Record<string, { fees_quoted: number; fees_collected: number }> = {};
    [...(mavSales || []), ...(jobSales || [])].forEach((s) => {
      feesMap[s.opportunity_id] = { fees_quoted: s.fees_quoted || 0, fees_collected: s.fees_collected || 0 };
    });

    // 7. Merge with call_booked data for contact info freshness
    const wonMap: Record<string, (typeof wonList)[0]> = {};
    wonList.forEach((d) => { wonMap[d.opportunity_id] = d; });

    const merged = (finalData || []).map((ob) => {
      const won = wonMap[ob.opportunity_id];
      const fees = feesMap[ob.opportunity_id];
      return {
        ...ob,
        // Keep contact info fresh from call_booked
        contact_name: won?.contact_name || ob.contact_name,
        contact_email: won?.contact_email || ob.contact_email,
        contact_phone: won?.contact_phone || ob.contact_phone,
        // Pass through assigned_to for client-side name resolution
        assigned_to: won?.assigned_to || ob.source_rep,
        pipeline_name: won?.pipeline_name || null,
        source: won?.source || null,
        // Fees from sales management (read-only in onboarding)
        fees_quoted: fees?.fees_quoted || 0,
        fees_collected: fees?.fees_collected || 0,
      };
    });

    return NextResponse.json({ records: merged });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch onboarding data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT: Update an onboarding record
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { opportunity_id, ...updates } = body;

    if (!opportunity_id) {
      return NextResponse.json({ error: "opportunity_id is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("onboarding_tracking")
      .upsert(
        { opportunity_id, ...updates },
        { onConflict: "opportunity_id" }
      )
      .select()
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update onboarding record";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
