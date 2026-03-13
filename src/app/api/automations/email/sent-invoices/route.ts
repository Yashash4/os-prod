import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { scopeQuery } from "@/lib/data-scope";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "automations", "automations-email");
  if ("error" in result) return result.error;
  const { scope, permissions } = result;

  try {
    const opportunityId = req.nextUrl.searchParams.get("opportunity_id");

    let query = supabaseAdmin
      .from("sent_invoices")
      .select("*")
      .order("sent_at", { ascending: false });

    // Scope on sent_by (created_by equivalent)
    query = scopeQuery(query, scope, "sent_by");

    if (opportunityId) query = query.eq("opportunity_id", opportunityId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ invoices: data || [], _permissions: permissions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sent invoices";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
