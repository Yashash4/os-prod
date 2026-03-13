import { NextRequest, NextResponse } from "next/server";

const PUBLIC_API_ROUTES = [
  "/api/public/",
  "/api/auth/",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect API routes — page routes are handled by AuthGuard (client-side)
  // because this app uses Bearer token auth (localStorage), not cookie-based sessions
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

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
