import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const result = await requireModuleAccess(req, "chat");
  if ("error" in result) return result.error;

  const { userId } = result.auth;

  try {
    const { data: saved, error } = await supabaseAdmin
      .from("chat_saved")
      .select("id, message_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!saved || saved.length === 0) {
      return NextResponse.json({ saved: [] });
    }

    // Fetch associated messages
    const messageIds = saved.map((s) => s.message_id);
    const { data: messages } = await supabaseAdmin
      .from("chat_messages")
      .select("id, channel_id, user_id, body, attachment_url, created_at, is_deleted")
      .in("id", messageIds);

    const messageMap = Object.fromEntries((messages || []).map((m) => [m.id, m]));

    // Fetch user info for message authors
    const authorIds = [...new Set((messages || []).map((m) => m.user_id))];
    let userMap: Record<string, { id: string; full_name: string | null; email: string }> = {};
    if (authorIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from("users")
        .select("id, full_name, email")
        .in("id", authorIds);
      if (users) {
        userMap = Object.fromEntries(users.map((u) => [u.id, u]));
      }
    }

    // Fetch channel names for context
    const channelIds = [...new Set((messages || []).map((m) => m.channel_id))];
    let channelMap: Record<string, { id: string; name: string }> = {};
    if (channelIds.length > 0) {
      const { data: channels } = await supabaseAdmin
        .from("chat_channels")
        .select("id, name")
        .in("id", channelIds);
      if (channels) {
        channelMap = Object.fromEntries(channels.map((c) => [c.id, c]));
      }
    }

    const enrichedSaved = saved.map((s) => {
      const msg = messageMap[s.message_id];
      return {
        ...s,
        message: msg
          ? {
              ...msg,
              body: msg.is_deleted ? "[Message deleted]" : msg.body,
              user: userMap[msg.user_id] || null,
              channel: channelMap[msg.channel_id] || null,
            }
          : null,
      };
    });

    return NextResponse.json({ saved: enrichedSaved });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch saved messages" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const result = await requireModuleAccess(req, "chat");
  if ("error" in result) return result.error;

  const { userId } = result.auth;

  try {
    const body = await req.json();
    const { message_id } = body as { message_id: string };

    if (!message_id) {
      return NextResponse.json({ error: "message_id is required" }, { status: 400 });
    }

    // Verify the message exists
    const { data: message, error: msgErr } = await supabaseAdmin
      .from("chat_messages")
      .select("id")
      .eq("id", message_id)
      .single();

    if (msgErr || !message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Upsert - ignore if already saved
    const { data: saved, error: saveErr } = await supabaseAdmin
      .from("chat_saved")
      .upsert(
        { user_id: userId, message_id },
        { onConflict: "user_id,message_id" }
      )
      .select("*")
      .single();

    if (saveErr) throw saveErr;

    return NextResponse.json({ saved }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save message" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const result = await requireModuleAccess(req, "chat");
  if ("error" in result) return result.error;

  const { userId } = result.auth;

  try {
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("message_id");

    if (!messageId) {
      return NextResponse.json({ error: "message_id is required" }, { status: 400 });
    }

    const { error: deleteErr } = await supabaseAdmin
      .from("chat_saved")
      .delete()
      .eq("user_id", userId)
      .eq("message_id", messageId);

    if (deleteErr) throw deleteErr;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to unsave message" },
      { status: 500 }
    );
  }
}
