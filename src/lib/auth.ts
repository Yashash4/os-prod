import { supabase } from "./supabase";
import type { Role } from "@/types";

export async function signIn(email: string, password: string) {
  // Go through the rate-limited API route
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Login failed" }));
    throw new Error(data.error || "Login failed");
  }

  const { access_token, refresh_token } = await res.json();

  // Set the session on the client-side Supabase instance
  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });

  if (error) throw error;

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email: string) {
  // Password reset is handled server-side; this is a placeholder
  // The actual reset email is sent via the API route
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, avatar_url, role:roles(*)")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email!,
    full_name: profile?.full_name ?? null,
    avatar_url: profile?.avatar_url ?? undefined,
    role: profile?.role && typeof profile.role === "object" && !Array.isArray(profile.role) && "id" in profile.role
      ? (profile.role as unknown as Role)
      : null,
  };
}

export function onAuthStateChange(
  callback: (event: string, session: unknown) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}
