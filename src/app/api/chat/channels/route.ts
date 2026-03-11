import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const result = await requireModuleAccess(req, "chat");
  if ("error" in result) return result.error;

  const { userId } = result.auth;

  try {
    // Get channels the user is a member of
    const { data: memberships, error: memErr } = await supabaseAdmin
      .from("chat_members")
      .select("channel_id, last_read_at")
      .eq("user_id", userId);

    if (memErr) throw memErr;
    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ channels: [] });
    }

    const channelIds = memberships.map((m) => m.channel_id);
    const lastReadMap: Record<string, string | null> = {};
    for (const m of memberships) {
      lastReadMap[m.channel_id] = m.last_read_at;
    }

    // Fetch channel details
    const { data: channels, error: chErr } = await supabaseAdmin
      .from("chat_channels")
      .select("*")
      .in("id", channelIds)
      .order("created_at", { ascending: false });

    if (chErr) throw chErr;

    // For each channel, get last message and unread count
    const enriched = await Promise.all(
      (channels || []).map(async (ch) => {
        // Last message preview
        const { data: lastMessages } = await supabaseAdmin
          .from("chat_messages")
          .select("id, body, created_at, user_id")
          .eq("channel_id", ch.id)
          .order("created_at", { ascending: false })
          .limit(1);

        let lastMessage: Record<string, unknown> | null = null;
        if (lastMessages && lastMessages.length > 0) {
          const msg = lastMessages[0];
          const { data: msgUser } = await supabaseAdmin
            .from("users")
            .select("full_name")
            .eq("id", msg.user_id)
            .single();
          lastMessage = { ...msg, user: msgUser || null };
        }

        // Unread count
        const lastRead = lastReadMap[ch.id];
        let unreadCount = 0;
        if (lastRead) {
          const { count } = await supabaseAdmin
            .from("chat_messages")
            .select("id", { count: "exact", head: true })
            .eq("channel_id", ch.id)
            .gt("created_at", lastRead);
          unreadCount = count || 0;
        } else {
          // Never read — all messages are unread
          const { count } = await supabaseAdmin
            .from("chat_messages")
            .select("id", { count: "exact", head: true })
            .eq("channel_id", ch.id);
          unreadCount = count || 0;
        }

        return {
          ...ch,
          last_message: lastMessage,
          unread_count: unreadCount,
        };
      })
    );

    return NextResponse.json({ channels: enriched });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch channels" },
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
    const { name, description, type, member_ids } = body as {
      name?: string;
      description?: string;
      type: "channel" | "dm";
      member_ids?: string[];
    };

    if (type === "dm") {
      // For DMs, check if a DM channel already exists between the two users
      if (!member_ids || member_ids.length !== 1) {
        return NextResponse.json(
          { error: "DM requires exactly one other member" },
          { status: 400 }
        );
      }

      const otherUserId = member_ids[0];

      // Find DM channels the current user is in
      const { data: myDmChannels } = await supabaseAdmin
        .from("chat_members")
        .select("channel_id")
        .eq("user_id", userId);

      if (myDmChannels && myDmChannels.length > 0) {
        const myChannelIds = myDmChannels.map((m) => m.channel_id);

        // Check if the other user is also in any of those DM channels
        const { data: sharedChannels } = await supabaseAdmin
          .from("chat_members")
          .select("channel_id")
          .eq("user_id", otherUserId)
          .in("channel_id", myChannelIds);

        if (sharedChannels && sharedChannels.length > 0) {
          const sharedIds = sharedChannels.map((m) => m.channel_id);

          // Check if any of these shared channels are DMs
          const { data: existingDm } = await supabaseAdmin
            .from("chat_channels")
            .select("*")
            .in("id", sharedIds)
            .eq("type", "dm")
            .limit(1);

          if (existingDm && existingDm.length > 0) {
            return NextResponse.json({ channel: existingDm[0], existing: true });
          }
        }
      }

      // Create new DM channel
      const { data: otherUser } = await supabaseAdmin
        .from("users")
        .select("full_name, email")
        .eq("id", otherUserId)
        .single();

      const dmName = otherUser?.full_name || otherUser?.email || "DM";

      const { data: channel, error: chErr } = await supabaseAdmin
        .from("chat_channels")
        .insert({
          name: dmName,
          description: null,
          type: "dm",
          created_by: userId,
        })
        .select()
        .single();

      if (chErr) throw chErr;

      // Add both users as members
      const { error: memErr } = await supabaseAdmin.from("chat_members").insert([
        { channel_id: channel.id, user_id: userId },
        { channel_id: channel.id, user_id: otherUserId },
      ]);

      if (memErr) throw memErr;

      return NextResponse.json({ channel }, { status: 201 });
    }

    // Channel type
    if (!name) {
      return NextResponse.json({ error: "Channel name is required" }, { status: 400 });
    }

    const { data: channel, error: chErr } = await supabaseAdmin
      .from("chat_channels")
      .insert({
        name,
        description: description || null,
        type: "channel",
        created_by: userId,
      })
      .select()
      .single();

    if (chErr) throw chErr;

    // Add creator + additional members
    const allMemberIds = Array.from(new Set([userId, ...(member_ids || [])]));
    const { error: memErr } = await supabaseAdmin.from("chat_members").insert(
      allMemberIds.map((uid) => ({ channel_id: channel.id, user_id: uid }))
    );

    if (memErr) throw memErr;

    return NextResponse.json({ channel }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create channel" },
      { status: 500 }
    );
  }
}
