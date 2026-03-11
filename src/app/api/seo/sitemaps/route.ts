import { NextRequest, NextResponse } from "next/server";
import { getSitemaps } from "@/lib/gsc";
import { requireSubModuleAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireSubModuleAccess(req, "seo", "seo-sitemap");
  if ("error" in auth) return auth.error;
  try {
    const sitemaps = await getSitemaps();
    return NextResponse.json({ sitemaps });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch sitemaps";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
