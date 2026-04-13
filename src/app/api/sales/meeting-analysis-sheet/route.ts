import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { scopeQuery, verifyScopeAccess } from "@/lib/data-scope";
import { getCalendars, getCalendarEvents } from "@/lib/ghl";

interface CalendarItem {
  id: string;
  name: string;
  teamMembers?: { userId: string }[];
}

interface CalendarEvent {
  id: string;
  startTime: string;
  endTime: string;
  appointmentStatus?: string;
  assignedUserId?: string;
  contactId?: string;
  address?: string;
}

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "sales", "pipeline");
  if ("error" in result) return result.error;
  try {
    const owner = req.nextUrl.searchParams.get("owner");
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");

    if (!owner) {
      return NextResponse.json({ error: "owner is required" }, { status: 400 });
    }

    // Look up employee ID from owner name for sales_rep_id filtering
    const { data: repRow } = await supabaseAdmin.from("hr_employees").select("id").ilike("full_name", "%" + owner + "%").eq("is_sales_rep", true).single();
    const repEmployeeId = repRow?.id;

    let query = supabaseAdmin
      .from("sales_meeting_analysis")
      .select("*")
      .eq("sales_rep_id", repEmployeeId || "")
      .order("meet_date", { ascending: false });

    if (from) query = query.gte("meet_date", from);
    if (to) query = query.lte("meet_date", to + "T23:59:59");

    query = scopeQuery(query, result.scope, "created_by");

    const { data, error } = await query;
    if (error) throw error;

    const records = data || [];

    // Cross-reference with sales tracking to auto-tag won deals
    if (records.length > 0) {
      const contactEmails = records
        .map((r: { contact_email: string | null }) => r.contact_email)
        .filter(Boolean) as string[];

      if (contactEmails.length > 0) {
        let wonQuery = supabaseAdmin.from("sales_deals").select("contact_email");
        if (repEmployeeId) wonQuery = wonQuery.eq("sales_rep_id", repEmployeeId);
        const { data: wonDeals } = await wonQuery
          .in("contact_email", contactEmails);

        if (wonDeals && wonDeals.length > 0) {
          const wonEmails = new Set(wonDeals.map((d: { contact_email: string }) => d.contact_email?.toLowerCase()));
          for (const record of records as { contact_email: string | null; outcome: string | null }[]) {
            if (!record.outcome && record.contact_email && wonEmails.has(record.contact_email.toLowerCase())) {
              record.outcome = "converted";
            }
          }
        }
      }
    }

    return NextResponse.json({ records, _permissions: result.permissions });
  } catch (error: unknown) {
    const e = error as { message?: string; details?: string; hint?: string; code?: string };
    console.error("SALES ROUTE ERROR in meeting-analysis-sheet:", e.message, "| details:", e.details, "| hint:", e.hint, "| code:", e.code);
    const message = e.message || "Failed to fetch meeting sheet";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "sales", "pipeline");
  if ("error" in result) return result.error;

  if (!result.permissions.canCreate) {
    return NextResponse.json({ error: "You do not have permission to create records" }, { status: 403 });
  }

  const action = req.nextUrl.searchParams.get("action");

  // ── Sync: auto-populate past meetings from GHL calendar ──
  if (action === "sync") {
    try {
      const body = await req.json();
      const { owner, month, ghlUserId } = body;

      if (!owner || !month || !ghlUserId) {
        return NextResponse.json({ error: "owner, month, and ghlUserId are required" }, { status: 400 });
      }

      // Look up employee ID from owner name
      const { data: syncRepRow } = await supabaseAdmin.from("hr_employees").select("id").ilike("full_name", "%" + owner + "%").eq("is_sales_rep", true).single();
      const syncRepId = syncRepRow?.id;

      const [year, mon] = month.split("-").map(Number);
      const lastDay = new Date(year, mon, 0).getDate();
      const now = new Date();

      // Cap to today if current month
      const maxDay = (year === now.getFullYear() && mon === now.getMonth() + 1)
        ? Math.min(lastDay, now.getDate())
        : lastDay;

      const from = `${month}-01T00:00:00`;
      const to = `${month}-${String(maxDay).padStart(2, "0")}T23:59:59`;

      // Fetch GHL calendars assigned to this user
      let calendars: CalendarItem[] = [];
      try {
        calendars = await getCalendars();
      } catch {
        return NextResponse.json({ error: "Failed to fetch GHL calendars" }, { status: 500 });
      }

      const userCalendars = calendars.filter((c) =>
        c.teamMembers?.some((tm) => tm.userId === ghlUserId)
      );

      if (userCalendars.length === 0) {
        return NextResponse.json({ synced: 0, message: "No calendars found for this user" });
      }

      // Fetch events from all user calendars
      const allEvents: CalendarEvent[] = [];
      for (const cal of userCalendars) {
        try {
          const events = await getCalendarEvents(cal.id, from, to);
          allEvents.push(...events);
        } catch {
          // Continue with other calendars
        }
      }

      // Filter to past events assigned to this user
      const pastEvents = allEvents.filter((ev) =>
        ev.assignedUserId === ghlUserId &&
        ev.contactId &&
        new Date(ev.startTime) < now
      );

      if (pastEvents.length === 0) {
        return NextResponse.json({ synced: 0, message: "No past meetings found for this month" });
      }

      // Fetch contact info for ALL past events (not just new ones)
      const allContactIds = [...new Set(pastEvents.map((ev) => ev.contactId).filter(Boolean))] as string[];
      const { data: contacts } = allContactIds.length > 0
        ? await supabaseAdmin.from("sales_opportunities").select("contact_id, contact_name, contact_email, contact_phone, id").in("contact_id", allContactIds)
        : { data: [] as { contact_id: string; contact_name: string; contact_email: string; contact_phone: string; id: string }[] };

      const contactMap = new Map<string, { contact_name: string; contact_email: string; contact_phone: string; id: string }>();
      (contacts || []).forEach((c: { contact_id: string; contact_name: string; contact_email: string; contact_phone: string; id: string }) => {
        contactMap.set(c.contact_id, c);
      });

      // Build rows for ALL past events — upsert will update existing + insert new
      const rows = pastEvents.map((ev) => {
        const contact = ev.contactId ? contactMap.get(ev.contactId) : null;
        return {
          sales_rep_id: syncRepId,
          opportunity_id: contact?.id || null,
          contact_id: ev.contactId || "",
          calendar_event_id: ev.id,
          meet_date: ev.startTime,
          contact_name: contact?.contact_name || "",
          contact_email: contact?.contact_email || "",
          contact_phone: contact?.contact_phone || "",
          meeting_link: ev.address || null,
          created_by: result.auth.userId,
        };
      });

      const { data: inserted, error } = await supabaseAdmin
        .from("sales_meeting_analysis")
        .upsert(rows, { onConflict: "calendar_event_id" })
        .select();

      if (error) throw error;

      return NextResponse.json({
        synced: (inserted || []).length,
        message: `Synced ${(inserted || []).length} meetings`,
      });
    } catch (error: unknown) {
      const e = error as { message?: string; details?: string; hint?: string; code?: string };
    console.error("SALES ROUTE ERROR in meeting-analysis-sheet:", e.message, "| details:", e.details, "| hint:", e.hint, "| code:", e.code);
    const message = e.message || "Failed to sync meetings";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ── Regular create ──
  try {
    const body = await req.json();
    // Sanitize TEXT NOT NULL fields — null violates NOT NULL constraint
    if (body.contact_id === null || body.contact_id === undefined) body.contact_id = "";
    if (body.contact_name === null || body.contact_name === undefined) body.contact_name = "";
    if (body.contact_email === null || body.contact_email === undefined) body.contact_email = "";
    if (body.contact_phone === null || body.contact_phone === undefined) body.contact_phone = "";
    const { data, error } = await supabaseAdmin
      .from("sales_meeting_analysis")
      .insert(body)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (error: unknown) {
    const e = error as { message?: string; details?: string; hint?: string; code?: string };
    console.error("SALES ROUTE ERROR in meeting-analysis-sheet:", e.message, "| details:", e.details, "| hint:", e.hint, "| code:", e.code);
    const message = e.message || "Failed to create entry";
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
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const allowed = await verifyScopeAccess(result.scope, "sales_meeting_analysis", id, "created_by");
    if (!allowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from("sales_meeting_analysis")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (error: unknown) {
    const e = error as { message?: string; details?: string; hint?: string; code?: string };
    console.error("SALES ROUTE ERROR in meeting-analysis-sheet:", e.message, "| details:", e.details, "| hint:", e.hint, "| code:", e.code);
    const message = e.message || "Failed to update entry";
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
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const allowed = await verifyScopeAccess(result.scope, "sales_meeting_analysis", id, "created_by");
    if (!allowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });

    const { error } = await supabaseAdmin
      .from("sales_meeting_analysis")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const e = error as { message?: string; details?: string; hint?: string; code?: string };
    console.error("SALES ROUTE ERROR in meeting-analysis-sheet:", e.message, "| details:", e.details, "| hint:", e.hint, "| code:", e.code);
    const message = e.message || "Failed to delete entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
