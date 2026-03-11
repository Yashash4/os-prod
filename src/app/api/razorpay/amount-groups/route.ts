import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSubModuleAccess } from "@/lib/api-auth";

// GET: Fetch all saved amount groups
export async function GET(req: NextRequest) {
  const auth = await requireSubModuleAccess(req, "payments", "payments-analytics");
  if ("error" in auth) return auth.error;
  try {
    const { data, error } = await supabaseAdmin
      .from("payment_amount_groups")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ groups: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch groups";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Create a new amount group
export async function POST(req: NextRequest) {
  const auth = await requireSubModuleAccess(req, "payments", "payments-analytics");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const { name, min_amount, max_amount } = body;

    if (!name || (!min_amount && min_amount !== 0 && !max_amount && max_amount !== 0)) {
      return NextResponse.json(
        { error: "Name and at least one amount bound required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("payment_amount_groups")
      .insert({
        name,
        min_amount: min_amount != null ? Math.round(min_amount) : null,
        max_amount: max_amount != null ? Math.round(max_amount) : null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ group: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create group";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE: Remove a group by id
export async function DELETE(req: NextRequest) {
  const auth = await requireSubModuleAccess(req, "payments", "payments-analytics");
  if ("error" in auth) return auth.error;
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("payment_amount_groups")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete group";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
