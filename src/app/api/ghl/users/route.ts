import { NextRequest, NextResponse } from "next/server";
import { getUsers } from "@/lib/ghl";
import { requireSubModuleAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireSubModuleAccess(req, "ghl", "calendar");
  if ("error" in auth) return auth.error;
  try {
    const users = await getUsers();
    return NextResponse.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch users";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
