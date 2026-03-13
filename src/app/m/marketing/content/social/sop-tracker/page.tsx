"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  CheckSquare,
  BarChart3,
  AlertCircle,
  RefreshCw,
  Trash2,
  Loader2,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import PermissionGate from "@/components/PermissionGate";

/* ── Types ─────────────────────────────────────────── */

interface SOPEntry {
  id: string;
  sop_date: string;
  linkedin_post_1: boolean;
  linkedin_post_1_url: string | null;
  linkedin_post_2: boolean;
  linkedin_post_2_url: string | null;
  instagram_post: boolean;
  instagram_post_url: string | null;
  youtube_short: boolean;
  youtube_short_url: string | null;
  pending_reels_done: boolean;
  pending_reels_note: string | null;
  notes: string | null;
  created_at: string;
}

const CHECKBOX_FIELDS = [
  "linkedin_post_1",
  "linkedin_post_2",
  "instagram_post",
  "youtube_short",
  "pending_reels_done",
] as const;

/* ── Main Component ────────────────────────────────── */

export default function SOPTrackerPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [entries, setEntries] = useState<SOPEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchEntries = useCallback(async (month: string) => {
    setLoading(true);
    setError("");
    try {
      const [year, mon] = month.split("-").map(Number);
      const from = `${year}-${String(mon).padStart(2, "0")}-01`;
      const lastDay = new Date(year, mon, 0).getDate();
      const to = `${year}-${String(mon).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const res = await apiFetch(`/api/marketing/content/sop-tracker?from=${from}&to=${to}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEntries(data.records || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load entries");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries(selectedMonth);
  }, [selectedMonth, fetchEntries]);

  /* ── Sync Month ──────────────────────────────────── */

  const syncMonth = async () => {
    setSyncing(true);
    setError("");
    setSyncMsg("");
    try {
      const res = await apiFetch("/api/marketing/content/sop-tracker?action=sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth }),
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

  /* ── Stats ──────────────────────────────────────── */

  const stats = useMemo(() => {
    const total = entries.length;
    const completeDays = entries.filter((e) =>
      CHECKBOX_FIELDS.every((f) => e[f])
    ).length;
    const completionRate = total > 0 ? Math.round((completeDays / total) * 100) : 0;

    const totalChecked = entries.reduce(
      (sum, e) => sum + CHECKBOX_FIELDS.filter((f) => e[f]).length,
      0
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const backlogDays = entries.filter((e) => {
      const d = new Date(e.sop_date + "T00:00:00");
      return d < today && !e.pending_reels_done;
    }).length;

    return { completionRate, completeDays, total, totalChecked, backlogDays };
  }, [entries]);

  /* ── CRUD ───────────────────────────────────────── */

  const updateEntry = async (id: string, updates: Record<string, unknown>) => {
    try {
      const res = await apiFetch("/api/marketing/content/sop-tracker", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } as SOPEntry : e)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      const res = await apiFetch(`/api/marketing/content/sop-tracker?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setDeletingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  /* ── Edit helpers ───────────────────────────────── */

  function startEdit(id: string, field: string, currentValue: string) {
    setEditingCell({ id, field });
    setEditValue(currentValue || "");
  }

  function commitEdit() {
    if (!editingCell) return;
    updateEntry(editingCell.id, { [editingCell.field]: editValue || null });
    setEditingCell(null);
    setEditValue("");
  }

  function cancelEdit() {
    setEditingCell(null);
    setEditValue("");
  }

  /* ── Render helpers ─────────────────────────────── */

  function renderCheckbox(entry: SOPEntry, field: keyof SOPEntry) {
    const checked = !!entry[field];
    return (
      <td className="px-2 py-2 text-center border-r border-border">
        <button
          onClick={() => updateEntry(entry.id, { [field]: !checked })}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            checked
              ? "bg-green-500/20 border-green-500 text-green-400"
              : "border-border/60 hover:border-muted text-transparent hover:text-muted/30"
          }`}
        >
          {checked && <CheckSquare className="w-3.5 h-3.5" />}
        </button>
      </td>
    );
  }

  function renderUrlCell(entry: SOPEntry, field: string, value: string | null) {
    const isEditing = editingCell?.id === entry.id && editingCell?.field === field;
    return (
      <td
        className="px-2 py-2 text-xs border-r border-border cursor-pointer max-w-[120px]"
        onClick={() => !isEditing && startEdit(entry.id, field, value || "")}
      >
        {isEditing ? (
          <input
            autoFocus
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
            className="w-full bg-background border border-[#B8860B] rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none"
            placeholder="Paste URL..."
          />
        ) : value ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline truncate block"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => { try { return new URL(value).hostname; } catch { return "Link"; } })()}
          </a>
        ) : (
          <span className="text-muted/30 italic">—</span>
        )}
      </td>
    );
  }

  function renderTextCell(entry: SOPEntry, field: string, value: string | null) {
    const isEditing = editingCell?.id === entry.id && editingCell?.field === field;
    return (
      <td
        className="px-3 py-2 text-xs border-r border-border cursor-pointer"
        onClick={() => !isEditing && startEdit(entry.id, field, value || "")}
      >
        {isEditing ? (
          <input
            autoFocus
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
            className="w-full bg-background border border-[#B8860B] rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none"
          />
        ) : (
          <span className={value ? "text-foreground" : "text-muted/30 italic"}>
            {value || "—"}
          </span>
        )}
      </td>
    );
  }

  /* ── Row tinting ────────────────────────────────── */

  function getRowClass(entry: SOPEntry) {
    const allDone = CHECKBOX_FIELDS.every((f) => entry[f]);
    if (allDone) return "bg-green-500/[0.03]";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const entryDate = new Date(entry.sop_date + "T00:00:00");
    if (entryDate < today) return "bg-amber-500/[0.03]";

    return "";
  }

  /* ── Columns ────────────────────────────────────── */

  const COLUMNS = [
    { key: "sno", label: "#", width: "w-10" },
    { key: "date", label: "Date", width: "w-28" },
    { key: "li1", label: "LI Post 1", width: "w-20" },
    { key: "li1_url", label: "URL", width: "w-24" },
    { key: "li2", label: "LI Post 2", width: "w-20" },
    { key: "li2_url", label: "URL", width: "w-24" },
    { key: "ig", label: "IG Post", width: "w-20" },
    { key: "ig_url", label: "URL", width: "w-24" },
    { key: "yt", label: "YT Short", width: "w-20" },
    { key: "yt_url", label: "URL", width: "w-24" },
    { key: "backlog", label: "Backlog", width: "w-20" },
    { key: "backlog_note", label: "Backlog Note", width: "w-36" },
    { key: "notes", label: "Notes", width: "w-40" },
    { key: "actions", label: "", width: "w-16" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex-shrink-0 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-[#B8860B] rounded-full" />
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Content Publishing SOP</h1>
              <p className="text-muted text-xs mt-0.5">
                Daily checklist — 2 LinkedIn, 1 Instagram, 1 YouTube Short, backlog reels
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-[#B8860B] [color-scheme:dark]"
            />
            <PermissionGate module="marketing" subModule="content-sop-tracker" action="canCreate">
              <button
                onClick={syncMonth}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#B8860B] hover:bg-[#9A7209] text-white text-sm font-medium rounded-lg transition:colors disabled:opacity-50"
              >
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {syncing ? "Syncing..." : "Sync Month"}
              </button>
            </PermissionGate>
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
          icon={<CheckSquare className="w-4 h-4" />}
          label="Completion Rate"
          value={`${stats.completionRate}% (${stats.completeDays}/${stats.total})`}
          color="text-green-400"
          bg="bg-green-500/10"
        />
        <StatCard
          icon={<BarChart3 className="w-4 h-4" />}
          label="Posts This Month"
          value={String(stats.totalChecked)}
          color="text-blue-400"
          bg="bg-blue-500/10"
        />
        <StatCard
          icon={<AlertCircle className="w-4 h-4" />}
          label="Backlog Days"
          value={String(stats.backlogDays)}
          color="text-amber-400"
          bg="bg-amber-500/10"
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted text-sm">Loading...</div>
        ) : (
          <table className="w-full border-collapse min-w-[1200px]">
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
                    No entries for this month. Click &quot;Sync Month&quot; to auto-generate dates.
                  </td>
                </tr>
              ) : (
                entries.map((entry, idx) => (
                  <tr
                    key={entry.id}
                    className={`border-b border-border/50 hover:bg-surface-hover/50 transition-colors ${getRowClass(entry)}`}
                  >
                    <td className="px-3 py-2 text-xs text-muted border-r border-border">{idx + 1}</td>

                    {/* Date (read-only) */}
                    <td className="px-3 py-2 text-xs border-r border-border">
                      <span className="text-foreground font-medium">
                        {new Date(entry.sop_date + "T00:00:00").toLocaleDateString("en-IN", {
                          weekday: "short", day: "2-digit", month: "short",
                        })}
                      </span>
                    </td>

                    {/* LinkedIn Post 1 */}
                    {renderCheckbox(entry, "linkedin_post_1")}
                    {renderUrlCell(entry, "linkedin_post_1_url", entry.linkedin_post_1_url)}

                    {/* LinkedIn Post 2 */}
                    {renderCheckbox(entry, "linkedin_post_2")}
                    {renderUrlCell(entry, "linkedin_post_2_url", entry.linkedin_post_2_url)}

                    {/* Instagram Post */}
                    {renderCheckbox(entry, "instagram_post")}
                    {renderUrlCell(entry, "instagram_post_url", entry.instagram_post_url)}

                    {/* YouTube Short */}
                    {renderCheckbox(entry, "youtube_short")}
                    {renderUrlCell(entry, "youtube_short_url", entry.youtube_short_url)}

                    {/* Pending Reels / Backlog */}
                    {renderCheckbox(entry, "pending_reels_done")}
                    {renderTextCell(entry, "pending_reels_note", entry.pending_reels_note)}

                    {/* Notes */}
                    {renderTextCell(entry, "notes", entry.notes)}

                    {/* Actions */}
                    <td className="px-3 py-2">
                      <PermissionGate module="marketing" subModule="content-sop-tracker" action="canDelete">
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
                      </PermissionGate>
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
