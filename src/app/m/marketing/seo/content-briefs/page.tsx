"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Loader2, Search, Trash2, Plus, FileEdit, PenLine,
  Eye, BookOpen, Archive,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

/* ── Types ─────────────────────────────────────────────────── */

interface Brief {
  id: string;
  title: string;
  target_keyword: string;
  target_url: string;
  status: string;
  word_count_target: number | null;
  assigned_to: string;
  notes: string;
  created_at: string;
}

/* ── Constants ─────────────────────────────────────────────── */

const STATUSES = ["draft", "writing", "review", "published", "archived"] as const;

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  writing: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  review: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  published: "bg-green-500/15 text-green-400 border-green-500/30",
  archived: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  writing: "Writing",
  review: "Review",
  published: "Published",
  archived: "Archived",
};

/* ── Page ───────────────────────────────────────────────────── */

export default function ContentBriefsPage() {
  const [rows, setRows] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);

  /* Form state */
  const [formTitle, setFormTitle] = useState("");
  const [formKeyword, setFormKeyword] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formWordCount, setFormWordCount] = useState<number>(1500);
  const [formAssigned, setFormAssigned] = useState("");
  const [formNotes, setFormNotes] = useState("");

  /* Inline edit */
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editNotesVal, setEditNotesVal] = useState("");
  const [editingAssigned, setEditingAssigned] = useState<string | null>(null);
  const [editAssignedVal, setEditAssignedVal] = useState("");

  /* ── Fetch ──────────────────────────────────────────────── */

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/seo/content-briefs");
      const data = await res.json();
      setRows(Array.isArray(data.briefs) ? data.briefs : Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load briefs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Stats ──────────────────────────────────────────────── */

  const stats = useMemo(() => ({
    total: rows.length,
    writing: rows.filter((r) => r.status === "writing").length,
    review: rows.filter((r) => r.status === "review").length,
    published: rows.filter((r) => r.status === "published").length,
  }), [rows]);

  /* ── Filtering ──────────────────────────────────────────── */

  const filtered = useMemo(() => {
    let list = rows;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) => r.title.toLowerCase().includes(q) || r.target_keyword.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    return list;
  }, [rows, search, statusFilter]);

  /* ── CRUD ───────────────────────────────────────────────── */

  async function handleAdd() {
    if (!formTitle.trim()) return;
    try {
      await apiFetch("/api/seo/content-briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim(),
          target_keyword: formKeyword,
          target_url: formUrl,
          word_count_target: formWordCount || null,
          assigned_to: formAssigned,
          notes: formNotes,
        }),
      });
      setFormTitle("");
      setFormKeyword("");
      setFormUrl("");
      setFormWordCount(1500);
      setFormAssigned("");
      setFormNotes("");
      setShowForm(false);
      fetchData();
    } catch {}
  }

  async function handleUpdate(id: string, field: string, value: string) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
    try {
      await apiFetch("/api/seo/content-briefs", {
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
      await apiFetch(`/api/seo/content-briefs?id=${id}`, { method: "DELETE" });
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
          <FileEdit className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold">Content Briefs</h1>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Brief
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 text-red-400 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Briefs", value: stats.total, icon: FileEdit, color: "text-blue-400" },
          { label: "In Writing", value: stats.writing, icon: PenLine, color: "text-blue-400" },
          { label: "In Review", value: stats.review, icon: Eye, color: "text-amber-400" },
          { label: "Published", value: stats.published, icon: BookOpen, color: "text-green-400" },
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
        {/* Status pills */}
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {(["all", ...STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                statusFilter === s ? "bg-accent text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {s === "all" ? "All" : STATUS_LABELS[s] ?? s}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search title or keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 bg-background/50 border border-border rounded-lg text-sm w-72"
          />
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-medium text-foreground">New Brief</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Title"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="bg-background/50 border border-border rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Target Keyword"
              value={formKeyword}
              onChange={(e) => setFormKeyword(e.target.value)}
              className="bg-background/50 border border-border rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Target URL"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              className="bg-background/50 border border-border rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="number"
              placeholder="Word Count Target"
              value={formWordCount}
              onChange={(e) => setFormWordCount(Number(e.target.value))}
              className="bg-background/50 border border-border rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Assigned To"
              value={formAssigned}
              onChange={(e) => setFormAssigned(e.target.value)}
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
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-border rounded-lg text-sm text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Target Keyword</th>
                <th className="px-4 py-3 font-medium">Target URL</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Word Count</th>
                <th className="px-4 py-3 font-medium">Assigned To</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-surface-hover">
                  <td className="px-4 py-2 max-w-[200px] truncate font-medium text-foreground">
                    {r.title}
                  </td>
                  <td className="px-4 py-2 text-xs">{r.target_keyword || "-"}</td>
                  <td className="px-4 py-2 max-w-[160px]">
                    {r.target_url ? (
                      <a
                        href={r.target_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:underline truncate block"
                        title={r.target_url}
                      >
                        {r.target_url.replace(/^https?:\/\//, "").slice(0, 35)}
                      </a>
                    ) : (
                      <span className="text-muted text-xs">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={r.status}
                      onChange={(e) => handleUpdate(r.id, "status", e.target.value)}
                      className="bg-background/50 border border-border rounded px-2 py-1 text-xs"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right text-xs">
                    {r.word_count_target ? r.word_count_target.toLocaleString("en-IN") : "-"}
                  </td>
                  <td className="px-4 py-2 max-w-[120px]">
                    {editingAssigned === r.id ? (
                      <input
                        autoFocus
                        type="text"
                        value={editAssignedVal}
                        onChange={(e) => setEditAssignedVal(e.target.value)}
                        onBlur={() => {
                          handleUpdate(r.id, "assigned_to", editAssignedVal);
                          setEditingAssigned(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleUpdate(r.id, "assigned_to", editAssignedVal);
                            setEditingAssigned(null);
                          }
                          if (e.key === "Escape") setEditingAssigned(null);
                        }}
                        className="bg-background/50 border border-border rounded px-2 py-1 text-xs w-full"
                      />
                    ) : (
                      <span
                        onClick={() => { setEditingAssigned(r.id); setEditAssignedVal(r.assigned_to ?? ""); }}
                        className="text-xs text-muted truncate block cursor-pointer hover:text-foreground"
                      >
                        {r.assigned_to || "..."}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN") : "-"}
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
                  <td colSpan={9} className="py-12 text-center text-muted">
                    No briefs found
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
