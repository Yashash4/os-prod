import { NextRequest, NextResponse } from "next/server";
import { getSearchKeywords } from "@/lib/gmb";
import { requireSubModuleAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "seo", "seo-gbp");
  if ("error" in result) return result.error;
  try {
    const yearMonth = req.nextUrl.searchParams.get("yearMonth") || "";

    if (!yearMonth) {
      return NextResponse.json(
        { error: "yearMonth (YYYY-MM) is required" },
        { status: 400 }
      );
    }

    const keywords = await getSearchKeywords(yearMonth);
    return NextResponse.json({ keywords, _permissions: result.permissions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch GBP keywords";
    console.error("[GBP Keywords]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
