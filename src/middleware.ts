import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_API_ROUTES = [
  "/api/public/",
  "/api/auth/",
];

/** Paths that should never require auth */
const PUBLIC_PAGE_PATHS = [
  "/login",
  "/auth/",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- API route protection (existing Bearer token logic) ---
  if (pathname.startsWith("/api/")) {
    // Skip public API routes
    if (PUBLIC_API_ROUTES.some((r) => pathname.startsWith(r))) {
      return NextResponse.next();
    }

    // For protected API routes, check for Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.next();
  }

  // --- Page route protection for /m/* and /settings/* ---
  if (pathname.startsWith("/m/") || pathname.startsWith("/m") || pathname.startsWith("/settings")) {
    // Create a response we can mutate (for cookie refresh)
    let response = NextResponse.next({
      request: { headers: req.headers },
    });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            // Update request cookies (for downstream server components)
            cookiesToSet.forEach(({ name, value }) => {
              req.cookies.set(name, value);
            });
            // Re-create response with updated request headers
            response = NextResponse.next({
              request: { headers: req.headers },
            });
            // Set cookies on the response (for the browser)
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    // getUser() validates server-side (not just decoding JWT like getSession)
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  // Skip public pages (login, auth callbacks, etc.)
  if (PUBLIC_PAGE_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // All other routes pass through
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public assets (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
