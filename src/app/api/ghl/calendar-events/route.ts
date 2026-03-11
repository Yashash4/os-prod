import { NextRequest, NextResponse } from "next/server";
import { getCalendarEvents } from "@/lib/ghl";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireModuleAccess(req, "ghl");
  if ("error" in auth) return auth.error;
  try {
    const calendarId = req.nextUrl.searchParams.get("calendarId");
    const startTime = req.nextUrl.searchParams.get("startTime");
    const endTime = req.nextUrl.searchParams.get("endTime");

    if (!calendarId || !startTime || !endTime) {
      return NextResponse.json(
        { error: "calendarId, startTime, and endTime are required" },
        { status: 400 }
      );
    }

    const events = await getCalendarEvents(calendarId, startTime, endTime);
    return NextResponse.json({ events });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch events";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
