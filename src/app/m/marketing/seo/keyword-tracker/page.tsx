"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Loader2, Search, Trash2, Plus, Crosshair, CheckCircle2,
  TrendingUp, TrendingDown, ChevronDown,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import PermissionGate from "@/components/PermissionGate";

/* ── Types ─────────────────────────────────────────────────── */

interface TrackedKeyword {
  id: string;
  keyword: string;
  target_position: number;
  status: string;
  priority: string;
  notes: string;
  created_at: string;
}

interface GSCRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface MergedRow extends TrackedKeyword {
  gsc_position: number | null;
  gsc_clicks: number | null;
  gsc_impressions: number | null;
  gsc_ctr: number | null;
  gap: number | null;
}

/* ── Helpers ────────────────────────────────────────────────── */

const STATUSES = ["tracking", "improving", "achieved", "declined", "paused"] as const;
const PRIORITIES = ["high", "medium", "low"] as const;

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/15 text-red-400 border-red-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function num(n: number) {
  return n.toLocaleString("en-IN");
}

function pct(n: number) {
  return (n * 100).toFixed(2) + "%";
}

/* ── Page ───────────────────────────────────────────────────── */

export default function KeywordTrackerPage() {
  const [rows, setRows] = useState<TrackedKeyword[]>([]);
  const [gscRows, setGscRows] = useState<GSCRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);

  /* Form state */
  const [formKeyword, setFormKeyword] = useState("");
  const [formTarget, setFormTarget] = useState<number>(10);
  const [formPriority, setFormPriority] = useState<string>("medium");
  const [formNotes, setFormNotes] = useState("");

  /* Inline edit */
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editNotesVal, setEditNotesVal] = useState("");

  /* ── Fetch data ─────────────────────────────────────────── */

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(today.getDate() - 3);
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 27);

      const [trackerRes, gscRes] = await Promise.all([
        apiFetch("/api/seo/keyword-tracker"),
        apiFetch(
          `/api/seo/search-analytics?dimensions=query&rowLimit=500&startDate=${fmtDate(startDate)}&endDate=${fmtDate(endDate)}`
        ),
      ]);
      const trackerData = await trackerRes.json();
      const gscData = await gscRes.json();
      setRows(Array.isArray(trackerData.entries) ? trackerData.entries : Array.isArray(trackerData) ? trackerData : []);
      setGscRows(gscData.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── GSC Map ────────────────────────────────────────────── */

  const gscMap = useMemo(() => {
    const m = new Map<string, GSCRow>();
    for (const r of gscRows) m.set(r.keys[0].toLowerCase(), r);
    return m;
  }, [gscRows]);

  /* ── Merged data ────────────────────────────────────────── */

  const merged: MergedRow[] = useMemo(() => {
    return rows.map((r) => {
      const g = gscMap.get(r.keyword.toLowerCase());
      const gscPos = g ? g.position : null;
      return {
        ...r,
        gsc_position: gscPos,
        gsc_clicks: g?.clicks ?? null,
        gsc_impressions: g?.impressions ?? null,
        gsc_ctr: g?.ctr ?? null,
        gap: gscPos != null ? Math.round(gscPos - r.target_position) : null,
      };
    });
  }, [rows, gscMap]);

  /* ── Stats ──────────────────────────────────────────────── */

  const stats = useMemo(() => ({
    total: rows.length,
    achieved: rows.filter((r) => r.status === "achieved").length,
    improving: rows.filter((r) => r.status === "improving").length,
    declined: rows.filter((r) => r.status === "declined").length,
  }), [rows]);

  /* ── Filtering ──────────────────────────────────────────── */

  const filtered = useMemo(() => {
    let list = merged;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.keyword.toLowerCase().includes(q));
    }
    if (priorityFilter !== "all") list = list.filter((r) => r.priority === priorityFilter);
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    return list;
  }, [merged, search, priorityFilter, statusFilter]);

  /* ── CRUD ───────────────────────────────────────────────── */

  async function handleAdd() {
    if (!formKeyword.trim()) return;
    try {
      await apiFetch("/api/seo/keyword-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: formKeyword.trim(),
          target_position: formTarget,
          priority: formPriority,
          notes: formNotes,
        }),
      });
      setFormKeyword("");
      setFormTarget(10);
      setFormPriority("medium");
      setFormNotes("");
      setShowForm(false);
      fetchData();
    } catch {}
  }

  async function handleUpdate(id: string, field: string, value: string | number) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
    try {
      await apiFetch("/api/seo/keyword-tracker", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, [field]: value }),
      });
    } catch {
      fetchData();
    }
  }

  async function handleDelete(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    try {
      await apiFetch(`/api/seo/keyword-tracker?id=${id}`, { method: "DELETE" });
    } catch {
      fetchData();
    }
  }

  /* ── Position color helper ──────────────────────────────── */

  function posColor(current: number | null, target: number) {
    if (current == null) return "text-muted";
    if (current <= target) return "text-green-400";
    if (current <= target + 5) return "text-amber-400";
    return "text-red-400";
  }

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Crosshair className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold">Keyword Tracker</h1>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
        </div>
        <PermissionGate module="marketing" subModule="marketing-seo-keyword-tracker" action="canCreate">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Keyword
          </button>
        </PermissionGate>
      </div>

      {error && (
        <div className="bg-red-500/10 text-red-400 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Tracked", value: stats.total, icon: Crosshair, color: "text-blue-400" },
          { label: "Achieved", value: stats.achieved, icon: CheckCircle2, color: "text-green-400" },
          { label: "Improving", value: stats.improving, icon: TrendingUp, color: "text-amber-400" },
          { label: "Declined", value: stats.declined, icon: TrendingDown, color: "text-red-400" },
        ].map((s) => (
          <div key={s.label} className="card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-muted">{s.label}</span>
            </div>
            <p className="text-xl font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Priority pills */}
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {(["all", ...PRIORITIES] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors capitalize ${
                priorityFilter === p ? "bg-accent text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {p === "all" ? "All Priority" : p}
            </button>
          ))}
        </div>

        {/* Status pills */}
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {(["all", ...STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors capitalize ${
                statusFilter === s ? "bg-accent text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {s === "all" ? "All Status" : s}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search keywords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 bg-background/50 border border-border rounded-lg text-sm w-64"
          />
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-medium text-foreground">Add Keyword</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Keyword"
              value={formKeyword}
              onChange={(e) => setFormKeyword(e.target.value)}
              className="bg-background/50 border border-border rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="number"
              placeholder="Target Position"
              value={formTarget}
              onChange={(e) => setFormTarget(Number(e.target.value))}
              className="bg-background/50 border border-border rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={formPriority}
              onChange={(e) => setFormPriority(e.target.value)}
              className="bg-background/50 border border-border rounded-lg px-3 py-2 text-sm"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Notes"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="bg-background/50 border border-border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            Add
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-medium">Keyword</th>
                <th className="px-4 py-3 font-medium text-right">Current Pos</th>
                <th className="px-4 py-3 font-medium text-right">Target Pos</th>
                <th className="px-4 py-3 font-medium text-right">Gap</th>
                <th className="px-4 py-3 font-medium text-right">Clicks</th>
                <th className="px-4 py-3 font-medium text-right">Impressions</th>
                <th className="px-4 py-3 font-medium text-right">CTR</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-surface-hover">
                  <td className="px-4 py-2 max-w-[200px] truncate font-medium text-foreground">
                    {r.keyword}
                  </td>
                  <td className={`px-4 py-2 text-right font-medium ${posColor(r.gsc_position, r.target_position)}`}>
                    {r.gsc_position != null ? r.gsc_position.toFixed(1) : "N/A"}
                  </td>
                  <td className="px-4 py-2 text-right">{r.target_position}</td>
                  <td className="px-4 py-2 text-right">
                    {r.gap != null ? (
                      <span className={r.gap <= 0 ? "text-green-400" : "text-red-400"}>
                        {r.gap <= 0 ? r.gap : `+${r.gap}`}
                      </span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.gsc_clicks != null ? num(r.gsc_clicks) : "-"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.gsc_impressions != null ? num(r.gsc_impressions) : "-"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.gsc_ctr != null ? pct(r.gsc_ctr) : "-"}
                  </td>
                  <td className="px-4 py-2">
                    <PermissionGate module="marketing" subModule="marketing-seo-keyword-tracker" action="canEdit" fallback={<span className="text-xs capitalize">{r.status}</span>}>
                      <select
                        value={r.status}
                        onChange={(e) => handleUpdate(r.id, "status", e.target.value)}
                        className="bg-background/50 border border-border rounded px-2 py-1 text-xs capitalize"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </PermissionGate>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${PRIORITY_COLORS[r.priority] ?? PRIORITY_COLORS.low}`}>
                      {r.priority}
                    </span>
                  </td>
                  <td className="px-4 py-2 max-w-[180px]">
                    <PermissionGate module="marketing" subModule="marketing-seo-keyword-tracker" action="canEdit" fallback={<span className="text-xs text-muted">{r.notes || "-"}</span>}>
                      {editingNotes === r.id ? (
                        <input
                          autoFocus
                          type="text"
                          value={editNotesVal}
                          onChange={(e) => setEditNotesVal(e.target.value)}
                          onBlur={() => {
                            handleUpdate(r.id, "notes", editNotesVal);
                            setEditingNotes(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleUpdate(r.id, "notes", editNotesVal);
                              setEditingNotes(null);
                            }
                            if (e.key === "Escape") setEditingNotes(null);
                          }}
                          className="bg-background/50 border border-border rounded px-2 py-1 text-xs w-full"
                        />
                      ) : (
                        <span
                          onClick={() => { setEditingNotes(r.id); setEditNotesVal(r.notes ?? ""); }}
                          className="text-xs text-muted truncate block cursor-pointer hover:text-foreground"
                          title={r.notes}
                        >
                          {r.notes || "..."}
                        </span>
                      )}
                    </PermissionGate>
                  </td>
                  <td className="px-4 py-2">
                    <PermissionGate module="marketing" subModule="marketing-seo-keyword-tracker" action="canDelete">
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="text-muted hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </PermissionGate>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-muted">
                    No keywords found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
