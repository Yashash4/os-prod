import { NextRequest, NextResponse } from "next/server";
import { getCalendars } from "@/lib/ghl";
import { requireSubModuleAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireSubModuleAccess(req, "ghl", "calendar");
  if ("error" in auth) return auth.error;
  try {
    const calendars = await getCalendars();
    return NextResponse.json({ calendars });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch calendars";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
