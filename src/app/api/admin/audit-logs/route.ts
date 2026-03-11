import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const userId = searchParams.get("user_id");
    const tier = searchParams.get("tier");
    const module = searchParams.get("module");
    const action = searchParams.get("action");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) query = query.eq("user_id", userId);
    if (tier) query = query.eq("tier", parseInt(tier));
    if (module) query = query.eq("module", module);
    if (action) query = query.ilike("action", `%${action}%`);
    if (from) query = query.gte("created_at", from);
    if (to) query = query.lte("created_at", to);

    const { data, count, error } = await query;
    if (error) throw error;

    // Batch-fetch user names for the log entries
    const userIds = [...new Set((data || []).map((l: { user_id: string }) => l.user_id).filter(Boolean))];
    let userMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from("users")
        .select("id, full_name, email")
        .in("id", userIds);
      if (users) {
        userMap = Object.fromEntries(
          users.map((u: { id: string; full_name: string | null; email: string }) => [u.id, u.full_name || u.email])
        );
      }
    }

    const logs = (data || []).map((log: { user_id: string } & Record<string, unknown>) => ({
      ...log,
      user_name: userMap[log.user_id] || null,
    }));

    return NextResponse.json({
      logs,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
