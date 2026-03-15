import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const VALID_LEVELS = ["all", "mentions"] as const;

export async function GET(req: NextRequest) {
  const result = await requireModuleAccess(req, "chat");
  if ("error" in result) return result.error;

  const { userId } = result.auth;

  try {
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get("channel_id");

    if (!channelId) {
      return NextResponse.json({ error: "channel_id is required" }, { status: 400 });
    }

    const { data: pref, error } = await supabaseAdmin
      .from("chat_notification_prefs")
      .select("id, channel_id, level, keywords, updated_at")
      .eq("channel_id", channelId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    // Return default if no pref set
    return NextResponse.json({
      pref: pref || { channel_id: channelId, level: "all", keywords: null },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch notification preference" },
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
    const { channel_id, level, keywords } = body as {
      channel_id: string;
      level: string;
      keywords?: string[] | null;
    };

    if (!channel_id || !level) {
      return NextResponse.json(
        { error: "channel_id and level are required" },
        { status: 400 }
      );
    }

    if (!VALID_LEVELS.includes(level as (typeof VALID_LEVELS)[number])) {
      return NextResponse.json(
        { error: "level must be 'all' or 'mentions'" },
        { status: 400 }
      );
    }

    const upsertData: Record<string, unknown> = {
      user_id: userId,
      channel_id,
      level,
      updated_at: new Date().toISOString(),
    };

    if (keywords !== undefined) {
      upsertData.keywords = keywords;
    }

    const { data: pref, error } = await supabaseAdmin
      .from("chat_notification_prefs")
      .upsert(upsertData, { onConflict: "user_id,channel_id" })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ pref });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update notification preference" },
      { status: 500 }
    );
  }
}
