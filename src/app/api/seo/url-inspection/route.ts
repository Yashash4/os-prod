import { NextRequest, NextResponse } from "next/server";
import { inspectUrls } from "@/lib/gsc";
import { requireModuleAccess } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const auth = await requireModuleAccess(req, "seo");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const urls: string[] = body.urls || [];

    if (!urls.length) {
      return NextResponse.json(
        { error: "urls array is required" },
        { status: 400 }
      );
    }

    const results = await inspectUrls(urls);
    return NextResponse.json({ results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to inspect URLs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
