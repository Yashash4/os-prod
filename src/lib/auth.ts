import { supabase } from "./supabase";
import type { Role } from "@/types";

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
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
    role: (profile?.role as unknown as Role) ?? null,
  };
}

export function onAuthStateChange(
  callback: (event: string, session: unknown) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}
