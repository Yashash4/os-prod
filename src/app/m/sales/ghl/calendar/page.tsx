"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  Search,
  Calendar as CalendarIcon,
  Phone,
  Mail,
  Video,
  User,
  Users,
  Globe,
  FileText,
  ClipboardList,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────── */

interface CalendarItem {
  id: string;
  name: string;
  teamMembers?: { userId: string }[];
}

interface GHLUser {
  id: string;
  name: string;
  email: string;
}

interface CalendarEvent {
  id: string;
  title?: string;
  calendarId: string;
  startTime: string;
  endTime: string;
  appointmentStatus?: string;
  assignedUserId?: string;
  contactId?: string;
  address?: string;
  createdBy?: { source?: string; userId?: string | null };
}

interface ContactInfo {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

interface FormSubmission {
  id: string;
  contactId: string;
  formId: string;
  name?: string;
  email?: string;
  others?: Record<string, string>;
  createdAt?: string;
}

type DetailTab = "details" | "form";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const EVENT_COLORS = [
  "bg-amber-400 text-amber-950",
  "bg-blue-400 text-blue-950",
  "bg-green-400 text-green-950",
  "bg-purple-400 text-purple-950",
  "bg-red-400 text-red-950",
  "bg-cyan-400 text-cyan-950",
  "bg-pink-400 text-pink-950",
  "bg-orange-400 text-orange-950",
];

const EVENT_BG_COLORS = [
  "border-amber-400",
  "border-blue-400",
  "border-green-400",
  "border-purple-400",
  "border-red-400",
  "border-cyan-400",
  "border-pink-400",
  "border-orange-400",
];

/* ── Helpers ───────────────────────────────────────── */

function getWeekDates(baseDate: Date) {
  const start = new Date(baseDate);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function getMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = [];

  for (let i = 0; i < startDay; i++) week.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(new Date(year, month, d));
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

function formatHour(h: number) {
  if (h === 0) return "12AM";
  if (h < 12) return `${h}AM`;
  if (h === 12) return "12PM";
  return `${h - 12}PM`;
}

function formatTime(d: Date) {
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatFullDate(d: Date) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function statusColor(status?: string) {
  switch (status?.toLowerCase()) {
    case "confirmed":
      return "bg-green-500/15 text-green-400 border-green-500/30";
    case "showed":
      return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "noshow":
    case "no_show":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    case "cancelled":
      return "bg-gray-500/15 text-gray-400 border-gray-500/30";
    default:
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  }
}

function statusLabel(status?: string) {
  switch (status?.toLowerCase()) {
    case "confirmed":
      return "Confirmed";
    case "showed":
      return "Showed";
    case "noshow":
    case "no_show":
      return "No Show";
    case "cancelled":
      return "Cancelled";
    default:
      return status || "Booked";
  }
}

/* ── Hover Tooltip Component ──────────────────────── */

function EventTooltip({
  event,
  rect,
  calendarName,
}: {
  event: CalendarEvent;
  rect: DOMRect;
  calendarName: string;
}) {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);

  return (
    <div
      className="fixed z-[100] pointer-events-none"
      style={{
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
        transform: "translate(-50%, -100%)",
      }}
    >
      <div className="bg-[#1a1a2e] border border-border rounded-lg shadow-xl px-3 py-2.5 max-w-[280px]">
        <p className="text-xs font-semibold text-foreground truncate mb-1">
          {event.title || "Appointment"}
        </p>
        <p className="text-[11px] text-muted mb-1.5">
          {formatTime(start)} - {formatTime(end)} (IST)
        </p>
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <CalendarIcon className="w-3 h-3" />
          <span>{calendarName || "Appointment"}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ────────────────────────────────── */

export default function CalendarPage() {
  const [calendars, setCalendars] = useState<CalendarItem[]>([]);
  const [users, setUsers] = useState<GHLUser[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [error, setError] = useState("");

  const [view] = useState("month");
  const [baseDate, setBaseDate] = useState(() => new Date());
  const [showSidebar, setShowSidebar] = useState(true);

  // Filters
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedCalendars, setSelectedCalendars] = useState<Set<string>>(
    new Set()
  );
  const [filterSearch, setFilterSearch] = useState("");
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [showAllCalendars, setShowAllCalendars] = useState(false);

  // Hover tooltip
  const [hoveredEvent, setHoveredEvent] = useState<CalendarEvent | null>(null);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detail panel (click)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  const [contactLoading, setContactLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("details");
  const [formSubmissions, setFormSubmissions] = useState<FormSubmission[]>([]);
  const [formLoading, setFormLoading] = useState(false);

  const today = useMemo(() => new Date(), []);

  /* ── Fetch initial data ──────────────────────────── */
  useEffect(() => {
    async function init() {
      try {
        const [calRes, userRes] = await Promise.all([
          fetch("/api/ghl/calendars"),
          fetch("/api/ghl/users"),
        ]);
        const calData = await calRes.json();
        const userData = await userRes.json();

        if (calData.error) throw new Error(calData.error);

        const cals = calData.calendars || [];
        const usrs = userData.users || [];

        setCalendars(cals);
        setUsers(usrs);

        // Default: only "Apex Fashion Lab" calendar, all users
        const apexCal = cals.find(
          (c: CalendarItem) => c.name.toLowerCase() === "apex fashion lab"
        );
        setSelectedCalendars(
          new Set(apexCal ? [apexCal.id] : [cals[0]?.id].filter(Boolean))
        );
        setSelectedUsers(new Set(usrs.map((u: GHLUser) => u.id)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  /* ── Compute date range based on view ────────────── */
  const { rangeStart, rangeEnd, weekDates, monthGrid } = useMemo(() => {
    let start: Date, end: Date;
    let wDates: Date[] = [];
    let mGrid: (Date | null)[][] = [];

    if (view === "day") {
      start = new Date(baseDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(baseDate);
      end.setHours(23, 59, 59, 999);
    } else if (view === "week") {
      wDates = getWeekDates(baseDate);
      start = new Date(wDates[0]);
      start.setHours(0, 0, 0, 0);
      end = new Date(wDates[6]);
      end.setHours(23, 59, 59, 999);
    } else {
      mGrid = getMonthGrid(baseDate.getFullYear(), baseDate.getMonth());
      start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
      end = new Date(
        baseDate.getFullYear(),
        baseDate.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      );
    }

    return {
      rangeStart: start,
      rangeEnd: end,
      weekDates: wDates,
      monthGrid: mGrid,
    };
  }, [view, baseDate]);

  /* ── Fetch events when range or selected calendars change ── */
  useEffect(() => {
    if (calendars.length === 0 || selectedCalendars.size === 0) {
      setEvents([]);
      return;
    }

    async function fetchEvents() {
      setEventsLoading(true);
      try {
        const cals = calendars.filter((c) => selectedCalendars.has(c.id));
        const allEvents: CalendarEvent[] = [];

        // Fetch in parallel, batches of 5
        for (let i = 0; i < cals.length; i += 5) {
          const batch = cals.slice(i, i + 5);
          const results = await Promise.all(
            batch.map((cal) =>
              fetch(
                `/api/ghl/calendar-events?calendarId=${cal.id}&startTime=${rangeStart.toISOString()}&endTime=${rangeEnd.toISOString()}`
              ).then((r) => r.json())
            )
          );
          results.forEach((data) => {
            if (data.events) allEvents.push(...data.events);
          });
        }
        setEvents(allEvents);
      } catch (err) {
        console.error("Failed to fetch events:", err);
      } finally {
        setEventsLoading(false);
      }
    }
    fetchEvents();
  }, [calendars, selectedCalendars, rangeStart, rangeEnd]);

  /* ── Fetch contact info + form submissions when event is selected ── */
  useEffect(() => {
    if (!selectedEvent?.contactId) {
      setContactInfo(null);
      setFormSubmissions([]);
      return;
    }

    async function fetchContact() {
      setContactLoading(true);
      try {
        const res = await fetch(
          `/api/ghl/contacts?contactId=${selectedEvent!.contactId}`
        );
        const data = await res.json();
        if (data.contact) {
          setContactInfo(data.contact);
        }
      } catch {
        // Contact fetch failed - show what we have
      } finally {
        setContactLoading(false);
      }
    }

    async function fetchFormSubmissions() {
      setFormLoading(true);
      try {
        const res = await fetch(
          `/api/ghl/form-submissions?contactId=${selectedEvent!.contactId}`
        );
        const data = await res.json();
        if (data.submissions) {
          setFormSubmissions(data.submissions);
        }
      } catch {
        // Form submission fetch failed
      } finally {
        setFormLoading(false);
      }
    }

    fetchContact();
    fetchFormSubmissions();
  }, [selectedEvent]);

  /* ── Filtered events ─────────────────────────────── */
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (!selectedCalendars.has(ev.calendarId)) return false;
      if (
        ev.assignedUserId &&
        selectedUsers.size > 0 &&
        !selectedUsers.has(ev.assignedUserId)
      )
        return false;
      return true;
    });
  }, [events, selectedCalendars, selectedUsers]);

  /* ── Event color by calendar ─────────────────────── */
  const calColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    calendars.forEach((c, i) => {
      map[c.id] = EVENT_COLORS[i % EVENT_COLORS.length];
    });
    return map;
  }, [calendars]);

  const calBorderMap = useMemo(() => {
    const map: Record<string, string> = {};
    calendars.forEach((c, i) => {
      map[c.id] = EVENT_BG_COLORS[i % EVENT_BG_COLORS.length];
    });
    return map;
  }, [calendars]);

  /* ── Calendar name lookup ────────────────────────── */
  const calNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    calendars.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [calendars]);

  /* ── User name lookup ────────────────────────────── */
  const userNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach((u) => {
      map[u.id] = u.name;
    });
    return map;
  }, [users]);

  /* ── Navigation ──────────────────────────────────── */
  const navigate = useCallback(
    (dir: -1 | 1) => {
      setBaseDate((prev) => {
        const d = new Date(prev);
        if (view === "day") d.setDate(d.getDate() + dir);
        else if (view === "week") d.setDate(d.getDate() + dir * 7);
        else d.setMonth(d.getMonth() + dir);
        return d;
      });
    },
    [view]
  );

  function goToday() {
    setBaseDate(new Date());
  }

  /* ── Header label ────────────────────────────────── */
  const headerLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    });
    if (view === "day") {
      return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(baseDate);
    }
    if (view === "week") {
      const wk = getWeekDates(baseDate);
      const s = wk[0],
        e = wk[6];
      const mfmt = new Intl.DateTimeFormat("en-US", { month: "short" });
      if (s.getMonth() === e.getMonth()) {
        return `${mfmt.format(s)} ${s.getDate()} – ${e.getDate()}, ${s.getFullYear()}`;
      }
      return `${mfmt.format(s)} ${s.getDate()} – ${mfmt.format(e)} ${e.getDate()}, ${e.getFullYear()}`;
    }
    return fmt.format(baseDate);
  }, [view, baseDate]);

  /* ── Get events for a specific day + hour ──────────── */
  function getEventsAt(day: Date, hour: number) {
    return filteredEvents.filter((ev) => {
      const start = new Date(ev.startTime);
      return isSameDay(start, day) && start.getHours() === hour;
    });
  }

  function getEventsForDay(day: Date) {
    return filteredEvents.filter((ev) =>
      isSameDay(new Date(ev.startTime), day)
    );
  }

  /* ── Toggle helpers ──────────────────────────────── */
  function toggleUser(id: string) {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCalendar(id: string) {
    setSelectedCalendars((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearFilters() {
    setSelectedUsers(new Set());
    setSelectedCalendars(new Set());
  }

  /* ── Event hover/click handlers ──────────────────── */
  function handleEventMouseEnter(ev: CalendarEvent, e: React.MouseEvent) {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    hoverTimeout.current = setTimeout(() => {
      setHoveredEvent(ev);
      setHoverRect(rect);
    }, 200);
  }

  function handleEventMouseLeave() {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setHoveredEvent(null);
    setHoverRect(null);
  }

  function handleEventClick(ev: CalendarEvent) {
    setHoveredEvent(null);
    setHoverRect(null);
    setSelectedEvent(ev);
    setContactInfo(null);
    setFormSubmissions([]);
    setDetailTab("details");
  }

  /* ── Filtered filter lists ───────────────────────── */
  const filteredUsers = filterSearch
    ? users.filter((u) =>
        u.name.toLowerCase().includes(filterSearch.toLowerCase())
      )
    : users;
  const filteredCalendarsList = filterSearch
    ? calendars.filter((c) =>
        c.name.toLowerCase().includes(filterSearch.toLowerCase())
      )
    : calendars;

  const displayUsers = showAllUsers
    ? filteredUsers
    : filteredUsers.slice(0, 5);
  const displayCalendars = showAllCalendars
    ? filteredCalendarsList
    : filteredCalendarsList.slice(0, 5);

  /* ── Event chip render helper ────────────────────── */
  function renderEventChip(
    ev: CalendarEvent,
    size: "sm" | "md" = "sm"
  ) {
    const textSize = size === "sm" ? "text-[10px]" : "text-[11px]";
    const padding = size === "sm" ? "px-1 py-0.5" : "px-2 py-1";
    return (
      <div
        key={ev.id}
        className={`${textSize} ${padding} rounded mb-0.5 truncate font-medium cursor-pointer transition-opacity hover:opacity-80 ${calColorMap[ev.calendarId] || "bg-amber-400 text-amber-950"}`}
        onMouseEnter={(e) => handleEventMouseEnter(ev, e)}
        onMouseLeave={handleEventMouseLeave}
        onClick={(e) => {
          e.stopPropagation();
          handleEventClick(ev);
        }}
      >
        {size === "md" && formatTime(new Date(ev.startTime)) + " "}
        {ev.title || "Appointment"}
      </div>
    );
  }

  /* ── Render ──────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-48px)] overflow-hidden">
      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={goToday}
              className="px-3 py-1.5 text-xs border border-border rounded-lg text-foreground hover:bg-surface-hover transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => navigate(-1)}
              className="p-1 hover:bg-surface-hover rounded transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-muted" />
            </button>
            <button
              onClick={() => navigate(1)}
              className="p-1 hover:bg-surface-hover rounded transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-muted" />
            </button>
            <span className="text-sm text-foreground font-medium">
              {headerLabel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Read-only badge */}
            <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Read Only
            </span>

            {/* View label */}
            <span className="px-3 py-1.5 bg-surface border border-border rounded-lg text-foreground text-xs">
              Month View
            </span>

            <button
              onClick={() => {
                setShowSidebar(!showSidebar);
                if (selectedEvent) setSelectedEvent(null);
              }}
              className="px-3 py-1.5 text-xs border border-border rounded-lg text-foreground hover:bg-surface-hover transition-colors"
            >
              {showSidebar && !selectedEvent ? "Hide" : "Manage View"}
            </button>
          </div>
        </div>

        {/* Loading indicator */}
        {eventsLoading && (
          <div className="flex items-center justify-center py-1.5 bg-accent/5 border-b border-border">
            <Loader2 className="w-3 h-3 animate-spin text-accent mr-1.5" />
            <span className="text-[11px] text-accent">Loading events...</span>
          </div>
        )}

        {/* ── Month View ────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-border bg-surface flex-shrink-0">
              {DAY_NAMES_FULL.map((name) => (
                <div
                  key={name}
                  className="p-2 text-xs text-muted text-center border-r border-border last:border-r-0 font-medium"
                >
                  {name}
                </div>
              ))}
            </div>

            {/* Month grid - fills remaining height */}
            <div className="flex-1 flex flex-col">
              {monthGrid.map((week, wi) => (
                <div
                  key={wi}
                  className="grid grid-cols-7 border-b border-border flex-1 min-h-0"
                >
                  {week.map((day, di) => {
                    if (!day) {
                      return (
                        <div
                          key={di}
                          className="border-r border-border/50 last:border-r-0 bg-surface/50"
                        />
                      );
                    }
                    const dayEvents = getEventsForDay(day);
                    const isToday = isSameDay(day, today);

                    return (
                      <div
                        key={di}
                        className="border-r border-border/50 last:border-r-0 p-1 overflow-hidden"
                      >
                        <div
                          className={`text-xs mb-1 text-right ${isToday ? "text-accent font-bold" : "text-muted"}`}
                        >
                          {day.getDate()}
                        </div>
                        <div className="space-y-0.5">
                          {dayEvents.slice(0, 3).map((ev) => renderEventChip(ev))}
                          {dayEvents.length > 3 && (
                            <div className="text-[10px] text-muted pl-1">
                              +{dayEvents.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
      </div>

      {/* ── Hover Tooltip ──────────────────────────── */}
      {hoveredEvent && hoverRect && !selectedEvent && (
        <EventTooltip
          event={hoveredEvent}
          rect={hoverRect}
          calendarName={calNameMap[hoveredEvent.calendarId] || ""}
        />
      )}

      {/* ── Event Detail Panel (Click) ─────────────── */}
      {selectedEvent && (
        <div className="w-80 border-l border-border bg-surface flex-shrink-0 flex flex-col">
          {/* Panel Header */}
          <div className="p-4 pb-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-foreground">
                View Details
              </span>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 hover:bg-surface-hover rounded transition-colors"
              >
                <X className="w-4 h-4 text-muted" />
              </button>
            </div>

            {/* Appointment badge */}
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
              Appointment
            </span>

            {/* Title */}
            <h3 className="text-sm font-semibold text-foreground mt-3 mb-3">
              {selectedEvent.title || "Appointment"}
            </h3>

            {/* Tab Switcher */}
            <div className="flex border-b border-border -mx-4 px-4">
              <button
                onClick={() => setDetailTab("details")}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  detailTab === "details"
                    ? "border-accent text-accent"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setDetailTab("form")}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  detailTab === "form"
                    ? "border-accent text-accent"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                Form Submission
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* ── Details Tab ── */}
            {detailTab === "details" && (
              <div className="space-y-3">
                {/* Status */}
                <div className="mb-1">
                  <span
                    className={`text-[11px] px-2 py-1 rounded-full border font-medium ${statusColor(selectedEvent.appointmentStatus)}`}
                  >
                    {statusLabel(selectedEvent.appointmentStatus)}
                  </span>
                </div>

                {/* Appointment Time */}
                <DetailRow
                  icon={<CalendarIcon className="w-3.5 h-3.5" />}
                  label="Appointment Time"
                  value={`${formatFullDate(new Date(selectedEvent.startTime))}, ${formatTime(new Date(selectedEvent.startTime))} - ${formatTime(new Date(selectedEvent.endTime))} (IST)`}
                />

                {/* Contact info */}
                {contactLoading ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="w-3 h-3 animate-spin text-accent" />
                    <span className="text-[11px] text-muted">
                      Loading contact...
                    </span>
                  </div>
                ) : (
                  contactInfo && (
                    <>
                      <DetailRow
                        icon={<User className="w-3.5 h-3.5" />}
                        label="Name"
                        value={
                          contactInfo.name ||
                          `${contactInfo.firstName || ""} ${contactInfo.lastName || ""}`.trim() ||
                          "-"
                        }
                        highlight
                      />
                      {contactInfo.phone && (
                        <DetailRow
                          icon={<Phone className="w-3.5 h-3.5" />}
                          label="Phone"
                          value={contactInfo.phone}
                        />
                      )}
                      {contactInfo.email && (
                        <DetailRow
                          icon={<Mail className="w-3.5 h-3.5" />}
                          label="Email"
                          value={contactInfo.email}
                        />
                      )}
                    </>
                  )
                )}

                {/* Appointment Owner */}
                {selectedEvent.assignedUserId && (
                  <DetailRow
                    icon={<User className="w-3.5 h-3.5" />}
                    label="Appointment Owner"
                    value={
                      userNameMap[selectedEvent.assignedUserId] || "Unknown"
                    }
                  />
                )}

                {/* Join Meeting link */}
                {selectedEvent.address && (
                  <DetailRow
                    icon={<Video className="w-3.5 h-3.5" />}
                    label="Join Meeting"
                    value={selectedEvent.address}
                    isLink
                  />
                )}

                {/* Calendar */}
                <DetailRow
                  icon={<CalendarIcon className="w-3.5 h-3.5" />}
                  label="Calendar"
                  value={calNameMap[selectedEvent.calendarId] || "-"}
                />

                {/* Attendees */}
                {contactInfo && (
                  <DetailRow
                    icon={<Users className="w-3.5 h-3.5" />}
                    label="Attendees"
                    value={
                      contactInfo.name ||
                      `${contactInfo.firstName || ""} ${contactInfo.lastName || ""}`.trim() ||
                      "-"
                    }
                  />
                )}

                {/* Source */}
                {selectedEvent.createdBy?.source && (
                  <DetailRow
                    icon={<Globe className="w-3.5 h-3.5" />}
                    label="Source"
                    value={
                      selectedEvent.createdBy.source === "booking_widget"
                        ? "Booking Widget"
                        : selectedEvent.createdBy.source === "third_party"
                          ? "Third Party"
                          : selectedEvent.createdBy.source
                    }
                  />
                )}

                {/* Appointment Description */}
                <DetailRow
                  icon={<FileText className="w-3.5 h-3.5" />}
                  label="Appointment Description"
                  value={selectedEvent.title || "-"}
                />
              </div>
            )}

            {/* ── Form Submission Tab ── */}
            {detailTab === "form" && (
              <div>
                {formLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-4 h-4 animate-spin text-accent mr-2" />
                    <span className="text-xs text-muted">Loading form submissions...</span>
                  </div>
                ) : formSubmissions.length === 0 ? (
                  <div className="text-center py-8">
                    <ClipboardList className="w-8 h-8 text-muted/30 mx-auto mb-2" />
                    <p className="text-xs text-muted">No form submissions found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formSubmissions.map((sub, idx) => (
                      <div
                        key={sub.id}
                        className="border border-border rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-medium text-accent">
                            Submission {formSubmissions.length > 1 ? `#${idx + 1}` : ""}
                          </span>
                          {sub.createdAt && (
                            <span className="text-[10px] text-muted">
                              {new Date(sub.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          )}
                        </div>

                        <div className="space-y-2">
                          {/* Name */}
                          {sub.name && (
                            <div>
                              <p className="text-[10px] text-muted">Name</p>
                              <p className="text-xs text-foreground">{sub.name}</p>
                            </div>
                          )}

                          {/* Email */}
                          {sub.email && (
                            <div>
                              <p className="text-[10px] text-muted">Email</p>
                              <p className="text-xs text-foreground">{sub.email}</p>
                            </div>
                          )}

                          {/* Other fields */}
                          {sub.others &&
                            Object.entries(sub.others)
                              .filter(
                                ([key, val]) =>
                                  val &&
                                  typeof val === "string" &&
                                  val.trim() !== "" &&
                                  !key.startsWith("__") &&
                                  !key.startsWith("eventData") &&
                                  !key.startsWith("sessionSource") &&
                                  key !== "formId" &&
                                  key !== "locationId" &&
                                  key !== "contactId" &&
                                  key !== "page_url" &&
                                  key !== "ip" &&
                                  key !== "fbp" &&
                                  key !== "fbc" &&
                                  key !== "referrer" &&
                                  val.length < 200
                              )
                              .map(([key, val]) => (
                                <div key={key}>
                                  <p className="text-[10px] text-muted capitalize">
                                    {key
                                      .replace(/([A-Z])/g, " $1")
                                      .replace(/_/g, " ")
                                      .replace(/^./, (s) => s.toUpperCase())
                                      .trim()}
                                  </p>
                                  <p className="text-xs text-foreground break-words">
                                    {val}
                                  </p>
                                </div>
                              ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status bar at bottom */}
          <div className="border-t border-border px-4 py-2 flex items-center gap-2">
            <span className="text-[10px] text-muted">Status:</span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${statusColor(selectedEvent.appointmentStatus)}`}
            >
              {statusLabel(selectedEvent.appointmentStatus)}
            </span>
          </div>
        </div>
      )}

      {/* ── Right Sidebar (Manage View) ──────────────── */}
      {showSidebar && !selectedEvent && (
        <div className="w-64 border-l border-border bg-surface flex-shrink-0 overflow-y-auto">
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground">
                Manage View
              </h3>
              <button
                onClick={() => setShowSidebar(false)}
                className="p-0.5 hover:bg-surface-hover rounded"
              >
                <X className="w-4 h-4 text-muted" />
              </button>
            </div>

            {/* Filters header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted">Filters</span>
              <button
                onClick={clearFilters}
                className="text-[11px] text-accent hover:underline"
              >
                Clear all
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Search Users, Calendars or Groups"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent"
              />
            </div>

            {/* Users section */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-foreground">
                  Users
                </span>
                <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">
                  {selectedUsers.size}
                </span>
              </div>
              <div className="space-y-1">
                {displayUsers.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-2 py-0.5 cursor-pointer hover:bg-surface-hover px-1 rounded text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={() => toggleUser(user.id)}
                      className="w-3.5 h-3.5 rounded border-border accent-accent"
                    />
                    <span className="text-foreground truncate">
                      {user.name}
                    </span>
                  </label>
                ))}
              </div>
              {filteredUsers.length > 5 && (
                <button
                  onClick={() => setShowAllUsers(!showAllUsers)}
                  className="text-[11px] text-accent hover:underline mt-1 pl-1"
                >
                  {showAllUsers
                    ? "See Less"
                    : `See More (+${filteredUsers.length - 5})`}
                </button>
              )}
            </div>

            {/* Calendars section */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-foreground">
                  Calendars
                </span>
                <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">
                  {selectedCalendars.size}
                </span>
              </div>
              <div className="space-y-1">
                {displayCalendars.map((cal) => (
                  <label
                    key={cal.id}
                    className="flex items-center gap-2 py-0.5 cursor-pointer hover:bg-surface-hover px-1 rounded text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCalendars.has(cal.id)}
                      onChange={() => toggleCalendar(cal.id)}
                      className="w-3.5 h-3.5 rounded border-border accent-accent"
                    />
                    <span className="text-foreground truncate">{cal.name}</span>
                  </label>
                ))}
              </div>
              {filteredCalendarsList.length > 5 && (
                <button
                  onClick={() => setShowAllCalendars(!showAllCalendars)}
                  className="text-[11px] text-accent hover:underline mt-1 pl-1"
                >
                  {showAllCalendars
                    ? "See Less"
                    : `See More (+${filteredCalendarsList.length - 5})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Detail Row Component ──────────────────────────── */

function DetailRow({
  icon,
  label,
  value,
  isLink,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  isLink?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex gap-2.5">
      <div className="text-muted mt-0.5 flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted mb-0.5">{label}</p>
        {isLink ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:underline break-all"
          >
            Join Meeting
          </a>
        ) : (
          <p
            className={`text-xs break-words ${highlight ? "text-accent font-medium" : "text-foreground"}`}
          >
            {value}
          </p>
        )}
      </div>
    </div>
  );
}
