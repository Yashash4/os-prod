import { NextRequest, NextResponse } from "next/server";
import { getContact } from "@/lib/ghl";

export async function GET(req: NextRequest) {
  try {
    const contactId = req.nextUrl.searchParams.get("contactId");

    if (!contactId) {
      return NextResponse.json(
        { error: "contactId is required" },
        { status: 400 }
      );
    }

    const contact = await getContact(contactId);
    return NextResponse.json({ contact });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch contact";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
