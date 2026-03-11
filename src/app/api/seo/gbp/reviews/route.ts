import { NextRequest, NextResponse } from "next/server";
import { getReviews } from "@/lib/gmb";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  try {
    const sp = req.nextUrl.searchParams;
    const pageSize = Number(sp.get("pageSize") || "20");
    const pageToken = sp.get("pageToken") || undefined;

    const data = await getReviews(pageSize, pageToken);
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch GBP reviews";
    console.error("[GBP Reviews]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
