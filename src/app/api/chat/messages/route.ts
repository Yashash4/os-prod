import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendNotification } from "@/lib/notify";

interface ReactionAgg {
  emoji: string;
  count: number;
  user_ids: string[];
}

async function fetchReactionsForMessages(
  messageIds: string[]
): Promise<Record<string, ReactionAgg[]>> {
  if (messageIds.length === 0) return {};

  const { data: reactions } = await supabaseAdmin
    .from("chat_reactions")
    .select("id, message_id, user_id, emoji")
    .in("message_id", messageIds);

  if (!reactions || reactions.length === 0) return {};

  const grouped: Record<string, Record<string, string[]>> = {};
  for (const r of reactions) {
    if (!grouped[r.message_id]) grouped[r.message_id] = {};
    if (!grouped[r.message_id][r.emoji]) grouped[r.message_id][r.emoji] = [];
    grouped[r.message_id][r.emoji].push(r.user_id);
  }

  const result: Record<string, ReactionAgg[]> = {};
  for (const [msgId, emojiMap] of Object.entries(grouped)) {
    result[msgId] = Object.entries(emojiMap).map(([emoji, user_ids]) => ({
      emoji,
      count: user_ids.length,
      user_ids,
    }));
  }
  return result;
}

export async function GET(req: NextRequest) {
  const result = await requireModuleAccess(req, "chat");
  if ("error" in result) return result.error;

  const { userId } = result.auth;

  try {
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get("channel_id");
    const parentId = searchParams.get("parent_id");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const before = searchParams.get("before"); // cursor: created_at timestamp

    if (!channelId) {
      return NextResponse.json({ error: "channel_id is required" }, { status: 400 });
    }

    // Verify membership
    const { data: membership } = await supabaseAdmin
      .from("chat_members")
      .select("id")
      .eq("channel_id", channelId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this channel" }, { status: 403 });
    }

    // Fetch messages
    let query = supabaseAdmin
      .from("chat_messages")
      .select("id, channel_id, user_id, body, attachment_url, created_at, parent_id, reply_count, edited_at, is_deleted")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (parentId) {
      // Fetch thread replies for a specific parent message
      query = query.eq("parent_id", parentId);
    } else {
      // Fetch only top-level messages
      query = query.is("parent_id", null);
    }

    if (before) {
      query = query.lt("created_at", before);
    }

    const { data: rawMessages, error: msgErr } = await query;
    if (msgErr) throw msgErr;

    // Handle deleted messages: replace body with placeholder
    const processedMessages = (rawMessages || []).map((m: Record<string, unknown>) => {
      if (m.is_deleted) {
        return { ...m, body: "[Message deleted]" };
      }
      return m;
    });

    // Enrich with user info
    const userIds = [...new Set(processedMessages.map((m: Record<string, unknown>) => m.user_id as string))];
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

    // Fetch reactions for all messages
    const messageIds = processedMessages.map((m: Record<string, unknown>) => m.id as string);
    const reactionsMap = await fetchReactionsForMessages(messageIds);

    // Build thread previews for top-level messages with replies
    let threadPreviews: Record<string, { user_id: string; full_name: string | null }[]> = {};
    if (!parentId) {
      const messagesWithReplies = processedMessages.filter(
        (m: Record<string, unknown>) => (m.reply_count as number) > 0
      );

      if (messagesWithReplies.length > 0) {
        const parentIds = messagesWithReplies.map((m: Record<string, unknown>) => m.id as string);

        // For each parent, get 2 most recent reply authors
        // We fetch recent replies grouped by parent_id
        const { data: recentReplies } = await supabaseAdmin
          .from("chat_messages")
          .select("id, parent_id, user_id, created_at")
          .in("parent_id", parentIds)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false });

        if (recentReplies && recentReplies.length > 0) {
          // Group by parent_id and take 2 most recent unique users
          const replyUsersByParent: Record<string, string[]> = {};
          for (const reply of recentReplies) {
            const pid = reply.parent_id as string;
            if (!replyUsersByParent[pid]) replyUsersByParent[pid] = [];
            if (
              replyUsersByParent[pid].length < 2 &&
              !replyUsersByParent[pid].includes(reply.user_id)
            ) {
              replyUsersByParent[pid].push(reply.user_id);
            }
          }

          // Fetch user info for reply authors
          const allReplyUserIds = [...new Set(Object.values(replyUsersByParent).flat())];
          let replyUserMap: Record<string, { id: string; full_name: string | null }> = {};
          if (allReplyUserIds.length > 0) {
            const { data: replyUsers } = await supabaseAdmin
              .from("users")
              .select("id, full_name")
              .in("id", allReplyUserIds);
            if (replyUsers) {
              replyUserMap = Object.fromEntries(replyUsers.map((u) => [u.id, u]));
            }
          }

          for (const [pid, uids] of Object.entries(replyUsersByParent)) {
            threadPreviews[pid] = uids.map((uid) => ({
              user_id: uid,
              full_name: replyUserMap[uid]?.full_name || null,
            }));
          }
        }
      }
    }

    const messages = processedMessages.map((m: Record<string, unknown>) => ({
      ...m,
      user: userMap[m.user_id as string] || null,
      reactions: reactionsMap[m.id as string] || [],
      ...((!parentId && (m.reply_count as number) > 0)
        ? { thread_preview: threadPreviews[m.id as string] || [] }
        : {}),
    }));

    // Update last_read_at for the current user
    await supabaseAdmin
      .from("chat_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("channel_id", channelId)
      .eq("user_id", userId);

    return NextResponse.json({ messages: messages || [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch messages" },
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
    const { channel_id, body: messageBody, parent_id, mentions } = body as {
      channel_id: string;
      body: string;
      parent_id?: string;
      mentions?: string[];
    };

    if (!channel_id || !messageBody) {
      return NextResponse.json(
        { error: "channel_id and body are required" },
        { status: 400 }
      );
    }

    // Verify membership
    const { data: membership } = await supabaseAdmin
      .from("chat_members")
      .select("id")
      .eq("channel_id", channel_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this channel" }, { status: 403 });
    }

    // Insert message
    const insertData: Record<string, unknown> = {
      channel_id,
      user_id: userId,
      body: messageBody,
    };
    if (parent_id) {
      insertData.parent_id = parent_id;
    }

    const { data: message, error: msgErr } = await supabaseAdmin
      .from("chat_messages")
      .insert(insertData)
      .select("*")
      .single();

    if (msgErr) throw msgErr;

    // If this is a thread reply, increment reply_count on the parent
    if (parent_id) {
      const { data: parentMsg } = await supabaseAdmin
        .from("chat_messages")
        .select("id, user_id, reply_count")
        .eq("id", parent_id)
        .single();

      if (parentMsg) {
        await supabaseAdmin
          .from("chat_messages")
          .update({ reply_count: (parentMsg.reply_count || 0) + 1 })
          .eq("id", parent_id);

        // Notify parent message author if different from replier
        if (parentMsg.user_id !== userId) {
          const { data: sender } = await supabaseAdmin
            .from("users")
            .select("full_name")
            .eq("id", userId)
            .single();
          const senderName = sender?.full_name || "Someone";

          await sendNotification(parentMsg.user_id, {
            title: `${senderName} replied to your message`,
            body: messageBody.slice(0, 100),
            type: "chat_reply",
            module: "chat",
            link: "/m/chat",
          });
        }
      }
    }

    // Handle @mentions
    if (mentions && mentions.length > 0) {
      const { data: sender } = await supabaseAdmin
        .from("users")
        .select("full_name")
        .eq("id", userId)
        .single();
      const senderName = sender?.full_name || "Someone";

      const { data: channel } = await supabaseAdmin
        .from("chat_channels")
        .select("name")
        .eq("id", channel_id)
        .single();
      const channelName = channel?.name || "a channel";

      for (const mentionedUserId of mentions) {
        if (mentionedUserId !== userId) {
          await sendNotification(mentionedUserId, {
            title: `${senderName} mentioned you in #${channelName}`,
            body: messageBody.slice(0, 100),
            type: "chat_mention",
            module: "chat",
            link: "/m/chat",
          });
        }
      }
    }

    // Enrich the returned message with user info
    const { data: messageUser } = await supabaseAdmin
      .from("users")
      .select("id, full_name, email")
      .eq("id", userId)
      .single();

    const enrichedMessage = {
      ...message,
      user: messageUser || null,
      reactions: [],
    };

    // Update sender's last_read_at
    await supabaseAdmin
      .from("chat_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("channel_id", channel_id)
      .eq("user_id", userId);

    // For DM channels, send notification to the other member
    const { data: channelData } = await supabaseAdmin
      .from("chat_channels")
      .select("type")
      .eq("id", channel_id)
      .single();

    if (channelData?.type === "dm") {
      const { data: members } = await supabaseAdmin
        .from("chat_members")
        .select("user_id")
        .eq("channel_id", channel_id)
        .neq("user_id", userId);

      // Get sender name
      const senderName = messageUser?.full_name || "Someone";

      if (members) {
        for (const member of members) {
          await sendNotification(member.user_id, {
            title: `New message from ${senderName}`,
            body: messageBody.slice(0, 100),
            type: "chat_dm",
            module: "chat",
            link: "/m/chat",
          });
        }
      }
    }

    return NextResponse.json({ message: enrichedMessage }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send message" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const result = await requireModuleAccess(req, "chat");
  if ("error" in result) return result.error;

  const { userId } = result.auth;

  try {
    const body = await req.json();
    const { id, body: newBody } = body as { id: string; body: string };

    if (!id || !newBody) {
      return NextResponse.json(
        { error: "id and body are required" },
        { status: 400 }
      );
    }

    // Fetch the message to verify ownership
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("chat_messages")
      .select("id, user_id, is_deleted")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (existing.user_id !== userId) {
      return NextResponse.json({ error: "You can only edit your own messages" }, { status: 403 });
    }

    if (existing.is_deleted) {
      return NextResponse.json({ error: "Cannot edit a deleted message" }, { status: 400 });
    }

    // Update the message
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("chat_messages")
      .update({ body: newBody, edited_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (updateErr) throw updateErr;

    // Enrich with user info
    const { data: messageUser } = await supabaseAdmin
      .from("users")
      .select("id, full_name, email")
      .eq("id", userId)
      .single();

    return NextResponse.json({
      message: { ...updated, user: messageUser || null },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to edit message" },
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
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Fetch the message to verify ownership
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("chat_messages")
      .select("id, user_id, is_deleted")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (existing.user_id !== userId) {
      return NextResponse.json({ error: "You can only delete your own messages" }, { status: 403 });
    }

    if (existing.is_deleted) {
      return NextResponse.json({ error: "Message already deleted" }, { status: 400 });
    }

    // Soft delete
    const { error: updateErr } = await supabaseAdmin
      .from("chat_messages")
      .update({ is_deleted: true, body: "[Message deleted]" })
      .eq("id", id);

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete message" },
      { status: 500 }
    );
  }
}
