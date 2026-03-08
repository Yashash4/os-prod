import { supabase } from "./supabase";

/**
 * Wrapper around fetch that automatically includes the Supabase auth token.
 * Use this for all client-side calls to /api/* routes.
 */
export async function apiFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(options?.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  return fetch(url, { ...options, headers });
}
