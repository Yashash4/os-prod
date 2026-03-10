import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;

  try {
    const opportunityId = req.nextUrl.searchParams.get("opportunity_id");

    let query = supabaseAdmin
      .from("sent_invoices")
      .select("*")
      .order("sent_at", { ascending: false });

    if (opportunityId) query = query.eq("opportunity_id", opportunityId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ invoices: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sent invoices";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
