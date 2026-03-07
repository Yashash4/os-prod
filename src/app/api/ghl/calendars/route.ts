import { NextResponse } from "next/server";
import { getCalendars } from "@/lib/ghl";

export async function GET() {
  try {
    const calendars = await getCalendars();
    return NextResponse.json({ calendars });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch calendars";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
