import { NextRequest, NextResponse } from "next/server";
import { getAds } from "@/lib/meta";

export async function GET(req: NextRequest) {
  try {
    const adSetId = req.nextUrl.searchParams.get("adSetId") || undefined;
    const ads = await getAds(adSetId);
    return NextResponse.json({ ads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch ads";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
