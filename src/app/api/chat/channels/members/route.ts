import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const result = await requireModuleAccess(req, "chat");
  if ("error" in result) return result.error;

  try {
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get("channel_id");

    if (!channelId) {
      return NextResponse.json({ error: "channel_id is required" }, { status: 400 });
    }

    const { data: rawMembers, error } = await supabaseAdmin
      .from("chat_members")
      .select("id, channel_id, user_id, last_read_at")
      .eq("channel_id", channelId);

    if (error) throw error;

    // Enrich with user info
    const userIds = (rawMembers || []).map((m) => m.user_id);
    let userMap: Record<string, { id: string; full_name: string | null; email: string }> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from("users")
        .select("id, full_name, email")
        .in("id", userIds);
      if (users) {
        userMap = Object.fromEntries(users.map((u) => [u.id, u]));
      }
    }
    const members = (rawMembers || []).map((m) => ({
      ...m,
      user: userMap[m.user_id] || null,
    }));

    return NextResponse.json({ members });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch members" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const result = await requireModuleAccess(req, "chat");
  if ("error" in result) return result.error;

  try {
    const body = await req.json();
    const { channel_id, user_ids } = body as {
      channel_id: string;
      user_ids: string[];
    };

    if (!channel_id || !user_ids || user_ids.length === 0) {
      return NextResponse.json(
        { error: "channel_id and user_ids are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("chat_members")
      .upsert(
        user_ids.map((uid) => ({ channel_id, user_id: uid })),
        { onConflict: "channel_id,user_id" }
      )
      .select("*");

    if (error) throw error;

    return NextResponse.json({ members: data || [] }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add members" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const result = await requireModuleAccess(req, "chat");
  if ("error" in result) return result.error;

  try {
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get("channel_id");
    const userId = searchParams.get("user_id");

    if (!channelId || !userId) {
      return NextResponse.json(
        { error: "channel_id and user_id are required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("chat_members")
      .delete()
      .eq("channel_id", channelId)
      .eq("user_id", userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to remove member" },
      { status: 500 }
    );
  }
}
