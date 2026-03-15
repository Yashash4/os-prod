import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";

// Temporary migration endpoint — DELETE after use
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { sql } = await req.json();
  if (!sql) return NextResponse.json({ error: "sql required" }, { status: 400 });

  try {
    const { data, error } = await supabaseAdmin.rpc("exec_sql", { query: sql });
    if (error) {
      // Try alternate approach if rpc doesn't exist
      return NextResponse.json({ error: error.message, hint: "Run in Supabase SQL Editor" }, { status: 500 });
    }
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
