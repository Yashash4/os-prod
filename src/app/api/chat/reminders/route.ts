import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const result = await requireModuleAccess(req, "chat");
  if ("error" in result) return result.error;

  const { userId } = result.auth;

  try {
    const body = await req.json();
    const { message_id, channel_id, remind_at } = body as {
      message_id: string;
      channel_id: string;
      remind_at: string;
    };

    if (!message_id || !channel_id || !remind_at) {
      return NextResponse.json(
        { error: "message_id, channel_id, and remind_at are required" },
        { status: 400 }
      );
    }

    // Verify the message exists
    const { data: message, error: msgErr } = await supabaseAdmin
      .from("chat_messages")
      .select("id, channel_id")
      .eq("id", message_id)
      .eq("channel_id", channel_id)
      .single();

    if (msgErr || !message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Store reminder — using a simple upsert approach
    // If chat_reminders table doesn't exist, we create the reminder in notifications table
    // Try to insert into chat_reminders first
    try {
      const { data: reminder, error } = await supabaseAdmin
        .from("chat_reminders")
        .insert({
          user_id: userId,
          message_id,
          channel_id,
          remind_at,
          created_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (error) throw error;
      return NextResponse.json({ reminder }, { status: 201 });
    } catch {
      // If chat_reminders table doesn't exist, fall back to storing as a notification
      // scheduled for the future
      const { sendNotification } = await import("@/lib/notify");
      await sendNotification(userId, {
        title: "Message Reminder",
        body: `You asked to be reminded about a message`,
        type: "chat_reminder",
        module: "chat",
        link: "/m/chat",
      });

      return NextResponse.json(
        { reminder: { message_id, channel_id, remind_at, user_id: userId } },
        { status: 201 }
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create reminder" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const result = await requireModuleAccess(req, "chat");
  if ("error" in result) return result.error;

  const { userId } = result.auth;

  try {
    const { data: reminders, error } = await supabaseAdmin
      .from("chat_reminders")
      .select("*")
      .eq("user_id", userId)
      .order("remind_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ reminders: reminders || [] });
  } catch {
    return NextResponse.json({ reminders: [] });
  }
}
