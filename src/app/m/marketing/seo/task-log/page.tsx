"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Loader2, Search, Trash2, Plus, CheckSquare, ListTodo,
  Clock, CheckCircle2, ChevronDown,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

/* ── Types ─────────────────────────────────────────────────── */

interface Task {
  id: string;
  title: string;
  task_type: string;
  status: string;
  page_url: string;
  keyword: string;
  due_date: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

/* ── Constants ─────────────────────────────────────────────── */

const TASK_TYPES = ["on_page", "technical", "content", "backlink", "local_seo", "other"] as const;
const STATUSES = ["todo", "in_progress", "done", "blocked"] as const;

const TYPE_COLORS: Record<string, string> = {
  on_page: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  technical: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  content: "bg-green-500/15 text-green-400 border-green-500/30",
  backlink: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  local_seo: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  other: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

const TYPE_LABELS: Record<string, string> = {
  on_page: "On-Page",
  technical: "Technical",
  content: "Content",
  backlink: "Backlink",
  local_seo: "Local SEO",
  other: "Other",
};

const STATUS_LABELS: Record<string, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
  blocked: "Blocked",
};

function isOverdue(dueDate: string | null, status: string) {
  if (!dueDate || status === "done") return false;
  return new Date(dueDate) < new Date(new Date().toISOString().slice(0, 10));
}

function isWithinLastWeek(dateStr: string) {
  const d = new Date(dateStr);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return d >= weekAgo;
}

/* ── Page ───────────────────────────────────────────────────── */

export default function TaskLogPage() {
  const [rows, setRows] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);

  /* Form state */
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState<string>("on_page");
  const [formUrl, setFormUrl] = useState("");
  const [formKeyword, setFormKeyword] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formNotes, setFormNotes] = useState("");

  /* Inline edit */
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editNotesVal, setEditNotesVal] = useState("");

  /* ── Fetch ──────────────────────────────────────────────── */

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/seo/task-log");
      const data = await res.json();
      setRows(data.rows ?? data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Stats ──────────────────────────────────────────────── */

  const stats = useMemo(() => ({
    total: rows.length,
    todo: rows.filter((r) => r.status === "todo").length,
    inProgress: rows.filter((r) => r.status === "in_progress").length,
    doneThisWeek: rows.filter((r) => r.status === "done" && isWithinLastWeek(r.updated_at)).length,
  }), [rows]);

  /* ── Filtering ──────────────────────────────────────────── */

  const filtered = useMemo(() => {
    let list = rows;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.title.toLowerCase().includes(q));
    }
    if (typeFilter !== "all") list = list.filter((r) => r.task_type === typeFilter);
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    return list;
  }, [rows, search, typeFilter, statusFilter]);

  /* ── CRUD ───────────────────────────────────────────────── */

  async function handleAdd() {
    if (!formTitle.trim()) return;
    try {
      await apiFetch("/api/seo/task-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim(),
          task_type: formType,
          page_url: formUrl,
          keyword: formKeyword,
          due_date: formDueDate || null,
          notes: formNotes,
        }),
      });
      setFormTitle("");
      setFormType("on_page");
      setFormUrl("");
      setFormKeyword("");
      setFormDueDate("");
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
      await apiFetch("/api/seo/task-log", {
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
      await apiFetch(`/api/seo/task-log?id=${id}`, { method: "DELETE" });
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
          <CheckSquare className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold">SEO Task Log</h1>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 text-red-400 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Tasks", value: stats.total, icon: ListTodo, color: "text-blue-400" },
          { label: "To Do", value: stats.todo, icon: Clock, color: "text-amber-400" },
          { label: "In Progress", value: stats.inProgress, icon: Loader2, color: "text-cyan-400" },
          { label: "Done This Week", value: stats.doneThisWeek, icon: CheckCircle2, color: "text-green-400" },
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
        {/* Type pills */}
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {(["all", ...TASK_TYPES] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                typeFilter === t ? "bg-accent text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {t === "all" ? "All" : TYPE_LABELS[t] ?? t}
            </button>
          ))}
        </div>

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
            placeholder="Search by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 bg-background/50 border border-border rounded-lg text-sm w-64"
          />
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-medium text-foreground">Add Task</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Title"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="bg-background/50 border border-border rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="bg-background/50 border border-border rounded-lg px-3 py-2 text-sm"
            >
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Page URL"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
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
              type="date"
              placeholder="Due Date"
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
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
              Add
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
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Page URL</th>
                <th className="px-4 py-3 font-medium">Keyword</th>
                <th className="px-4 py-3 font-medium">Due Date</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-border/50 hover:bg-surface-hover ${
                    isOverdue(r.due_date, r.status) ? "border-l-2 border-l-red-500" : ""
                  }`}
                >
                  <td className="px-4 py-2 max-w-[200px] truncate font-medium text-foreground">
                    {r.title}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLORS[r.task_type] ?? TYPE_COLORS.other}`}>
                      {TYPE_LABELS[r.task_type] ?? r.task_type}
                    </span>
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
                  <td className="px-4 py-2 max-w-[160px]">
                    {r.page_url ? (
                      <a
                        href={r.page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:underline truncate block"
                        title={r.page_url}
                      >
                        {r.page_url.replace(/^https?:\/\//, "").slice(0, 40)}
                      </a>
                    ) : (
                      <span className="text-muted text-xs">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs">{r.keyword || "-"}</td>
                  <td className={`px-4 py-2 text-xs ${isOverdue(r.due_date, r.status) ? "text-red-400" : ""}`}>
                    {r.due_date || "-"}
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
                  <td colSpan={8} className="py-12 text-center text-muted">
                    No tasks found
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
