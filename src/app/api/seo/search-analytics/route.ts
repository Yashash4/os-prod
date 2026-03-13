import { NextRequest, NextResponse } from "next/server";
import { getSearchAnalytics } from "@/lib/gsc";
import { requireSubModuleAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "seo", "seo-performance");
  if ("error" in result) return result.error;
  try {
    const sp = req.nextUrl.searchParams;
    const startDate = sp.get("startDate") || "";
    const endDate = sp.get("endDate") || "";
    const dimensions = sp.get("dimensions")?.split(",") || ["query"];
    const type = sp.get("type") || "web";
    const rowLimit = Number(sp.get("rowLimit") || "500");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    const rows = await getSearchAnalytics({
      startDate,
      endDate,
      dimensions,
      type,
      rowLimit,
    });

    return NextResponse.json({ rows, _permissions: result.permissions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch search analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
