"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Search,
  Phone,
  Mail,
  Star,
  ChevronDown,
  Filter,
  MessageSquare,
} from "lucide-react";
import { DataTableSkeleton } from "@/components/Skeleton";
import { apiFetch } from "@/lib/api-fetch";

/* ── Types ─────────────────────────────────────────── */

interface OnboardingRecord {
  opportunity_id: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  source_rep?: string;
  assigned_to?: string;
  pipeline_name?: string;
  source?: string;
  fees_quoted?: number;
  fees_collected?: number;
  onboarding_status: string;
  assigned_onboarder?: string;
  meeting_date?: string;
  meeting_notes?: string;
  brand_rating?: number;
  brand_description?: string;
  client_notes?: string;
  checklist?: ChecklistItem[];
  follow_up_date?: string;
  created_at?: string;
  updated_at?: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

/* ── Status Configs ──────────────────────────────────── */

type StatusCfg = Record<string, { label: string; color: string; bg: string }>;

const ONBOARDING_STATUS_CONFIG: StatusCfg = {
  scheduled: { label: "Scheduled", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  in_progress: { label: "In Progress", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  completed: { label: "Completed", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  on_hold: { label: "On Hold", color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20" },
};

const ALL_STATUSES = Object.keys(ONBOARDING_STATUS_CONFIG);

/* ── Main Component ────────────────────────────────── */

export default function OnboardingManagementPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [records, setRecords] = useState<OnboardingRecord[]>([]);
  const [userNameMap, setUserNameMap] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Inline editing
  const [editingCell, setEditingCell] = useState<{ oppId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  /* ── Fetch data ───────────────────────────────── */

  useEffect(() => {
    async function init() {
      try {
        const [onboardRes, usersRes] = await Promise.all([
          apiFetch("/api/sales/onboarding-tracking"),
          apiFetch("/api/ghl/users"),
        ]);
        const [onboardData, usersData] = await Promise.all([
          onboardRes.json(),
          usersRes.json(),
        ]);

        setRecords(onboardData.records || []);

        // Build GHL user ID → name map
        const nameMap: Record<string, string> = {};
        (usersData.users || []).forEach((u: { id: string; name: string }) => {
          nameMap[u.id] = u.name;
        });
        setUserNameMap(nameMap);
      } catch {
        setError("Failed to load onboarding data");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  /* ── Derived data ──────────────────────────────── */

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (statusFilter !== "all" && r.onboarding_status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          r.contact_name?.toLowerCase().includes(q) ||
          r.contact_email?.toLowerCase().includes(q) ||
          r.contact_phone?.toLowerCase().includes(q) ||
          resolveRep(r)?.toLowerCase().includes(q) ||
          r.assigned_onboarder?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, statusFilter, searchQuery, userNameMap]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    ALL_STATUSES.forEach((s) => {
      counts[s] = records.filter((r) => r.onboarding_status === s).length;
    });
    return counts;
  }, [records]);

  /* ── Resolve rep name from assigned_to or source_rep ── */

  function resolveRep(record: OnboardingRecord): string {
    const id = record.assigned_to || record.source_rep;
    if (!id) return "-";
    return userNameMap[id] || id;
  }

  /* ── Inline edit helpers ────────────────────────── */

  function startEdit(oppId: string, field: string, currentValue: string) {
    setEditingCell({ oppId, field });
    setEditValue(currentValue || "");
  }

  function commitEdit() {
    if (editingCell) {
      updateRecord(editingCell.oppId, { [editingCell.field]: editValue });
      setEditingCell(null);
      setEditValue("");
    }
  }

  function cancelEdit() {
    setEditingCell(null);
    setEditValue("");
  }

  async function updateRecord(opportunityId: string, updates: Record<string, unknown>) {
    try {
      const res = await apiFetch("/api/sales/onboarding-tracking", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity_id: opportunityId, ...updates }),
      });
      const data = await res.json();
      if (data.record) {
        setRecords((prev) =>
          prev.map((r) => (r.opportunity_id === opportunityId ? { ...r, ...data.record } : r))
        );
      }
    } catch {
      setError("Failed to update record");
    }
  }

  /* ── Render ────────────────────────────────────── */

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-bold text-foreground tracking-tight">Onboarding Management</h1>
        <DataTableSkeleton cols={17} />
      </div>
    );
  }

  const COLUMNS = [
    { key: "sno", label: "#", width: "w-10" },
    { key: "contact_name", label: "Client Name", width: "w-40" },
    { key: "contact_email", label: "Email", width: "w-44" },
    { key: "contact_phone", label: "Phone", width: "w-36" },
    { key: "source_rep", label: "Closed By", width: "w-28" },
    { key: "onboarding_status", label: "Status", width: "w-36" },
    { key: "assigned_onboarder", label: "Onboarder", width: "w-32" },
    { key: "meeting_date", label: "Meeting Date", width: "w-32" },
    { key: "brand_rating", label: "Brand Rating", width: "w-28" },
    { key: "brand_description", label: "Brand Description", width: "w-48" },
    { key: "meeting_notes", label: "Meeting Notes", width: "w-48" },
    { key: "client_notes", label: "Client Notes", width: "w-48" },
    { key: "fees_quoted", label: "Fees Quoted", width: "w-28" },
    { key: "fees_collected", label: "Collected", width: "w-28" },
    { key: "follow_up_date", label: "Follow-up", width: "w-32" },
    { key: "checklist", label: "Checklist", width: "w-24" },
    { key: "actions", label: "Actions", width: "w-24" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex-shrink-0 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Onboarding Management</h1>
            <p className="text-muted text-xs mt-0.5">
              {records.length} won deals — auto-synced from Sales Management
            </p>
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
          <input
            type="text"
            placeholder="Search by name, email, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent placeholder:text-muted/50"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-foreground hover:border-accent/30 transition-colors"
          >
            <Filter className="w-3.5 h-3.5 text-muted" />
            {statusFilter === "all" ? "All Statuses" : ONBOARDING_STATUS_CONFIG[statusFilter]?.label}
            <ChevronDown className="w-3 h-3 text-muted" />
          </button>
          {showFilterDropdown && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowFilterDropdown(false)} />
              <div className="absolute top-full left-0 mt-1 w-48 bg-surface border border-border rounded-lg shadow-xl z-30 py-1">
                <button
                  onClick={() => { setStatusFilter("all"); setShowFilterDropdown(false); }}
                  className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${statusFilter === "all" ? "text-accent bg-accent/5" : "text-foreground hover:bg-surface-hover"}`}
                >
                  All Statuses ({records.length})
                </button>
                {ALL_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setStatusFilter(s); setShowFilterDropdown(false); }}
                    className={`w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center justify-between ${statusFilter === s ? "text-accent bg-accent/5" : "text-foreground hover:bg-surface-hover"}`}
                  >
                    <span className={ONBOARDING_STATUS_CONFIG[s].color}>{ONBOARDING_STATUS_CONFIG[s].label}</span>
                    <span className="text-muted text-xs">{statusCounts[s] || 0}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <span className="text-xs text-muted ml-auto">Showing {filteredRecords.length} of {records.length}</span>
      </div>

      {/* Status Pills */}
      <div className="px-6 py-2 flex gap-2 flex-wrap flex-shrink-0 border-b border-border/50">
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
            className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
              statusFilter === s
                ? ONBOARDING_STATUS_CONFIG[s].bg + " " + ONBOARDING_STATUS_CONFIG[s].color
                : "border-border text-muted hover:border-border/80"
            }`}
          >
            {ONBOARDING_STATUS_CONFIG[s].label}
            <span>{statusCounts[s] || 0}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse min-w-[2200px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface/80 border-b border-border/50">
              {COLUMNS.map((col) => (
                <th key={col.key} className={`${col.width} text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5 border-r border-border last:border-r-0`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="text-center py-16 text-muted text-sm">
                  {records.length === 0
                    ? "No won deals yet. Deals marked as \"Won\" in Sales Management will appear here automatically."
                    : "No records match your filters."}
                </td>
              </tr>
            ) : (
              filteredRecords.map((record, idx) => {
                const checklist = record.checklist || [];
                const checkDone = checklist.filter((c) => c.done).length;
                const checkTotal = checklist.length;

                return (
                  <tr key={record.opportunity_id} className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors group">
                    {/* # */}
                    <td className="px-3 py-2 text-xs text-muted border-r border-border">{idx + 1}</td>

                    {/* Client Name */}
                    <td className="px-3 py-2 text-xs text-foreground font-medium border-r border-border">{record.contact_name || "-"}</td>

                    {/* Email */}
                    <td className="px-3 py-2 text-xs border-r border-border">
                      {record.contact_email ? (
                        <a href={`mailto:${record.contact_email}`} className="text-foreground hover:text-accent transition-colors">{record.contact_email}</a>
                      ) : <span className="text-muted/40">-</span>}
                    </td>

                    {/* Phone */}
                    <td className="px-3 py-2 text-xs border-r border-border">
                      {record.contact_phone ? (
                        <a href={`tel:${record.contact_phone}`} className="text-foreground hover:text-accent transition-colors">{record.contact_phone}</a>
                      ) : <span className="text-muted/40">-</span>}
                    </td>

                    {/* Closed By */}
                    <td className="px-3 py-2 text-xs text-foreground border-r border-border">{resolveRep(record)}</td>

                    {/* Status (dropdown) */}
                    <td className="px-2 py-1.5 border-r border-border">
                      <StatusDropdown
                        current={record.onboarding_status}
                        onChange={(s) => updateRecord(record.opportunity_id, { onboarding_status: s })}
                      />
                    </td>

                    {/* Assigned Onboarder (editable) */}
                    <td
                      className="px-3 py-2 text-xs border-r border-border cursor-pointer"
                      onClick={() => startEdit(record.opportunity_id, "assigned_onboarder", record.assigned_onboarder || "")}
                    >
                      {editingCell?.oppId === record.opportunity_id && editingCell?.field === "assigned_onboarder" ? (
                        <input autoFocus type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit} onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                          className="w-full bg-background border border-accent rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none" />
                      ) : (
                        <span className={record.assigned_onboarder ? "text-foreground" : "text-muted/40 italic"}>{record.assigned_onboarder || "Click to assign..."}</span>
                      )}
                    </td>

                    {/* Meeting Date (editable) */}
                    <td className="px-2 py-1.5 border-r border-border">
                      <input
                        type="date"
                        value={record.meeting_date || ""}
                        onChange={(e) => updateRecord(record.opportunity_id, { meeting_date: e.target.value || null })}
                        className="w-full bg-transparent border-0 text-xs text-foreground focus:outline-none [color-scheme:dark]"
                      />
                    </td>

                    {/* Brand Rating (stars) */}
                    <td className="px-2 py-1.5 border-r border-border">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            key={s}
                            onClick={() => updateRecord(record.opportunity_id, { brand_rating: s === record.brand_rating ? null : s })}
                            className="p-0"
                          >
                            <Star className={`w-3.5 h-3.5 ${s <= (record.brand_rating || 0) ? "text-amber-400 fill-amber-400" : "text-zinc-600 hover:text-zinc-400"}`} />
                          </button>
                        ))}
                      </div>
                    </td>

                    {/* Brand Description (editable) */}
                    <td
                      className="px-3 py-2 text-xs border-r border-border cursor-pointer"
                      onClick={() => startEdit(record.opportunity_id, "brand_description", record.brand_description || "")}
                    >
                      {editingCell?.oppId === record.opportunity_id && editingCell?.field === "brand_description" ? (
                        <input autoFocus type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit} onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                          className="w-full bg-background border border-accent rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none" />
                      ) : (
                        <span className={record.brand_description ? "text-foreground" : "text-muted/40 italic"}>{record.brand_description || "Click to add..."}</span>
                      )}
                    </td>

                    {/* Meeting Notes (editable) */}
                    <td
                      className="px-3 py-2 text-xs border-r border-border cursor-pointer"
                      onClick={() => startEdit(record.opportunity_id, "meeting_notes", record.meeting_notes || "")}
                    >
                      {editingCell?.oppId === record.opportunity_id && editingCell?.field === "meeting_notes" ? (
                        <input autoFocus type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit} onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                          className="w-full bg-background border border-accent rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none" />
                      ) : (
                        <span className={record.meeting_notes ? "text-foreground" : "text-muted/40 italic"}>{record.meeting_notes || "Click to add..."}</span>
                      )}
                    </td>

                    {/* Client Notes (editable) */}
                    <td
                      className="px-3 py-2 text-xs border-r border-border cursor-pointer"
                      onClick={() => startEdit(record.opportunity_id, "client_notes", record.client_notes || "")}
                    >
                      {editingCell?.oppId === record.opportunity_id && editingCell?.field === "client_notes" ? (
                        <input autoFocus type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit} onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                          className="w-full bg-background border border-accent rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none" />
                      ) : (
                        <span className={record.client_notes ? "text-foreground" : "text-muted/40 italic"}>{record.client_notes || "Click to add..."}</span>
                      )}
                    </td>

                    {/* Fees Quoted (read-only, from Sales Management) */}
                    <td className="px-3 py-2 text-xs border-r border-border" title="Synced from Sales Management">
                      <span className={record.fees_quoted ? "text-foreground" : "text-muted/40"}>
                        {record.fees_quoted ? `₹${record.fees_quoted.toLocaleString("en-IN")}` : "—"}
                      </span>
                    </td>

                    {/* Fees Collected (read-only, from Sales Management) */}
                    <td className="px-3 py-2 text-xs border-r border-border" title="Synced from Sales Management">
                      <span className={record.fees_collected ? "text-green-400" : "text-muted/40"}>
                        {record.fees_collected ? `₹${record.fees_collected.toLocaleString("en-IN")}` : "—"}
                      </span>
                    </td>

                    {/* Follow-up Date (editable) */}
                    <td className="px-2 py-1.5 border-r border-border">
                      <input
                        type="date"
                        value={record.follow_up_date || ""}
                        onChange={(e) => updateRecord(record.opportunity_id, { follow_up_date: e.target.value || null })}
                        className="w-full bg-transparent border-0 text-xs text-foreground focus:outline-none [color-scheme:dark]"
                      />
                    </td>

                    {/* Checklist progress */}
                    <td className="px-2 py-1.5 border-r border-border">
                      <div className="flex items-center gap-1.5">
                        <div className="w-10 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full"
                            style={{ width: `${checkTotal > 0 ? (checkDone / checkTotal) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted">{checkDone}/{checkTotal}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {record.contact_phone && (
                          <a href={`tel:${record.contact_phone}`} className="p-1 rounded hover:bg-green-500/10 text-muted hover:text-green-400 transition-colors" title="Call">
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {record.contact_email && (
                          <a href={`mailto:${record.contact_email}`} className="p-1 rounded hover:bg-blue-500/10 text-muted hover:text-blue-400 transition-colors" title="Email">
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {record.contact_phone && (
                          <a href={`https://wa.me/${record.contact_phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer"
                            className="p-1 rounded hover:bg-green-500/10 text-muted hover:text-green-400 transition-colors" title="WhatsApp">
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Status Dropdown ─────────────────────────────────── */

function StatusDropdown({ current, onChange }: { current: string; onChange: (status: string) => void }) {
  const [open, setOpen] = useState(false);
  const config = ONBOARDING_STATUS_CONFIG[current] || { label: current, color: "text-muted", bg: "bg-surface border-border" };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md border ${config.bg} ${config.color} transition-colors`}
      >
        {config.label}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-44 bg-surface border border-border rounded-lg shadow-xl z-30 py-1">
            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => { onChange(s); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${
                  current === s ? "bg-accent/5 font-medium" : "hover:bg-surface-hover"
                } ${ONBOARDING_STATUS_CONFIG[s].color}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${ONBOARDING_STATUS_CONFIG[s].color.replace("text-", "bg-")}`} />
                {ONBOARDING_STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
