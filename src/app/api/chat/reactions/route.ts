import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface ReactionAgg {
  emoji: string;
  count: number;
  user_ids: string[];
}

async function aggregateReactions(messageIds: string[]): Promise<Record<string, ReactionAgg[]>> {
  if (messageIds.length === 0) return {};

  const { data: reactions, error } = await supabaseAdmin
    .from("chat_reactions")
    .select("id, message_id, user_id, emoji")
    .in("message_id", messageIds);

  if (error || !reactions) return {};

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

  try {
    const { searchParams } = new URL(req.url);
    const messageIdsParam = searchParams.get("message_ids");

    if (!messageIdsParam) {
      return NextResponse.json(
        { error: "message_ids query param is required" },
        { status: 400 }
      );
    }

    const messageIds = messageIdsParam.split(",").filter(Boolean);
    if (messageIds.length === 0) {
      return NextResponse.json({ reactions: {} });
    }

    const reactions = await aggregateReactions(messageIds);
    return NextResponse.json({ reactions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch reactions" },
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
    const { message_id, emoji } = body as { message_id: string; emoji: string };

    if (!message_id || !emoji) {
      return NextResponse.json(
        { error: "message_id and emoji are required" },
        { status: 400 }
      );
    }

    // Check if the user already reacted with this emoji
    const { data: existing } = await supabaseAdmin
      .from("chat_reactions")
      .select("id")
      .eq("message_id", message_id)
      .eq("user_id", userId)
      .eq("emoji", emoji)
      .maybeSingle();

    if (existing) {
      // Remove the reaction (toggle off)
      const { error: deleteErr } = await supabaseAdmin
        .from("chat_reactions")
        .delete()
        .eq("id", existing.id);

      if (deleteErr) throw deleteErr;
    } else {
      // Add the reaction (toggle on)
      const { error: insertErr } = await supabaseAdmin
        .from("chat_reactions")
        .insert({
          message_id,
          user_id: userId,
          emoji,
        });

      if (insertErr) throw insertErr;
    }

    // Return updated reactions for this message
    const reactions = await aggregateReactions([message_id]);
    return NextResponse.json({
      reactions: reactions[message_id] || [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to toggle reaction" },
      { status: 500 }
    );
  }
}
