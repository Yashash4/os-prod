import { NextRequest, NextResponse } from "next/server";
import { getSitemaps } from "@/lib/gsc";
import { requireSubModuleAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "seo", "seo-sitemap");
  if ("error" in result) return result.error;
  try {
    const sitemaps = await getSitemaps();
    return NextResponse.json({ sitemaps, _permissions: result.permissions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch sitemaps";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
