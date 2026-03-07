import { NextRequest, NextResponse } from "next/server";
import { getAdSets } from "@/lib/meta";

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get("campaignId") || undefined;
    const adsets = await getAdSets(campaignId);
    return NextResponse.json({ adsets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch ad sets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
