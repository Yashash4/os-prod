import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSubModuleAccess } from "@/lib/api-auth";
import { scopeQuery } from "@/lib/data-scope";
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

    let query = supabaseAdmin
      .from("meeting_analysis_sheet")
      .select("*")
      .eq("owner", owner)
      .order("meet_date", { ascending: false });

    if (from) query = query.gte("meet_date", from);
    if (to) query = query.lte("meet_date", to + "T23:59:59");

    query = scopeQuery(query, result.scope, "created_by");

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ records: data || [], _permissions: result.permissions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch meeting sheet";
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

      // Check existing rows to avoid duplicates
      const { data: existing } = await supabaseAdmin
        .from("meeting_analysis_sheet")
        .select("calendar_event_id")
        .eq("owner", owner)
        .gte("meet_date", `${month}-01`)
        .lte("meet_date", to);

      const existingEventIds = new Set((existing || []).map((r: { calendar_event_id: string }) => r.calendar_event_id));

      const newEvents = pastEvents.filter((ev) => !existingEventIds.has(ev.id));

      if (newEvents.length === 0) {
        return NextResponse.json({ synced: 0, message: "All meetings already synced" });
      }

      // Fetch contact info from sales_call_booked_tracking for each unique contactId
      const contactIds = [...new Set(newEvents.map((ev) => ev.contactId).filter(Boolean))] as string[];
      const { data: contacts } = await supabaseAdmin
        .from("sales_call_booked_tracking")
        .select("contact_id, contact_name, contact_email, contact_phone, opportunity_id")
        .in("contact_id", contactIds);

      const contactMap = new Map<string, { contact_name: string; contact_email: string; contact_phone: string; opportunity_id: string }>();
      (contacts || []).forEach((c: { contact_id: string; contact_name: string; contact_email: string; contact_phone: string; opportunity_id: string }) => {
        contactMap.set(c.contact_id, c);
      });

      // Build rows
      const rows = newEvents.map((ev) => {
        const contact = ev.contactId ? contactMap.get(ev.contactId) : null;
        return {
          owner,
          opportunity_id: contact?.opportunity_id || null,
          contact_id: ev.contactId || null,
          calendar_event_id: ev.id,
          meet_date: ev.startTime,
          contact_name: contact?.contact_name || null,
          contact_email: contact?.contact_email || null,
          contact_phone: contact?.contact_phone || null,
          meeting_link: ev.address || null,
          created_by: result.auth.userId,
        };
      });

      const { data: inserted, error } = await supabaseAdmin
        .from("meeting_analysis_sheet")
        .insert(rows)
        .select();

      if (error) throw error;

      return NextResponse.json({
        synced: (inserted || []).length,
        message: `Synced ${(inserted || []).length} meetings`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sync meetings";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ── Regular create ──
  try {
    const body = await req.json();
    const { data, error } = await supabaseAdmin
      .from("meeting_analysis_sheet")
      .insert(body)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create entry";
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

    const { data, error } = await supabaseAdmin
      .from("meeting_analysis_sheet")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update entry";
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

    const { error } = await supabaseAdmin
      .from("meeting_analysis_sheet")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
