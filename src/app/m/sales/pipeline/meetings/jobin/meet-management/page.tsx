"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Phone,
  Mail,
  ChevronDown,
  Search,
  Filter,
  MessageSquare,
  Star,
  Video,
  FileText,
  Calendar,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { DataTableSkeleton } from "@/components/Skeleton";

/* ── Types ─────────────────────────────────────────── */

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
}

interface CalendarItem {
  id: string;
  name: string;
  teamMembers?: { userId: string }[];
}

interface MergedRecord {
  id: string;
  opportunity_id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  pipeline_name: string;
  pipeline_id: string | null;
  stage_name: string;
  source: string;
  status: string;
  rating: number | null;
  comments: string | null;
  notes: string | null;
  assigned_to: string | null;
  contact_id: string | null;
  ghl_status: string | null;
  meet_notes: string | null;
  outcome: string | null;
  created_at: string;
  updated_at: string;
}

/* ── GHL Status Config ─────────────────────────────── */

type StatusCfg = Record<string, { label: string; color: string; bg: string }>;

const GHL_STATUS_CONFIG: StatusCfg = {
  open: { label: "Open", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  won: { label: "Won", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  lost: { label: "Lost", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  abandoned: { label: "Abandoned", color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20" },
};

const CB_STATUS_CONFIG: StatusCfg = {
  pending_review: { label: "Pending Review", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  call_done: { label: "Call Done", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  right_fit: { label: "Right Fit", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  not_a_fit: { label: "Not a Fit", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  needs_followup: { label: "Needs Follow-up", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  onboarded: { label: "Onboarded", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  declined: { label: "Declined", color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20" },
};

const ALL_GHL_STATUSES = Object.keys(GHL_STATUS_CONFIG);

/* ── Main Component ────────────────────────────────── */

export default function JobinMeetManagementPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [records, setRecords] = useState<MergedRecord[]>([]);
  const [users, setUsers] = useState<GHLUser[]>([]);
  const [jobinUserId, setJobinUserId] = useState<string | null>(null);
  const [usersLoaded, setUsersLoaded] = useState(false);

  const [eventsByContact, setEventsByContact] = useState<Record<string, CalendarEvent>>({});

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>("");

  const [editingCell, setEditingCell] = useState<{ oppId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    async function init() {
      try {
        const [usersRes, recordsRes, calRes] = await Promise.all([
          fetch("/api/ghl/users"),
          fetch("/api/sales/jobin-meet-tracking"),
          fetch("/api/ghl/calendars"),
        ]);
        const usersData = await usersRes.json();
        const recordsData = await recordsRes.json();
        const calData = await calRes.json();

        const usrs = usersData.users || [];
        setUsers(usrs);
        const jobin = usrs.find((u: GHLUser) =>
          u.name.toLowerCase().includes("jobin")
        );
        if (jobin) setJobinUserId(jobin.id);
        setUsersLoaded(true);

        if (!recordsData.error) setRecords(recordsData.records || []);

        if (jobin && calData.calendars) {
          const cals = calData.calendars as CalendarItem[];
          const jobinCals = cals.filter((c) =>
            c.teamMembers?.some((tm) => tm.userId === jobin.id)
          );
          if (jobinCals.length > 0) {
            const now = new Date();
            const start = new Date(now);
            start.setDate(start.getDate() - 90);
            const end = new Date(now);
            end.setDate(end.getDate() + 90);

            const allEvents: CalendarEvent[] = [];
            const results = await Promise.all(
              jobinCals.map((cal) =>
                fetch(
                  `/api/ghl/calendar-events?calendarId=${cal.id}&startTime=${start.toISOString()}&endTime=${end.toISOString()}`
                ).then((r) => r.json())
              )
            );
            results.forEach((data) => {
              if (data.events) allEvents.push(...data.events);
            });

            const byContact: Record<string, CalendarEvent> = {};
            allEvents
              .filter((ev) => ev.assignedUserId === jobin.id && ev.contactId)
              .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
              .forEach((ev) => {
                if (!byContact[ev.contactId!]) byContact[ev.contactId!] = ev;
              });
            setEventsByContact(byContact);
          }
        }
      } catch {
        setUsersLoaded(true);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const userNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach((u) => { map[u.id] = u.name; });
    return map;
  }, [users]);

  const jobinRecords = useMemo(() => {
    if (!usersLoaded) return [];
    if (!jobinUserId) return records;
    return records.filter((r) => r.assigned_to === jobinUserId);
  }, [records, jobinUserId, usersLoaded]);

  const updateGHLStatus = async (record: MergedRecord, newStatus: string) => {
    if (!record.pipeline_id) {
      setError("Pipeline ID missing — re-sync Call Booked in Sales Setting");
      return;
    }
    try {
      const res = await fetch("/api/ghl/opportunities", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId: record.opportunity_id,
          pipelineId: record.pipeline_id,
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setRecords((prev) =>
        prev.map((r) =>
          r.opportunity_id === record.opportunity_id ? { ...r, ghl_status: newStatus } : r
        )
      );
      await fetch("/api/sales/call-booked-tracking", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity_id: record.opportunity_id, ghl_status: newStatus }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update GHL status");
    }
  };

  const updateMeetRecord = async (oppId: string, updates: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/sales/jobin-meet-tracking", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity_id: oppId, ...updates }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRecords((prev) =>
        prev.map((r) =>
          r.opportunity_id === oppId ? { ...r, ...updates } as MergedRecord : r
        )
      );
    } catch (err) {
      console.error("Update failed:", err);
    }
  };

  const filteredRecords = useMemo(() => {
    return jobinRecords.filter((r) => {
      if (statusFilter !== "all" && (r.ghl_status || "open") !== statusFilter) return false;
      if (dateFilter && r.contact_id) {
        const ev = eventsByContact[r.contact_id];
        if (!ev) return false;
        const evDate = new Date(ev.startTime).toISOString().slice(0, 10);
        if (evDate !== dateFilter) return false;
      } else if (dateFilter && !r.contact_id) {
        return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          r.contact_name?.toLowerCase().includes(q) ||
          r.contact_email?.toLowerCase().includes(q) ||
          r.contact_phone?.toLowerCase().includes(q) ||
          r.source?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [jobinRecords, statusFilter, searchQuery, dateFilter, eventsByContact]);

  const statusCounts = useMemo(() => {
    return ALL_GHL_STATUSES.reduce((a, s) => {
      a[s] = jobinRecords.filter((r) => (r.ghl_status || "open") === s).length;
      return a;
    }, {} as Record<string, number>);
  }, [jobinRecords]);

  function startEdit(oppId: string, field: string, currentValue: string) {
    setEditingCell({ oppId, field });
    setEditValue(currentValue || "");
  }
  function commitEdit() {
    if (editingCell) {
      updateMeetRecord(editingCell.oppId, { [editingCell.field]: editValue });
      setEditingCell(null);
      setEditValue("");
    }
  }
  function cancelEdit() {
    setEditingCell(null);
    setEditValue("");
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-bold text-foreground tracking-tight">Meet Management</h1>
        <DataTableSkeleton cols={16} />
      </div>
    );
  }

  const COLUMNS = [
    { key: "sno", label: "#", width: "w-10" },
    { key: "contact_name", label: "Contact Name", width: "w-40" },
    { key: "contact_email", label: "Email", width: "w-44" },
    { key: "contact_phone", label: "Phone", width: "w-36" },
    { key: "source", label: "Source", width: "w-28" },
    { key: "meet_date", label: "Meet Date", width: "w-40" },
    { key: "meet_link", label: "Meeting Link", width: "w-32" },
    { key: "ghl_status", label: "GHL Status", width: "w-36" },
    { key: "setter_status", label: "Setter Status", width: "w-36" },
    { key: "setter_rating", label: "Rating", width: "w-24" },
    { key: "setter_notes", label: "Setter Notes", width: "w-44" },
    { key: "setter_comments", label: "Setter Comments", width: "w-44" },
    { key: "meet_notes", label: "Meet Notes", width: "w-48" },
    { key: "outcome", label: "Outcome", width: "w-44" },
    { key: "form_details", label: "Form", width: "w-24" },
    { key: "actions", label: "Actions", width: "w-24" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex-shrink-0 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-accent rounded-full" />
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Meet Management</h1>
              <p className="text-muted text-xs mt-0.5">
              Jobin&apos;s leads from Call Booked — {jobinRecords.length} leads
              {jobinUserId && <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">Owner: {userNameMap[jobinUserId] || "Jobin"}</span>}
              {!jobinUserId && users.length > 0 && <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">Jobin user not found — showing all</span>}
            </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20 flex items-center justify-between">
          {error}
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-300 text-xs ml-4">Dismiss</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="px-6 py-3 flex items-center gap-3 flex-shrink-0 border-b border-border/50 bg-surface/50">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input type="text" placeholder="Search by name, email, phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent placeholder:text-muted/50" />
        </div>
        <button
          onClick={() => setDateFilter(dateFilter === new Date().toISOString().slice(0, 10) ? "" : new Date().toISOString().slice(0, 10))}
          className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm transition-colors ${
            dateFilter === new Date().toISOString().slice(0, 10)
              ? "bg-accent/10 border-accent/30 text-accent"
              : "bg-surface border-border text-foreground hover:border-accent/30"
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          Today
        </button>
        <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
          className="px-2 py-1.5 bg-surface border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-accent [color-scheme:dark]" />
        {dateFilter && (
          <button onClick={() => setDateFilter("")} className="text-[11px] text-accent hover:underline">Clear date</button>
        )}

        <div className="relative">
          <button onClick={() => setShowFilterDropdown(!showFilterDropdown)} className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-foreground hover:border-accent/30 transition-colors">
            <Filter className="w-3.5 h-3.5 text-muted" />
            {statusFilter === "all" ? "All Statuses" : GHL_STATUS_CONFIG[statusFilter]?.label}
            <ChevronDown className="w-3 h-3 text-muted" />
          </button>
          {showFilterDropdown && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-surface border border-border rounded-lg shadow-xl z-20 py-1">
              <button onClick={() => { setStatusFilter("all"); setShowFilterDropdown(false); }} className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${statusFilter === "all" ? "text-accent bg-accent/5" : "text-foreground hover:bg-surface-hover"}`}>
                All Statuses ({jobinRecords.length})
              </button>
              {ALL_GHL_STATUSES.map((s) => (
                <button key={s} onClick={() => { setStatusFilter(s); setShowFilterDropdown(false); }}
                  className={`w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center justify-between ${statusFilter === s ? "text-accent bg-accent/5" : "text-foreground hover:bg-surface-hover"}`}>
                  <span className={GHL_STATUS_CONFIG[s].color}>{GHL_STATUS_CONFIG[s].label}</span>
                  <span className="text-muted text-xs">{statusCounts[s] || 0}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="text-xs text-muted ml-auto">Showing {filteredRecords.length} of {jobinRecords.length}</span>
      </div>

      {/* Status Pills */}
      <div className="px-6 py-2 flex gap-2 flex-wrap flex-shrink-0 border-b border-border/50">
        {ALL_GHL_STATUSES.map((s) => (
          <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
            className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-colors ${statusFilter === s ? GHL_STATUS_CONFIG[s].bg + " " + GHL_STATUS_CONFIG[s].color : "border-border text-muted hover:border-border/80"}`}>
            {GHL_STATUS_CONFIG[s].label}
            <span>{statusCounts[s] || 0}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse min-w-[1800px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface/80 border-b border-border/50">
              {COLUMNS.map((col) => (
                <th key={col.key} className={`${col.width} text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5 border-r border-border last:border-r-0`}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="text-center py-16 text-muted text-sm">
                  {jobinRecords.length === 0
                    ? 'No leads assigned to Jobin yet. Make sure Call Booked data is synced in Sales Setting.'
                    : "No records match your filters."}
                </td>
              </tr>
            ) : filteredRecords.map((record, idx) => (
              <tr key={record.opportunity_id} className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors group">
                <td className="px-3 py-2 text-xs text-muted border-r border-border">{idx + 1}</td>
                <td className="px-3 py-2 text-xs text-foreground font-medium border-r border-border">{record.contact_name || "-"}</td>
                <td className="px-3 py-2 text-xs text-foreground border-r border-border">
                  {record.contact_email ? <a href={`mailto:${record.contact_email}`} className="hover:text-accent transition-colors">{record.contact_email}</a> : <span className="text-muted">-</span>}
                </td>
                <td className="px-3 py-2 text-xs text-foreground border-r border-border">
                  {record.contact_phone ? <a href={`tel:${record.contact_phone}`} className="hover:text-accent transition-colors">{record.contact_phone}</a> : <span className="text-muted">-</span>}
                </td>
                <td className="px-3 py-2 text-xs text-foreground border-r border-border">{record.source || "-"}</td>

                {/* Meet Date */}
                <td className="px-3 py-2 text-xs border-r border-border">
                  {(() => {
                    const ev = record.contact_id ? eventsByContact[record.contact_id] : null;
                    if (!ev) return <span className="text-muted/40">-</span>;
                    const d = new Date(ev.startTime);
                    const end = new Date(ev.endTime);
                    return (
                      <div>
                        <div className="text-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-muted" />
                          {d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                        <div className="text-muted text-[10px] mt-0.5">
                          {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} - {end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </div>
                        {ev.appointmentStatus && (
                          <span className={`text-[9px] mt-0.5 inline-block px-1.5 py-0.5 rounded ${
                            ev.appointmentStatus === "confirmed" ? "bg-green-500/10 text-green-400" :
                            ev.appointmentStatus === "showed" ? "bg-blue-500/10 text-blue-400" :
                            ev.appointmentStatus === "noshow" || ev.appointmentStatus === "no_show" ? "bg-red-500/10 text-red-400" :
                            "bg-amber-500/10 text-amber-400"
                          }`}>
                            {ev.appointmentStatus === "noshow" || ev.appointmentStatus === "no_show" ? "No Show" : ev.appointmentStatus.charAt(0).toUpperCase() + ev.appointmentStatus.slice(1)}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </td>

                {/* Meeting Link */}
                <td className="px-3 py-2 text-xs border-r border-border">
                  {(() => {
                    const ev = record.contact_id ? eventsByContact[record.contact_id] : null;
                    if (!ev?.address) return <span className="text-muted/40">-</span>;
                    return (
                      <a href={ev.address} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-accent hover:underline">
                        <Video className="w-3.5 h-3.5" />
                        Join
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    );
                  })()}
                </td>

                {/* GHL Status */}
                <td className="px-2 py-1.5 border-r border-border">
                  <GHLStatusDropdown current={record.ghl_status || "open"} onChange={(s) => updateGHLStatus(record, s)} />
                </td>

                {/* Setter Status */}
                <td className="px-2 py-1.5 border-r border-border">
                  <StatusBadge status={record.status} config={CB_STATUS_CONFIG} />
                </td>

                {/* Setter Rating */}
                <td className="px-2 py-1.5 border-r border-border">
                  <ReadOnlyStars value={record.rating || 0} />
                </td>

                {/* Setter Notes */}
                <td className="px-3 py-2 text-xs border-r border-border">
                  <span className={record.notes ? "text-foreground" : "text-muted/40 italic"}>{record.notes || "-"}</span>
                </td>

                {/* Setter Comments */}
                <td className="px-3 py-2 text-xs border-r border-border">
                  <span className={record.comments ? "text-foreground" : "text-muted/40 italic"}>{record.comments || "-"}</span>
                </td>

                {/* Meet Notes (editable) */}
                <td className="px-3 py-2 text-xs border-r border-border cursor-pointer" onClick={() => startEdit(record.opportunity_id, "meet_notes", record.meet_notes || "")}>
                  {editingCell?.oppId === record.opportunity_id && editingCell?.field === "meet_notes" ? (
                    <input autoFocus type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit}
                      onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                      className="w-full bg-background border border-accent rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none" />
                  ) : (
                    <span className={record.meet_notes ? "text-foreground" : "text-muted/40 italic"}>{record.meet_notes || "Click to add..."}</span>
                  )}
                </td>

                {/* Outcome (editable) */}
                <td className="px-3 py-2 text-xs border-r border-border cursor-pointer" onClick={() => startEdit(record.opportunity_id, "outcome", record.outcome || "")}>
                  {editingCell?.oppId === record.opportunity_id && editingCell?.field === "outcome" ? (
                    <input autoFocus type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit}
                      onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                      className="w-full bg-background border border-accent rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none" />
                  ) : (
                    <span className={record.outcome ? "text-foreground" : "text-muted/40 italic"}>{record.outcome || "Click to add..."}</span>
                  )}
                </td>

                {/* Form Details */}
                <td className="px-3 py-2 border-r border-border">
                  {(() => {
                    const ev = record.contact_id ? eventsByContact[record.contact_id] : null;
                    if (!ev) return <span className="text-muted/40">-</span>;
                    return (
                      <Link
                        href={`/m/sales/pipeline/meetings/jobin/calendar?eventId=${ev.id}&tab=form`}
                        className="inline-flex items-center gap-1 text-accent hover:underline text-[11px]"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        View
                      </Link>
                    );
                  })()}
                </td>

                {/* Actions */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {record.contact_phone && <a href={`tel:${record.contact_phone}`} className="p-1 rounded hover:bg-green-500/10 text-muted hover:text-green-400 transition-colors" title="Call"><Phone className="w-3.5 h-3.5" /></a>}
                    {record.contact_email && <a href={`mailto:${record.contact_email}`} className="p-1 rounded hover:bg-blue-500/10 text-muted hover:text-blue-400 transition-colors" title="Email"><Mail className="w-3.5 h-3.5" /></a>}
                    {record.contact_phone && <a href={`https://wa.me/${record.contact_phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-green-500/10 text-muted hover:text-green-400 transition-colors" title="WhatsApp"><MessageSquare className="w-3.5 h-3.5" /></a>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Status Badge ────────────────────────────────────── */

function StatusBadge({ status, config }: { status: string; config: StatusCfg }) {
  const cfg = config[status] || { label: status, color: "text-muted", bg: "bg-surface border-border" };
  return (
    <span className={`inline-flex text-[11px] font-medium px-2.5 py-1.5 rounded-md border ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

/* ── Read-Only Stars ──────────────────────────────────── */

function ReadOnlyStars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-3.5 h-3.5 ${
            star <= value ? "text-yellow-400 fill-yellow-400" : "text-muted/30"
          }`}
        />
      ))}
    </div>
  );
}

/* ── GHL Status Dropdown ─────────────────────────────── */

function GHLStatusDropdown({ current, onChange }: { current: string; onChange: (status: string) => void }) {
  const [open, setOpen] = useState(false);
  const config = GHL_STATUS_CONFIG[current] || { label: current, color: "text-muted", bg: "bg-surface border-border" };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className={`w-full flex items-center justify-between gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md border ${config.bg} ${config.color} transition-colors`}>
        {config.label}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-44 bg-surface border border-border rounded-lg shadow-xl z-30 py-1">
            {ALL_GHL_STATUSES.map((s) => (
              <button key={s} onClick={() => { onChange(s); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${current === s ? "bg-accent/5 font-medium" : "hover:bg-surface-hover"} ${GHL_STATUS_CONFIG[s].color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${GHL_STATUS_CONFIG[s].color.replace("text-", "bg-")}`} />
                {GHL_STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
