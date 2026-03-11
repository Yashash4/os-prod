import { NextRequest, NextResponse } from "next/server";
import { getFormSubmissionsByContact } from "@/lib/ghl";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireModuleAccess(req, "ghl");
  if ("error" in auth) return auth.error;
  try {
    const contactId = req.nextUrl.searchParams.get("contactId");

    if (!contactId) {
      return NextResponse.json(
        { error: "contactId is required" },
        { status: 400 }
      );
    }

    const submissions = await getFormSubmissionsByContact(contactId);
    return NextResponse.json({ submissions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch submissions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
