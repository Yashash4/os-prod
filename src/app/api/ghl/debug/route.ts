import { NextRequest, NextResponse } from "next/server";
import { requireSubModuleAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireSubModuleAccess(req, "ghl", "opportunities");
  if ("error" in auth) return auth.error;
  const apiKey = process.env.GHL_API_KEY || "";
  const locationId = process.env.GHL_LOCATION_ID || "";

  // Mask the API key for safety - show first 8 and last 4 chars
  const maskedKey = apiKey.length > 12
    ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`
    : "(not set)";

  // Test a simple API call
  let testResult = "";
  try {
    const res = await fetch(
      `https://services.leadconnectorhq.com/opportunities/pipelines?locationId=${locationId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: "2021-07-28",
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );
    const text = await res.text();
    testResult = `Status: ${res.status} | Body: ${text.slice(0, 500)}`;
  } catch (err) {
    testResult = `Fetch error: ${err instanceof Error ? err.message : String(err)}`;
  }

  return NextResponse.json({
    env: {
      GHL_API_KEY: maskedKey,
      GHL_LOCATION_ID: locationId || "(not set)",
      keyLength: apiKey.length,
      locationLength: locationId.length,
    },
    testResult,
  });
}
