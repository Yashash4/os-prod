"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  TrendingUp,
  Star,
  Users,
  RefreshCw,
  Trash2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

/* ── Types ─────────────────────────────────────────── */

interface SheetEntry {
  id: string;
  owner: string;
  opportunity_id: string | null;
  contact_id: string | null;
  calendar_event_id: string | null;
  meet_date: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  meeting_link: string | null;
  recording_url: string | null;
  meeting_duration: number | null;
  outcome: string | null;
  next_steps: string | null;
  follow_up_date: string | null;
  score: number | null;
  notes: string | null;
  created_at: string;
}

interface GHLUser {
  id: string;
  name: string;
}

interface Props {
  owner: "maverick" | "jobin";
  ownerLabel: string;
}

const OUTCOME_OPTIONS = [
  { value: "interested", label: "Interested", color: "text-blue-400 bg-blue-500/10" },
  { value: "not_interested", label: "Not Interested", color: "text-red-400 bg-red-500/10" },
  { value: "follow_up", label: "Follow Up", color: "text-amber-400 bg-amber-500/10" },
  { value: "converted", label: "Converted", color: "text-green-400 bg-green-500/10" },
  { value: "no_show", label: "No Show", color: "text-zinc-400 bg-zinc-500/10" },
];

const COLUMNS = [
  { key: "sno", label: "#", width: "w-10" },
  { key: "meet_date", label: "Date", width: "w-32" },
  { key: "contact_name", label: "Contact", width: "w-36" },
  { key: "contact_email", label: "Email", width: "w-44" },
  { key: "contact_phone", label: "Phone", width: "w-32" },
  { key: "meeting_link", label: "Link", width: "w-20" },
  { key: "recording_url", label: "Recording", width: "w-36" },
  { key: "meeting_duration", label: "Duration", width: "w-20" },
  { key: "outcome", label: "Outcome", width: "w-32" },
  { key: "next_steps", label: "Next Steps", width: "w-44" },
  { key: "follow_up_date", label: "Follow-up", width: "w-28" },
  { key: "score", label: "Score", width: "w-28" },
  { key: "notes", label: "Notes", width: "w-44" },
  { key: "actions", label: "", width: "w-16" },
];

/* ── Main Component ────────────────────────────────── */

export default function MeetingAnalysisSheet({ owner, ownerLabel }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [entries, setEntries] = useState<SheetEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [ghlUserId, setGhlUserId] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /* ── Resolve GHL user ─────────────────────────────── */

  useEffect(() => {
    async function resolveUser() {
      try {
        const res = await apiFetch("/api/ghl/users");
        const data = await res.json();
        const users: GHLUser[] = data.users || [];
        const match = users.find((u) => u.name.toLowerCase().includes(owner));
        if (match) setGhlUserId(match.id);
      } catch {
        // Non-critical — sync just won't work
      }
    }
    resolveUser();
  }, [owner]);

  /* ── Fetch entries ────────────────────────────────── */

  const fetchEntries = useCallback(async (month: string) => {
    setLoading(true);
    setError("");
    try {
      const [year, mon] = month.split("-").map(Number);
      const from = `${year}-${String(mon).padStart(2, "0")}-01`;
      const lastDay = new Date(year, mon, 0).getDate();
      const to = `${year}-${String(mon).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const res = await apiFetch(`/api/sales/meeting-analysis-sheet?owner=${owner}&from=${from}&to=${to}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEntries(data.records || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [owner]);

  useEffect(() => {
    fetchEntries(selectedMonth);
  }, [selectedMonth, fetchEntries]);

  /* ── Sync ─────────────────────────────────────────── */

  const syncMonth = async () => {
    if (!ghlUserId) {
      setError("Could not resolve GHL user. Try refreshing.");
      return;
    }
    setSyncing(true);
    setError("");
    setSyncMsg("");
    try {
      const res = await apiFetch("/api/sales/meeting-analysis-sheet?action=sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, month: selectedMonth, ghlUserId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSyncMsg(data.message || "Synced");
      await fetchEntries(selectedMonth);
      setTimeout(() => setSyncMsg(""), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync");
    } finally {
      setSyncing(false);
    }
  };

  /* ── Stats ────────────────────────────────────────── */

  const stats = useMemo(() => {
    const total = entries.length;
    const converted = entries.filter((e) => e.outcome === "converted" || e.outcome === "won").length;
    const conversionRate = total > 0 ? (converted / total) * 100 : 0;

    const scored = entries.filter((e) => e.score != null && e.score > 0);
    const avgScore = scored.length > 0 ? scored.reduce((s, e) => s + (e.score || 0), 0) / scored.length : 0;

    return { total, conversionRate, avgScore };
  }, [entries]);

  /* ── CRUD ─────────────────────────────────────────── */

  const updateEntry = async (id: string, updates: Record<string, unknown>) => {
    try {
      const res = await apiFetch("/api/sales/meeting-analysis-sheet", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } as SheetEntry : e)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      const res = await apiFetch(`/api/sales/meeting-analysis-sheet?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setDeletingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  /* ── Edit helpers ─────────────────────────────────── */

  function startEdit(id: string, field: string, currentValue: string) {
    setEditingCell({ id, field });
    setEditValue(currentValue || "");
  }

  function commitEdit() {
    if (!editingCell) return;
    const { id, field } = editingCell;
    let value: unknown = editValue;

    if (field === "meeting_duration") {
      value = parseInt(editValue) || null;
    }

    updateEntry(id, { [field]: value || null });
    setEditingCell(null);
    setEditValue("");
  }

  function cancelEdit() {
    setEditingCell(null);
    setEditValue("");
  }

  /* ── Render helpers ───────────────────────────────── */

  function renderEditableCell(entry: SheetEntry, field: string, displayValue: string, editStartValue: string, inputType = "text") {
    const isEditing = editingCell?.id === entry.id && editingCell?.field === field;
    return (
      <td
        className="px-3 py-2 text-xs border-r border-border cursor-pointer"
        onClick={() => !isEditing && startEdit(entry.id, field, editStartValue)}
      >
        {isEditing ? (
          <input
            autoFocus
            type={inputType}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
            className="w-full bg-background border border-accent rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none"
          />
        ) : (
          <span className={displayValue && displayValue !== "—" ? "text-foreground" : "text-muted/40 italic"}>
            {displayValue || "—"}
          </span>
        )}
      </td>
    );
  }

  function renderOutcomeCell(entry: SheetEntry) {
    const isEditing = editingCell?.id === entry.id && editingCell?.field === "outcome";
    const current = OUTCOME_OPTIONS.find((o) => o.value === entry.outcome);

    return (
      <td
        className="px-3 py-2 text-xs border-r border-border cursor-pointer"
        onClick={() => !isEditing && setEditingCell({ id: entry.id, field: "outcome" })}
      >
        {isEditing ? (
          <select
            autoFocus
            value={entry.outcome || ""}
            onChange={(e) => {
              updateEntry(entry.id, { outcome: e.target.value || null });
              setEditingCell(null);
            }}
            onBlur={() => setEditingCell(null)}
            className="w-full bg-background border border-accent rounded px-1 py-0.5 text-xs text-foreground focus:outline-none [&>option]:bg-surface"
          >
            <option value="">—</option>
            {OUTCOME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : current ? (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${current.color}`}>
            {current.label}
          </span>
        ) : (
          <span className="text-muted/40 italic">—</span>
        )}
      </td>
    );
  }

  function renderScoreCell(entry: SheetEntry) {
    return (
      <td className="px-3 py-2 text-xs border-r border-border">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => updateEntry(entry.id, { score: entry.score === s ? null : s })}
              className="p-0 hover:scale-110 transition-transform"
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  entry.score && s <= entry.score
                    ? "text-amber-400 fill-amber-400"
                    : "text-muted/30"
                }`}
              />
            </button>
          ))}
        </div>
      </td>
    );
  }

  function getRowTint(entry: SheetEntry) {
    if (entry.outcome === "converted") return "bg-green-500/5";
    if (entry.outcome === "no_show" || entry.outcome === "not_interested") return "bg-red-500/5";
    return "";
  }

  /* ── Render ───────────────────────────────────────── */

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex-shrink-0 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-accent rounded-full" />
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">
                {ownerLabel} Meeting Sheet
              </h1>
              <p className="text-muted text-xs mt-0.5">
                Post-meeting analysis &amp; tracking
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent [color-scheme:dark]"
            />
            <button
              onClick={syncMonth}
              disabled={syncing || !ghlUserId}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent/80 text-background text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {syncing ? "Syncing..." : "Sync Meetings"}
            </button>
          </div>
        </div>
        {syncMsg && (
          <p className="text-xs text-green-400 bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-500/20">{syncMsg}</p>
        )}
      </div>

      {error && (
        <div className="mx-6 mt-3 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20 flex items-center justify-between">
          {error}
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-300 text-xs ml-4">Dismiss</button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="px-6 py-3 flex gap-3 flex-shrink-0 border-b border-border/50">
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Conversion Rate"
          value={entries.length > 0 ? `${stats.conversionRate.toFixed(0)}%` : "—"}
          color="text-green-400"
          bg="bg-green-500/10"
        />
        <StatCard
          icon={<Star className="w-4 h-4" />}
          label="Avg Score"
          value={stats.avgScore > 0 ? `${stats.avgScore.toFixed(1)} / 5` : "—"}
          color="text-amber-400"
          bg="bg-amber-500/10"
        />
        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="Total Meetings"
          value={String(stats.total)}
          color="text-blue-400"
          bg="bg-blue-500/10"
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted text-sm">Loading...</div>
        ) : (
          <table className="w-full border-collapse min-w-[1600px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface border-b border-border/50">
                {COLUMNS.map((col) => (
                  <th key={col.key} className={`${col.width} text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5 border-r border-border last:border-r-0`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="text-center py-16 text-muted text-sm">
                    No meetings for this month. Click &quot;Sync Meetings&quot; to pull from calendar.
                  </td>
                </tr>
              ) : (
                entries.map((entry, idx) => (
                  <tr key={entry.id} className={`border-b border-border/50 hover:bg-surface-hover/50 transition-colors ${getRowTint(entry)}`}>
                    {/* # */}
                    <td className="px-3 py-2 text-xs text-muted border-r border-border">{idx + 1}</td>

                    {/* Date (read-only) */}
                    <td className="px-3 py-2 text-xs border-r border-border">
                      <span className="text-foreground font-medium">
                        {new Date(entry.meet_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", weekday: "short" })}
                      </span>
                      <span className="text-muted/50 ml-1.5 text-[10px]">
                        {new Date(entry.meet_date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                      </span>
                    </td>

                    {/* Contact (read-only) */}
                    <td className="px-3 py-2 text-xs border-r border-border">
                      <span className="text-foreground font-medium">{entry.contact_name || "—"}</span>
                    </td>

                    {/* Email (read-only) */}
                    <td className="px-3 py-2 text-xs border-r border-border">
                      <span className="text-muted truncate block max-w-[160px]">{entry.contact_email || "—"}</span>
                    </td>

                    {/* Phone (read-only) */}
                    <td className="px-3 py-2 text-xs border-r border-border">
                      <span className="text-muted">{entry.contact_phone || "—"}</span>
                    </td>

                    {/* Meeting Link (read-only) */}
                    <td className="px-3 py-2 text-xs border-r border-border text-center">
                      {entry.meeting_link ? (
                        <a href={entry.meeting_link} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                          <ExternalLink className="w-3.5 h-3.5 inline" />
                        </a>
                      ) : (
                        <span className="text-muted/40">—</span>
                      )}
                    </td>

                    {/* Recording URL (editable) */}
                    {renderEditableCell(
                      entry,
                      "recording_url",
                      entry.recording_url ? "View" : "—",
                      entry.recording_url || "",
                      "url"
                    )}

                    {/* Duration (editable) */}
                    {renderEditableCell(
                      entry,
                      "meeting_duration",
                      entry.meeting_duration ? `${entry.meeting_duration}m` : "—",
                      String(entry.meeting_duration || ""),
                      "number"
                    )}

                    {/* Outcome (dropdown) */}
                    {renderOutcomeCell(entry)}

                    {/* Next Steps (editable) */}
                    {renderEditableCell(entry, "next_steps", entry.next_steps || "", entry.next_steps || "")}

                    {/* Follow-up Date (editable) */}
                    {renderEditableCell(
                      entry,
                      "follow_up_date",
                      entry.follow_up_date
                        ? new Date(entry.follow_up_date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                        : "—",
                      entry.follow_up_date || "",
                      "date"
                    )}

                    {/* Score (stars) */}
                    {renderScoreCell(entry)}

                    {/* Notes (editable) */}
                    {renderEditableCell(entry, "notes", entry.notes || "", entry.notes || "")}

                    {/* Actions */}
                    <td className="px-3 py-2">
                      {deletingId === entry.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => deleteEntry(entry.id)}
                            className="px-1.5 py-0.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] rounded transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="px-1.5 py-0.5 bg-surface hover:bg-surface-hover text-muted text-[10px] rounded transition-colors border border-border"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingId(entry.id)}
                          className="p-1 rounded hover:bg-red-500/10 text-muted hover:text-red-400 transition-colors"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ── Stat Card ──────────────────────────────────────── */

function StatCard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: string; color: string; bg: string }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/30 ${bg}`}>
      <div className={color}>{icon}</div>
      <div>
        <p className="text-[9px] text-muted uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}
