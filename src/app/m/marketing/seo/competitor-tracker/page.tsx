"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Loader2, Search, Trash2, Plus, Swords, TrendingUp, TrendingDown,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

/* ── Types ─────────────────────────────────────────────────── */

interface CompetitorEntry {
  id: string;
  competitor_domain: string;
  keyword: string;
  competitor_position: number;
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

interface MergedRow extends CompetitorEntry {
  our_position: number | null;
  gap: number | null;
}

/* ── Helpers ────────────────────────────────────────────────── */

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/* ── Page ───────────────────────────────────────────────────── */

export default function CompetitorTrackerPage() {
  const [rows, setRows] = useState<CompetitorEntry[]>([]);
  const [gscRows, setGscRows] = useState<GSCRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  /* Form state */
  const [formDomain, setFormDomain] = useState("");
  const [formKeyword, setFormKeyword] = useState("");
  const [formPosition, setFormPosition] = useState<number>(10);
  const [formNotes, setFormNotes] = useState("");

  /* Inline edit */
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editNotesVal, setEditNotesVal] = useState("");
  const [editingPos, setEditingPos] = useState<string | null>(null);
  const [editPosVal, setEditPosVal] = useState("");

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
        apiFetch("/api/seo/competitor-tracker"),
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
      const ourPos = g ? g.position : null;
      return {
        ...r,
        our_position: ourPos,
        gap: ourPos != null ? Math.round(ourPos - r.competitor_position) : null,
      };
    });
  }, [rows, gscMap]);

  /* ── Stats ──────────────────────────────────────────────── */

  const stats = useMemo(() => {
    const uniqueKeywords = new Set(rows.map((r) => r.keyword.toLowerCase()));
    let ahead = 0;
    let behind = 0;
    for (const r of merged) {
      if (r.gap == null) continue;
      if (r.gap < 0) ahead++;
      if (r.gap > 0) behind++;
    }
    return { tracked: uniqueKeywords.size, ahead, behind };
  }, [rows, merged]);

  /* ── Filtering ──────────────────────────────────────────── */

  const filtered = useMemo(() => {
    if (!search) return merged;
    const q = search.toLowerCase();
    return merged.filter(
      (r) => r.keyword.toLowerCase().includes(q) || r.competitor_domain.toLowerCase().includes(q)
    );
  }, [merged, search]);

  /* ── CRUD ───────────────────────────────────────────────── */

  async function handleAdd() {
    if (!formDomain.trim() || !formKeyword.trim()) return;
    try {
      await apiFetch("/api/seo/competitor-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitor_domain: formDomain.trim(),
          keyword: formKeyword.trim(),
          competitor_position: formPosition,
          notes: formNotes,
        }),
      });
      setFormDomain("");
      setFormKeyword("");
      setFormPosition(10);
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
      await apiFetch("/api/seo/competitor-tracker", {
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
      await apiFetch(`/api/seo/competitor-tracker?id=${id}`, { method: "DELETE" });
    } catch {
      fetchData();
    }
  }

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Swords className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold">Competitor Tracker</h1>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Entry
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 text-red-400 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Keywords Tracked", value: stats.tracked, icon: Swords, color: "text-blue-400" },
          { label: "We're Ahead", value: stats.ahead, icon: TrendingUp, color: "text-green-400" },
          { label: "They're Ahead", value: stats.behind, icon: TrendingDown, color: "text-red-400" },
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

      {/* Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search keyword or competitor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 bg-background/50 border border-border rounded-lg text-sm w-72"
          />
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-medium text-foreground">Add Entry</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Competitor Domain"
              value={formDomain}
              onChange={(e) => setFormDomain(e.target.value)}
              className="bg-background/50 border border-border rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Keyword"
              value={formKeyword}
              onChange={(e) => setFormKeyword(e.target.value)}
              className="bg-background/50 border border-border rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="number"
              placeholder="Their Position"
              value={formPosition}
              onChange={(e) => setFormPosition(Number(e.target.value))}
              className="bg-background/50 border border-border rounded-lg px-3 py-2 text-sm"
            />
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
                <th className="px-4 py-3 font-medium text-right">Our Position</th>
                <th className="px-4 py-3 font-medium">Competitor</th>
                <th className="px-4 py-3 font-medium text-right">Their Position</th>
                <th className="px-4 py-3 font-medium text-right">Gap</th>
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
                  <td className="px-4 py-2 text-right">
                    {r.our_position != null ? (
                      <span className="font-medium">{r.our_position.toFixed(1)}</span>
                    ) : (
                      <span className="text-muted">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted">{r.competitor_domain}</td>
                  <td className="px-4 py-2 text-right">
                    {editingPos === r.id ? (
                      <input
                        autoFocus
                        type="number"
                        value={editPosVal}
                        onChange={(e) => setEditPosVal(e.target.value)}
                        onBlur={() => {
                          handleUpdate(r.id, "competitor_position", Number(editPosVal));
                          setEditingPos(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleUpdate(r.id, "competitor_position", Number(editPosVal));
                            setEditingPos(null);
                          }
                          if (e.key === "Escape") setEditingPos(null);
                        }}
                        className="bg-background/50 border border-border rounded px-2 py-1 text-xs w-20 text-right"
                      />
                    ) : (
                      <span
                        onClick={() => { setEditingPos(r.id); setEditPosVal(String(r.competitor_position)); }}
                        className="cursor-pointer hover:text-accent transition-colors"
                      >
                        {r.competitor_position}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    {r.gap != null ? (
                      <span className={r.gap < 0 ? "text-green-400" : r.gap > 0 ? "text-red-400" : "text-muted"}>
                        {r.gap < 0 ? r.gap : r.gap > 0 ? `+${r.gap}` : "0"}
                      </span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2 max-w-[180px]">
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
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-muted hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted">
                    No entries found
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
