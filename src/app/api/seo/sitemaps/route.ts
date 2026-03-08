import { NextResponse } from "next/server";
import { getSitemaps } from "@/lib/gsc";

export async function GET() {
  try {
    const sitemaps = await getSitemaps();
    return NextResponse.json({ sitemaps });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch sitemaps";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
