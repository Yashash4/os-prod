import { supabase } from "./supabase";

/**
 * Cached access token — updated by onAuthStateChange listener.
 * This avoids calling getSession() on every API request (which can hang).
 */
let cachedAccessToken: string | null = null;

// Keep token fresh via onAuthStateChange only — no getSession() call.
// Supabase fires INITIAL_SESSION on subscribe, so this also seeds the token.
// Calling getSession() here would acquire the auth lock and block signIn if it hangs.
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedAccessToken = session?.access_token ?? null;
  });
}

/**
 * Wrapper around fetch that automatically includes the Supabase auth token.
 * Use this for all client-side calls to /api/* routes.
 */
export async function apiFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const headers = new Headers(options?.headers);
  if (cachedAccessToken) {
    headers.set("Authorization", `Bearer ${cachedAccessToken}`);
  }

  return fetch(url, { ...options, headers });
}
