import { supabaseAdmin } from "./supabase-admin";

interface LogEntry {
  action: string;
  module: string;
  breadcrumb_path: string;
  details?: Record<string, unknown>;
  before_value?: Record<string, unknown>;
  after_value?: Record<string, unknown>;
}

// Tier 1: Critical - always logged with full detail
// userId can be "anonymous" for pre-auth events (login failures, password resets)
// NOTE: This uses supabaseAdmin — only call from server-side (API routes).
export async function logCritical(userId: string, entry: LogEntry) {
  try {
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      user_id: userId === "anonymous" ? null : userId,
      tier: 1,
      ...entry,
    });
    if (error) console.error("Audit log (critical) failed:", error.message);
  } catch (err) {
    console.error("Audit log (critical) exception:", err);
  }
}

// Tier 2: Important - logged lightweight
// NOTE: This uses supabaseAdmin — only call from server-side (API routes).
export async function logImportant(userId: string, entry: LogEntry) {
  try {
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      tier: 2,
      ...entry,
    });
    if (error) console.error("Audit log (important) failed:", error.message);
  } catch (err) {
    console.error("Audit log (important) exception:", err);
  }
}

// Tier 3: Noise - never logged (this function exists for documentation)
// Page views, clicks, scrolls - skip these
