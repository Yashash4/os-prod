"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  IndianRupee,
  Users,
  TrendingUp,
  RefreshCw,
  Trash2,
  Loader2,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import PermissionGate from "@/components/PermissionGate";

/* ── Types ─────────────────────────────────────────── */

interface SheetEntry {
  id: string;
  sheet_date: string;
  meta_spend: number;        // paise
  meetings_booked: number;
  meetings_done: number;
  showups: number;
  converted: number;
  amount_collected: number;  // paise
  notes: string | null;
  created_at: string;
}

/* ── Main Component ────────────────────────────────── */

export default function DailySheetPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [entries, setEntries] = useState<SheetEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  // Month picker — default current month
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Inline editing
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchEntries = useCallback(async (month: string) => {
    setLoading(true);
    setError("");
    try {
      const [year, mon] = month.split("-").map(Number);
      const from = `${year}-${String(mon).padStart(2, "0")}-01`;
      const lastDay = new Date(year, mon, 0).getDate();
      const to = `${year}-${String(mon).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const res = await apiFetch(`/api/analytics/daily-sheet?from=${from}&to=${to}`);
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
      const res = await apiFetch("/api/analytics/daily-sheet?action=sync", {
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
    const totalSpend = entries.reduce((s, e) => s + (e.meta_spend || 0), 0);
    const totalMeetings = entries.reduce((s, e) => s + (e.meetings_booked || 0), 0);
    const avgCostPerMeeting = totalMeetings > 0 ? totalSpend / totalMeetings : 0;
    const totalCollected = entries.reduce((s, e) => s + (e.amount_collected || 0), 0);
    return { totalSpend, totalMeetings, avgCostPerMeeting, totalCollected };
  }, [entries]);

  /* ── CRUD ───────────────────────────────────────── */

  const updateEntry = async (id: string, updates: Record<string, unknown>) => {
    try {
      const res = await apiFetch("/api/analytics/daily-sheet", {
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
      const res = await apiFetch(`/api/analytics/daily-sheet?id=${id}`, { method: "DELETE" });
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
    const { id, field } = editingCell;
    let value: unknown = editValue;

    // Money fields: convert rupees to paise
    if (field === "meta_spend" || field === "amount_collected") {
      value = Math.round((parseFloat(editValue) || 0) * 100);
    }
    // Integer fields
    if (["meetings_booked", "meetings_done", "showups", "converted"].includes(field)) {
      value = parseInt(editValue) || 0;
    }

    updateEntry(id, { [field]: value });
    setEditingCell(null);
    setEditValue("");
  }

  function cancelEdit() {
    setEditingCell(null);
    setEditValue("");
  }

  /* ── Columns ────────────────────────────────────── */

  const COLUMNS = [
    { key: "sno", label: "#", width: "w-10" },
    { key: "sheet_date", label: "Date", width: "w-28" },
    { key: "meta_spend", label: "Meta Spend ₹", width: "w-28" },
    { key: "meetings_booked", label: "Meetings Booked", width: "w-32" },
    { key: "cost_per_meeting", label: "Cost/Meeting ₹", width: "w-28" },
    { key: "meetings_done", label: "Meetings Done", width: "w-28" },
    { key: "showups", label: "Showups", width: "w-24" },
    { key: "converted", label: "Converted", width: "w-24" },
    { key: "amount_collected", label: "Amount ₹", width: "w-28" },
    { key: "notes", label: "Notes", width: "w-44" },
    { key: "actions", label: "Actions", width: "w-20" },
  ];

  /* ── Render helpers ─────────────────────────────── */

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
            className="w-full bg-background border border-[#B8860B] rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none"
          />
        ) : (
          <span className={displayValue && displayValue !== "—" && displayValue !== "0" ? "text-foreground font-medium" : "text-muted/40 italic"}>
            {displayValue && displayValue !== "0" ? displayValue : "—"}
          </span>
        )}
      </td>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex-shrink-0 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-[#B8860B] rounded-full" />
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Daily Sheet</h1>
              <p className="text-muted text-xs mt-0.5">
                Campaign spend, meetings &amp; conversion tracking
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
            <PermissionGate module="analytics" subModule="analytics-daily-sheet" action="canCreate">
              <button
                onClick={syncMonth}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#B8860B] hover:bg-[#9A7209] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
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
          icon={<IndianRupee className="w-4 h-4" />}
          label="Total Meta Spend"
          value={`₹${(stats.totalSpend / 100).toLocaleString("en-IN", { minimumFractionDigits: 0 })}`}
          color="text-[#B8860B]"
          bg="bg-[#B8860B]/10"
        />
        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="Avg Cost/Meeting"
          value={stats.avgCostPerMeeting > 0 ? `₹${(stats.avgCostPerMeeting / 100).toLocaleString("en-IN", { minimumFractionDigits: 0 })}` : "—"}
          color="text-blue-400"
          bg="bg-blue-500/10"
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Total Collected"
          value={`₹${(stats.totalCollected / 100).toLocaleString("en-IN", { minimumFractionDigits: 0 })}`}
          color="text-green-400"
          bg="bg-green-500/10"
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
                    No entries for this month. Click &quot;Sync Month&quot; to auto-generate dates with Meta spend.
                  </td>
                </tr>
              ) : (
                entries.map((entry, idx) => {
                  const costPerMeeting = entry.meetings_booked > 0
                    ? entry.meta_spend / entry.meetings_booked
                    : 0;

                  return (
                    <tr key={entry.id} className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors">
                      {/* # */}
                      <td className="px-3 py-2 text-xs text-muted border-r border-border">{idx + 1}</td>

                      {/* Date (read-only) */}
                      <td className="px-3 py-2 text-xs border-r border-border">
                        <span className="text-foreground font-medium">
                          {new Date(entry.sheet_date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", weekday: "short" })}
                        </span>
                      </td>

                      {/* Meta Spend (editable, paise → rupees) */}
                      {renderEditableCell(
                        entry,
                        "meta_spend",
                        entry.meta_spend > 0 ? `₹${((entry.meta_spend) / 100).toLocaleString("en-IN")}` : "—",
                        String((entry.meta_spend || 0) / 100),
                        "number"
                      )}

                      {/* Meetings Booked (editable) */}
                      {renderEditableCell(entry, "meetings_booked", String(entry.meetings_booked || 0), String(entry.meetings_booked || 0), "number")}

                      {/* Cost/Meeting (auto-calc, read-only) */}
                      <td className="px-3 py-2 text-xs border-r border-border">
                        <span className={costPerMeeting > 0 ? "text-foreground font-medium" : "text-muted/40 italic"}>
                          {costPerMeeting > 0
                            ? `₹${(costPerMeeting / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                            : "—"}
                        </span>
                      </td>

                      {/* Meetings Done (editable) */}
                      {renderEditableCell(entry, "meetings_done", String(entry.meetings_done || 0), String(entry.meetings_done || 0), "number")}

                      {/* Showups (editable) */}
                      {renderEditableCell(entry, "showups", String(entry.showups || 0), String(entry.showups || 0), "number")}

                      {/* Converted (editable) */}
                      {renderEditableCell(entry, "converted", String(entry.converted || 0), String(entry.converted || 0), "number")}

                      {/* Amount Collected (editable, paise → rupees) */}
                      {renderEditableCell(
                        entry,
                        "amount_collected",
                        entry.amount_collected > 0 ? `₹${((entry.amount_collected) / 100).toLocaleString("en-IN")}` : "—",
                        String((entry.amount_collected || 0) / 100),
                        "number"
                      )}

                      {/* Notes (editable) */}
                      {renderEditableCell(entry, "notes", entry.notes || "", entry.notes || "")}

                      {/* Actions */}
                      <td className="px-3 py-2">
                        <PermissionGate module="analytics" subModule="analytics-daily-sheet" action="canDelete">
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
                  );
                })
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
