import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PUT(req: NextRequest) {
  const result = await requireModuleAccess(req, "chat");
  if ("error" in result) return result.error;

  const { userId } = result.auth;

  try {
    const body = await req.json();
    const { channel_id, last_read_message_id } = body as {
      channel_id: string;
      last_read_message_id: string;
    };

    if (!channel_id || !last_read_message_id) {
      return NextResponse.json(
        { error: "channel_id and last_read_message_id are required" },
        { status: 400 }
      );
    }

    // Verify the message exists
    const { data: message, error: msgErr } = await supabaseAdmin
      .from("chat_messages")
      .select("id, channel_id")
      .eq("id", last_read_message_id)
      .eq("channel_id", channel_id)
      .single();

    if (msgErr || !message) {
      return NextResponse.json({ error: "Message not found in this channel" }, { status: 404 });
    }

    const { data: cursor, error } = await supabaseAdmin
      .from("chat_read_cursors")
      .upsert(
        {
          user_id: userId,
          channel_id,
          last_read_message_id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,channel_id" }
      )
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ cursor });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update read cursor" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const result = await requireModuleAccess(req, "chat");
  if ("error" in result) return result.error;

  const { userId } = result.auth;

  try {
    // Get all channels the user is a member of
    const { data: memberships, error: memErr } = await supabaseAdmin
      .from("chat_channel_members")
      .select("channel_id")
      .eq("user_id", userId);

    if (memErr) throw memErr;

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ unread: [] });
    }

    const channelIds = memberships.map((m) => m.channel_id);

    // Get read cursors for all channels
    const { data: cursors, error: cursorErr } = await supabaseAdmin
      .from("chat_read_cursors")
      .select("channel_id, last_read_message_id")
      .eq("user_id", userId)
      .in("channel_id", channelIds);

    if (cursorErr) throw cursorErr;

    const cursorMap: Record<string, string> = {};
    for (const c of cursors || []) {
      cursorMap[c.channel_id] = c.last_read_message_id;
    }

    // For each channel, count messages after the cursor
    const unreadResults: { channel_id: string; unread_count: number }[] = [];

    for (const channelId of channelIds) {
      const lastReadMessageId = cursorMap[channelId];

      if (!lastReadMessageId) {
        // No cursor = count all messages in the channel
        const { count, error: countErr } = await supabaseAdmin
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("channel_id", channelId)
          .eq("is_deleted", false)
          .is("parent_id", null);

        if (countErr) throw countErr;

        unreadResults.push({ channel_id: channelId, unread_count: count || 0 });
      } else {
        // Get the created_at of the last read message to count messages after it
        const { data: lastReadMsg } = await supabaseAdmin
          .from("chat_messages")
          .select("created_at")
          .eq("id", lastReadMessageId)
          .single();

        if (!lastReadMsg) {
          // Cursor references a deleted/missing message, count all
          const { count, error: countErr } = await supabaseAdmin
            .from("chat_messages")
            .select("id", { count: "exact", head: true })
            .eq("channel_id", channelId)
            .eq("is_deleted", false)
            .is("parent_id", null);

          if (countErr) throw countErr;
          unreadResults.push({ channel_id: channelId, unread_count: count || 0 });
        } else {
          const { count, error: countErr } = await supabaseAdmin
            .from("chat_messages")
            .select("id", { count: "exact", head: true })
            .eq("channel_id", channelId)
            .eq("is_deleted", false)
            .is("parent_id", null)
            .gt("created_at", lastReadMsg.created_at);

          if (countErr) throw countErr;
          unreadResults.push({ channel_id: channelId, unread_count: count || 0 });
        }
      }
    }

    return NextResponse.json({ unread: unreadResults });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch unread counts" },
      { status: 500 }
    );
  }
}
