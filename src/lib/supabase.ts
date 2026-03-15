import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Use @supabase/ssr browser client so the session is stored in cookies
// (not localStorage). This lets the Next.js middleware read the session
// for server-side route protection on /m/* and /settings/* pages.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
