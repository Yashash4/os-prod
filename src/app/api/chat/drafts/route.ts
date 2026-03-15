import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

    const { data: draft, error } = await supabaseAdmin
      .from("chat_drafts")
      .select("id, channel_id, body, attachments, updated_at")
      .eq("channel_id", channelId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ draft: draft || null });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch draft" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const result = await requireModuleAccess(req, "chat");
  if ("error" in result) return result.error;

  const { userId } = result.auth;

  try {
    const reqBody = await req.json();
    const { channel_id, body, attachments } = reqBody as {
      channel_id: string;
      body: string;
      attachments?: unknown[];
    };

    if (!channel_id || body === undefined) {
      return NextResponse.json(
        { error: "channel_id and body are required" },
        { status: 400 }
      );
    }

    const upsertData: Record<string, unknown> = {
      channel_id,
      user_id: userId,
      body,
      updated_at: new Date().toISOString(),
    };

    if (attachments !== undefined) {
      upsertData.attachments = attachments;
    }

    const { data: draft, error } = await supabaseAdmin
      .from("chat_drafts")
      .upsert(upsertData, { onConflict: "channel_id,user_id" })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ draft });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save draft" },
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
    const channelId = searchParams.get("channel_id");

    if (!channelId) {
      return NextResponse.json({ error: "channel_id is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("chat_drafts")
      .delete()
      .eq("channel_id", channelId)
      .eq("user_id", userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete draft" },
      { status: 500 }
    );
  }
}
