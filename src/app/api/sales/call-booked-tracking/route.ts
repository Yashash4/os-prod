import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { scopeQuery, verifyScopeAccess } from "@/lib/data-scope";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "sales", "pipeline");
  if ("error" in result) return result.error;

  try {
    let query = supabaseAdmin
      .from("sales_call_booked_tracking")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);

    query = scopeQuery(query, result.scope, "assigned_to");

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json({ records: data || [], _permissions: result.permissions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch call booked tracking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "sales", "pipeline");
  if ("error" in result) return result.error;

  if (!result.permissions.canCreate) {
    return NextResponse.json({ error: "You do not have permission to create records" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const records = Array.isArray(body) ? body : [body];

    // Fetch existing records to preserve user-edited fields during sync
    const oppIds = records.map((r: Record<string, unknown>) => r.opportunity_id as string);
    const { data: existing } = await supabaseAdmin
      .from("sales_call_booked_tracking")
      .select("opportunity_id, status, rating, comments, notes, ghl_status")
      .in("opportunity_id", oppIds);

    const existingMap = new Map(
      (existing || []).map((r) => [r.opportunity_id, r])
    );

    const { data, error } = await supabaseAdmin
      .from("sales_call_booked_tracking")
      .upsert(
        records.map((r: Record<string, unknown>) => {
          const prev = existingMap.get(r.opportunity_id as string);
          return {
            opportunity_id: r.opportunity_id,
            contact_name: r.contact_name,
            contact_email: r.contact_email,
            contact_phone: r.contact_phone,
            pipeline_name: r.pipeline_name,
            stage_name: r.stage_name,
            source: r.source,
            status: prev?.status || (r.status as string) || "pending_review",
            rating: prev?.rating ?? (r.rating as number) ?? null,
            comments: prev?.comments ?? (r.comments as string) ?? null,
            notes: prev?.notes ?? (r.notes as string) ?? null,
            assigned_to: r.assigned_to || null,
            ghl_status: (r.ghl_status as string) || prev?.ghl_status || null,
            pipeline_id: r.pipeline_id || null,
            contact_id: r.contact_id || null,
          };
        }),
        { onConflict: "opportunity_id" }
      )
      .select();

    if (error) throw error;
    return NextResponse.json({ records: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save call booked tracking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "sales", "pipeline");
  if ("error" in result) return result.error;

  if (!result.scope.scopeLevel.can_delete) {
    return NextResponse.json({ error: "Only admins can delete records" }, { status: 403 });
  }

  try {
    const oppIds = req.nextUrl.searchParams.get("keep_ids");

    if (oppIds) {
      // Safe: fetch all IDs, compute diff in JS, delete by exact ID list
      const keepSet = new Set(oppIds.split(",").map((id) => id.trim()).filter(Boolean));
      const { data: allRecords } = await supabaseAdmin
        .from("sales_call_booked_tracking")
        .select("opportunity_id");
      const toDelete = (allRecords || [])
        .map((r) => r.opportunity_id as string)
        .filter((id) => !keepSet.has(id));
      if (toDelete.length > 0) {
        const { error } = await supabaseAdmin
          .from("sales_call_booked_tracking")
          .delete()
          .in("opportunity_id", toDelete);
        if (error) throw error;
      }
    } else {
      const { error } = await supabaseAdmin
        .from("sales_call_booked_tracking")
        .delete()
        .neq("opportunity_id", "");
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete records";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "sales", "pipeline");
  if ("error" in result) return result.error;

  if (!result.permissions.canEdit) {
    return NextResponse.json({ error: "You do not have permission to edit records" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { opportunity_id, ...updates } = body;

    if (!opportunity_id) {
      return NextResponse.json({ error: "opportunity_id is required" }, { status: 400 });
    }

    const allowed = await verifyScopeAccess(result.scope, "sales_call_booked_tracking", opportunity_id, "assigned_to", false, "opportunity_id");
    if (!allowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from("sales_call_booked_tracking")
      .update(updates)
      .eq("opportunity_id", opportunity_id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }
    return NextResponse.json({ record: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update call booked tracking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
