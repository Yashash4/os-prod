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
      .from("chat_channel_members")
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

        // For DM channels, include the other user's info
        let dmUser: { id: string; full_name: string | null; email: string; avatar_url: string | null } | null = null;
        if (ch.type === "dm") {
          const { data: dmMembers } = await supabaseAdmin
            .from("chat_channel_members")
            .select("user_id")
            .eq("channel_id", ch.id);

          if (dmMembers) {
            const otherMember = dmMembers.find((m: { user_id: string }) => m.user_id !== userId);
            if (otherMember) {
              const { data: otherUserData } = await supabaseAdmin
                .from("users")
                .select("id, full_name, email, avatar_url")
                .eq("id", otherMember.user_id)
                .single();
              if (otherUserData) {
                dmUser = otherUserData;
              }
            }
          }
        }

        return {
          ...ch,
          last_message: lastMessage,
          unread_count: unreadCount,
          ...(dmUser ? { dm_user: dmUser } : {}),
        };
      })
    );

    // Sort DMs by last message time (most recent first), channels by created_at
    const sortedChannels = enriched.filter((c) => c.type === "channel");
    const sortedDms = enriched
      .filter((c) => c.type === "dm")
      .sort((a, b) => {
        const aTime = (a.last_message as { created_at?: string } | null)?.created_at || a.created_at;
        const bTime = (b.last_message as { created_at?: string } | null)?.created_at || b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

    return NextResponse.json({ channels: [...sortedChannels, ...sortedDms] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch channels" },
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
    const channelId = searchParams.get("id");

    if (!channelId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Only admin (is_admin role) or channel creator can delete
    const { data: channel, error: chErr } = await supabaseAdmin
      .from("chat_channels")
      .select("id, created_by")
      .eq("id", channelId)
      .single();

    if (chErr || !channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const { data: roleData } = await supabaseAdmin
      .from("users")
      .select("role:roles(is_admin)")
      .eq("id", userId)
      .single();

    const isAdmin = (roleData?.role as { is_admin?: boolean } | null)?.is_admin === true;

    if (!isAdmin && channel.created_by !== userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from("chat_channels")
      .delete()
      .eq("id", channelId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete channel" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const result = await requireModuleAccess(req, "chat");
  if ("error" in result) return result.error;

  const { userId, isAdmin } = result.auth;

  try {
    const body = await req.json();
    const { name, description, type, member_ids, member_id, is_private, is_announcement } = body as {
      name?: string;
      description?: string;
      type: "channel" | "dm";
      member_ids?: string[];
      member_id?: string;
      is_private?: boolean;
      is_announcement?: boolean;
    };

    if (type === "dm") {
      // Support both member_id (single) and member_ids (array with 1 element)
      const otherUserId = member_id || (member_ids && member_ids.length === 1 ? member_ids[0] : null);

      if (!otherUserId) {
        return NextResponse.json(
          { error: "DM requires exactly one other member" },
          { status: 400 }
        );
      }

      // Validate DM permission: at least one participant must be admin
      let otherIsAdmin = false;
      const { data: otherRoleData } = await supabaseAdmin
        .from("users")
        .select("role:roles(is_admin)")
        .eq("id", otherUserId)
        .single();

      if (otherRoleData?.role && typeof otherRoleData.role === "object") {
        otherIsAdmin = (otherRoleData.role as { is_admin?: boolean }).is_admin === true;
      }

      if (!isAdmin && !otherIsAdmin) {
        return NextResponse.json(
          { error: "DMs are only allowed with admins" },
          { status: 403 }
        );
      }

      // Find DM channels the current user is in
      const { data: myDmChannels } = await supabaseAdmin
        .from("chat_channel_members")
        .select("channel_id")
        .eq("user_id", userId);

      if (myDmChannels && myDmChannels.length > 0) {
        const myChannelIds = myDmChannels.map((m: { channel_id: string }) => m.channel_id);

        // Check if the other user is also in any of those DM channels
        const { data: sharedChannels } = await supabaseAdmin
          .from("chat_channel_members")
          .select("channel_id")
          .eq("user_id", otherUserId)
          .in("channel_id", myChannelIds);

        if (sharedChannels && sharedChannels.length > 0) {
          const sharedIds = sharedChannels.map((m: { channel_id: string }) => m.channel_id);

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

      // Get both users' names for the DM channel name
      const { data: currentUser } = await supabaseAdmin
        .from("users")
        .select("full_name, email")
        .eq("id", userId)
        .single();

      const { data: otherUser } = await supabaseAdmin
        .from("users")
        .select("full_name, email")
        .eq("id", otherUserId)
        .single();

      const currentName = currentUser?.full_name || currentUser?.email?.split("@")[0] || "User";
      const otherName = otherUser?.full_name || otherUser?.email?.split("@")[0] || "User";
      const dmName = `${currentName} & ${otherName}`;

      const { data: channel, error: chErr } = await supabaseAdmin
        .from("chat_channels")
        .insert({
          name: dmName,
          description: null,
          type: "dm",
          is_private: true,
          created_by: userId,
        })
        .select()
        .single();

      if (chErr) throw chErr;

      // Add both users as members
      const { error: memErr } = await supabaseAdmin.from("chat_channel_members").insert([
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
        is_private: is_private || false,
        is_announcement: is_announcement || false,
        created_by: userId,
      })
      .select()
      .single();

    if (chErr) throw chErr;

    // Add creator + additional members
    const allMemberIds = Array.from(new Set([userId, ...(member_ids || [])]));
    const { error: memErr } = await supabaseAdmin.from("chat_channel_members").insert(
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
