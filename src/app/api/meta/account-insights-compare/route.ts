import { NextRequest, NextResponse } from "next/server";
import { getAccountInsights } from "@/lib/meta";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;

  try {
    const datePreset =
      req.nextUrl.searchParams.get("date_preset") || "today";
    const comparePreset =
      req.nextUrl.searchParams.get("compare_preset") || "yesterday";

    const [current, previous] = await Promise.all([
      getAccountInsights(datePreset),
      getAccountInsights(comparePreset),
    ]);

    return NextResponse.json({ current, previous });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch comparison insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
