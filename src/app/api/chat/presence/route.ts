import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const result = await requireModuleAccess(req, "chat");
  if ("error" in result) return result.error;

  try {
    const { searchParams } = new URL(req.url);
    const userIdsParam = searchParams.get("user_ids");

    if (!userIdsParam) {
      return NextResponse.json({ error: "user_ids is required" }, { status: 400 });
    }

    const userIds = userIdsParam.split(",").map((id) => id.trim()).filter(Boolean);

    if (userIds.length === 0) {
      return NextResponse.json({ error: "user_ids must contain at least one ID" }, { status: 400 });
    }

    const { data: presence, error } = await supabaseAdmin
      .from("chat_presence")
      .select("user_id, status, custom_text, custom_emoji, typing_in, last_seen_at")
      .in("user_id", userIds);

    if (error) throw error;

    // Build a map keyed by user_id for easy lookup
    const presenceMap: Record<string, unknown> = {};
    for (const p of presence || []) {
      presenceMap[p.user_id] = p;
    }

    // Fill in defaults for users without presence records
    for (const uid of userIds) {
      if (!presenceMap[uid]) {
        presenceMap[uid] = {
          user_id: uid,
          status: "offline",
          custom_text: null,
          custom_emoji: null,
          typing_in: null,
          last_seen_at: null,
        };
      }
    }

    return NextResponse.json({ presence: presenceMap });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch presence" },
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
    const { status, typing_in, custom_text, custom_emoji, expires_at } = body as {
      status?: string;
      typing_in?: string | null;
      custom_text?: string | null;
      custom_emoji?: string | null;
      expires_at?: string | null;
    };

    const upsertData: Record<string, unknown> = {
      user_id: userId,
      last_seen_at: new Date().toISOString(),
    };

    if (status !== undefined) upsertData.status = status;
    if (typing_in !== undefined) upsertData.typing_in = typing_in;
    if (custom_text !== undefined) upsertData.custom_text = custom_text;
    if (custom_emoji !== undefined) upsertData.custom_emoji = custom_emoji;
    if (expires_at !== undefined) upsertData.expires_at = expires_at;

    const { data: presence, error } = await supabaseAdmin
      .from("chat_presence")
      .upsert(upsertData, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ presence });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update presence" },
      { status: 500 }
    );
  }
}
