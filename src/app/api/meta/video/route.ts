import { NextRequest, NextResponse } from "next/server";
import { getVideoSource } from "@/lib/meta";
import { requireSubModuleAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireSubModuleAccess(req, "meta", "meta-ads");
  if ("error" in auth) return auth.error;
  try {
    const videoId = req.nextUrl.searchParams.get("videoId");
    if (!videoId) {
      return NextResponse.json({ error: "videoId required" }, { status: 400 });
    }
    const data = await getVideoSource(videoId);
    return NextResponse.json({ source: data.source || null, picture: data.picture || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch video";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
