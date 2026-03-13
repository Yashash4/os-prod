import { NextRequest, NextResponse } from "next/server";
import { getReviews } from "@/lib/gmb";
import { requireSubModuleAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "seo", "seo-gbp");
  if ("error" in result) return result.error;
  try {
    const sp = req.nextUrl.searchParams;
    const pageSize = Number(sp.get("pageSize") || "20");
    const pageToken = sp.get("pageToken") || undefined;

    const data = await getReviews(pageSize, pageToken);
    return NextResponse.json({ ...data, _permissions: result.permissions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch GBP reviews";
    console.error("[GBP Reviews]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
