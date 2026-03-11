import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;

  try {
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", auth.auth.userId)
      .order("is_read", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      // Table may not exist yet — return empty instead of 500
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return NextResponse.json({ notifications: [], unread_count: 0 });
      }
      throw error;
    }

    const { count, error: countError } = await supabaseAdmin
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", auth.auth.userId)
      .eq("is_read", false);

    return NextResponse.json({
      notifications: data || [],
      unread_count: countError ? 0 : (count || 0),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to fetch notifications",
        notifications: [],
        unread_count: 0,
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();

    if (body.all === true) {
      const { error } = await supabaseAdmin
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", auth.auth.userId)
        .eq("is_read", false);

      if (error) throw error;
    } else if (Array.isArray(body.ids) && body.ids.length > 0) {
      const { error } = await supabaseAdmin
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", auth.auth.userId)
        .in("id", body.ids);

      if (error) throw error;
    } else {
      return NextResponse.json(
        { error: "Provide { ids: string[] } or { all: true }" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to update notifications",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { error } = await supabaseAdmin
      .from("notifications")
      .delete()
      .eq("user_id", auth.auth.userId)
      .eq("is_read", true)
      .lt("created_at", thirtyDaysAgo.toISOString());

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to clear old notifications",
      },
      { status: 500 }
    );
  }
}
