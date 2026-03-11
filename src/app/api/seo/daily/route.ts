import { NextRequest, NextResponse } from "next/server";
import { getSearchAnalytics } from "@/lib/gsc";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireModuleAccess(req, "seo");
  if ("error" in auth) return auth.error;
  try {
    const sp = req.nextUrl.searchParams;
    const startDate = sp.get("startDate") || "";
    const endDate = sp.get("endDate") || "";

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    const rows = await getSearchAnalytics({
      startDate,
      endDate,
      dimensions: ["date"],
      rowLimit: 1000,
    });

    return NextResponse.json({ rows });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch daily analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
