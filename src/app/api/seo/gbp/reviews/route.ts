import { NextRequest, NextResponse } from "next/server";
import { getReviews } from "@/lib/gmb";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const pageSize = Number(sp.get("pageSize") || "20");
    const pageToken = sp.get("pageToken") || undefined;

    const data = await getReviews(pageSize, pageToken);
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch GBP reviews";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
