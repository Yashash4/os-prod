import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const MAX_PINS_PER_CHANNEL = 100;

export async function GET(req: NextRequest) {
  const result = await requireModuleAccess(req, "chat");
  if ("error" in result) return result.error;

  try {
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get("channel_id");

    if (!channelId) {
      return NextResponse.json({ error: "channel_id is required" }, { status: 400 });
    }

    const { data: pins, error } = await supabaseAdmin
      .from("chat_pins")
      .select("id, message_id, channel_id, pinned_by, created_at")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!pins || pins.length === 0) {
      return NextResponse.json({ pins: [] });
    }

    // Fetch associated messages
    const messageIds = pins.map((p) => p.message_id);
    const { data: messages } = await supabaseAdmin
      .from("chat_messages")
      .select("id, channel_id, user_id, body, attachment_url, created_at, is_deleted")
      .in("id", messageIds);

    const messageMap = Object.fromEntries((messages || []).map((m) => [m.id, m]));

    // Fetch user info for message authors and pinners
    const allUserIds = [
      ...new Set([
        ...pins.map((p) => p.pinned_by),
        ...(messages || []).map((m) => m.user_id),
      ]),
    ];

    let userMap: Record<string, { id: string; full_name: string | null; email: string }> = {};
    if (allUserIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from("users")
        .select("id, full_name, email")
        .in("id", allUserIds);
      if (users) {
        userMap = Object.fromEntries(users.map((u) => [u.id, u]));
      }
    }

    const enrichedPins = pins.map((pin) => {
      const msg = messageMap[pin.message_id];
      return {
        ...pin,
        pinned_by_user: userMap[pin.pinned_by] || null,
        message: msg
          ? {
              ...msg,
              body: msg.is_deleted ? "[Message deleted]" : msg.body,
              user: userMap[msg.user_id] || null,
            }
          : null,
      };
    });

    return NextResponse.json({ pins: enrichedPins });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch pins" },
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
    const { message_id, channel_id } = body as { message_id: string; channel_id: string };

    if (!message_id || !channel_id) {
      return NextResponse.json(
        { error: "message_id and channel_id are required" },
        { status: 400 }
      );
    }

    // Verify the message exists and belongs to the channel
    const { data: message, error: msgErr } = await supabaseAdmin
      .from("chat_messages")
      .select("id, channel_id, is_deleted")
      .eq("id", message_id)
      .eq("channel_id", channel_id)
      .single();

    if (msgErr || !message) {
      return NextResponse.json({ error: "Message not found in this channel" }, { status: 404 });
    }

    if (message.is_deleted) {
      return NextResponse.json({ error: "Cannot pin a deleted message" }, { status: 400 });
    }

    // Check if already pinned
    const { data: existingPin } = await supabaseAdmin
      .from("chat_pins")
      .select("id")
      .eq("message_id", message_id)
      .eq("channel_id", channel_id)
      .maybeSingle();

    if (existingPin) {
      return NextResponse.json({ error: "Message is already pinned" }, { status: 400 });
    }

    // Check pin limit
    const { count, error: countErr } = await supabaseAdmin
      .from("chat_pins")
      .select("id", { count: "exact", head: true })
      .eq("channel_id", channel_id);

    if (countErr) throw countErr;

    if ((count || 0) >= MAX_PINS_PER_CHANNEL) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_PINS_PER_CHANNEL} pins per channel reached` },
        { status: 400 }
      );
    }

    // Insert the pin
    const { data: pin, error: pinErr } = await supabaseAdmin
      .from("chat_pins")
      .insert({ message_id, channel_id, pinned_by: userId })
      .select("*")
      .single();

    if (pinErr) throw pinErr;

    // Get user name for system message
    const { data: pinner } = await supabaseAdmin
      .from("users")
      .select("full_name")
      .eq("id", userId)
      .single();

    const pinnerName = pinner?.full_name || "Someone";

    // Insert system message
    await supabaseAdmin.from("chat_messages").insert({
      channel_id,
      user_id: userId,
      body: `${pinnerName} pinned a message`,
      is_system: true,
    });

    return NextResponse.json({ pin }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to pin message" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const result = await requireModuleAccess(req, "chat");
  if ("error" in result) return result.error;

  const { userId, isAdmin } = result.auth;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Fetch the pin
    const { data: pin, error: pinErr } = await supabaseAdmin
      .from("chat_pins")
      .select("id, channel_id, pinned_by")
      .eq("id", id)
      .single();

    if (pinErr || !pin) {
      return NextResponse.json({ error: "Pin not found" }, { status: 404 });
    }

    // Only pin creator or admin can unpin
    if (pin.pinned_by !== userId && !isAdmin) {
      return NextResponse.json(
        { error: "Only the pin creator or an admin can unpin" },
        { status: 403 }
      );
    }

    const { error: deleteErr } = await supabaseAdmin
      .from("chat_pins")
      .delete()
      .eq("id", id);

    if (deleteErr) throw deleteErr;

    // Get user name for system message
    const { data: unpinner } = await supabaseAdmin
      .from("users")
      .select("full_name")
      .eq("id", userId)
      .single();

    const unpinnerName = unpinner?.full_name || "Someone";

    // Insert system message
    await supabaseAdmin.from("chat_messages").insert({
      channel_id: pin.channel_id,
      user_id: userId,
      body: `${unpinnerName} unpinned a message`,
      is_system: true,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to unpin message" },
      { status: 500 }
    );
  }
}
