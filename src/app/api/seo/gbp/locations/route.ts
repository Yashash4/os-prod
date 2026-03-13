import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { requireSubModuleAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "seo", "seo-gbp");
  if ("error" in result) return result.error;
  try {
    const googleAuth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.split("\\n").join("\n"),
      scopes: ["https://www.googleapis.com/auth/business.manage"],
    });

    const token = await googleAuth.authorize();
    const accountId = process.env.GBP_ACCOUNT_ID || "";

    const res = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations?readMask=name,title,storefrontAddress`,
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await res.json();
    return NextResponse.json({ ...data, _permissions: result.permissions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list locations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
