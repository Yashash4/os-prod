import { NextRequest, NextResponse } from "next/server";
import { inspectUrls } from "@/lib/gsc";
import { requireSubModuleAccess } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "seo", "seo-indexing");
  if ("error" in result) return result.error;
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
    return NextResponse.json({ results, _permissions: result.permissions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to inspect URLs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
