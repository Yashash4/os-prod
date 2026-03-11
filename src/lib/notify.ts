import { supabaseAdmin } from "./supabase-admin";

interface NotificationPayload {
  title: string;
  body?: string;
  type: string; // 'task_assigned', 'payment_received', 'leave_approved', etc.
  module?: string;
  link?: string;
}

export async function sendNotification(
  userId: string,
  payload: NotificationPayload
) {
  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    ...payload,
  });
}

export async function sendNotificationToMany(
  userIds: string[],
  payload: NotificationPayload
) {
  if (userIds.length === 0) return;
  await supabaseAdmin.from("notifications").insert(
    userIds.map((uid) => ({ user_id: uid, ...payload }))
  );
}
