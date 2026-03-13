import { supabase } from "./supabase";

/**
 * Cached access token — updated by onAuthStateChange listener.
 * This avoids calling getSession() on every API request (which can hang).
 */
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number | null = null;

// Keep token fresh via onAuthStateChange only — no getSession() call.
// Supabase fires INITIAL_SESSION on subscribe, so this also seeds the token.
// Calling getSession() here would acquire the auth lock and block signIn if it hangs.
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedAccessToken = session?.access_token ?? null;
    tokenExpiresAt = session?.expires_at ? session.expires_at * 1000 : null;
  });
}

/**
 * Wrapper around fetch that automatically includes the Supabase auth token.
 * Use this for all client-side calls to /api/* routes.
 *
 * Automatically refreshes the token if it's within 60 seconds of expiry.
 */
export async function apiFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  // Proactively refresh token if it's about to expire
  if (tokenExpiresAt && Date.now() > tokenExpiresAt - 60_000) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        cachedAccessToken = session.access_token;
        tokenExpiresAt = session.expires_at ? session.expires_at * 1000 : null;
      } else {
        // Session gone — redirect to login
        cachedAccessToken = null;
        tokenExpiresAt = null;
        window.location.href = "/login";
        return new Response(null, { status: 401 });
      }
    } catch {
      // Refresh failed — redirect to login
      cachedAccessToken = null;
      tokenExpiresAt = null;
      window.location.href = "/login";
      return new Response(null, { status: 401 });
    }
  }

  const headers = new Headers(options?.headers);
  if (cachedAccessToken) {
    headers.set("Authorization", `Bearer ${cachedAccessToken}`);
  }

  return fetch(url, { ...options, headers });
}
