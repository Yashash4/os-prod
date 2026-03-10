"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Plus, Trash2, Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { DataTableSkeleton } from "@/components/Skeleton";
import { apiFetch } from "@/lib/api-fetch";

/* ── Types ───────────────────────────────────────── */

export interface Column {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "date" | "url" | "number";
  options?: string[];
  width?: string;
  placeholder?: string;
}

interface ContentSheetProps {
  columns: Column[];
  apiPath: string;
  queryParams?: Record<string, string>;
  statusKey?: string;
  statusOptions: string[];
  statusColors: Record<string, string>;
  defaultNewRow?: Record<string, unknown>;
}

type Row = Record<string, unknown> & { id: string };
type SortDir = "asc" | "desc";

/* ── Component ───────────────────────────────────── */

export default function ContentSheet({
  columns,
  apiPath,
  queryParams = {},
  statusKey = "status",
  statusOptions,
  statusColors,
  defaultNewRow = {},
}: ContentSheetProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editingCell, setEditingCell] = useState<{ rowId: string; key: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [saving, setSaving] = useState<string | null>(null);

  /* ── Build query string ── */
  const qs = useMemo(() => {
    const params = new URLSearchParams(queryParams);
    return params.toString() ? `?${params.toString()}` : "";
  }, [queryParams]);

  /* ── Fetch ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${apiPath}${qs}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRows(data.records || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [apiPath, qs]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Create ── */
  const handleCreate = async () => {
    try {
      const newRow = { title: "Untitled", ...defaultNewRow, ...queryParams };
      const res = await apiFetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRow),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRows((prev) => [data.record, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  /* ── Update ── */
  const handleUpdate = async (id: string, updates: Record<string, unknown>) => {
    setSaving(id);
    try {
      const res = await apiFetch(apiPath, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(null);
    }
  };

  /* ── Delete ── */
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this row?")) return;
    try {
      const res = await apiFetch(`${apiPath}?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  /* ── Inline edit ── */
  const startEdit = (rowId: string, key: string, value: unknown) => {
    setEditingCell({ rowId, key });
    setEditValue(value != null ? String(value) : "");
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const { rowId, key } = editingCell;
    const row = rows.find((r) => r.id === rowId);
    if (row && String(row[key] ?? "") !== editValue) {
      const value = columns.find((c) => c.key === key)?.type === "number"
        ? (parseFloat(editValue) || 0)
        : (editValue || null);
      handleUpdate(rowId, { [key]: value });
    }
    setEditingCell(null);
  };

  /* ── Sort ── */
  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  /* ── Filter & sort ── */
  const filtered = useMemo(() => {
    let result = rows;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q))
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((r) => r[statusKey] === statusFilter);
    }
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = String(a[sortKey] ?? "");
        const bv = String(b[sortKey] ?? "");
        const cmp = av.localeCompare(bv, undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [rows, search, statusFilter, statusKey, sortKey, sortDir, columns]);

  /* ── Status counts ── */
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: rows.length };
    for (const opt of statusOptions) counts[opt] = 0;
    for (const r of rows) {
      const s = String(r[statusKey] ?? "");
      if (s in counts) counts[s]++;
    }
    return counts;
  }, [rows, statusOptions, statusKey]);

  /* ── Render ── */

  if (loading) return <DataTableSkeleton cols={columns.length + 1} />;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {error && (
        <div className="mx-0 mb-0 text-red-400 text-sm bg-red-500/10 p-3 border-b border-red-500/20 flex items-center justify-between flex-shrink-0">
          {error}
          <button onClick={() => setError("")}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 bg-surface/50 flex-shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-accent placeholder:text-muted/50"
          />
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-1.5 bg-accent text-white px-3 py-1.5 rounded-lg text-sm hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Row
        </button>
        <span className="text-xs text-muted ml-auto">
          {filtered.length} of {rows.length} records
        </span>
      </div>

      {/* Status pills */}
      <div className="flex gap-2 px-4 py-2 flex-wrap flex-shrink-0 border-b border-border/50">
        {["all", ...statusOptions].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-colors capitalize ${
              statusFilter === s
                ? "bg-accent/10 border-accent/20 text-accent"
                : "border-border text-muted hover:border-border/80"
            }`}
          >
            {s.replace(/_/g, " ")} <span>{statusCounts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse min-w-[1200px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface border-b border-border/50">
              <th className="w-10 text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5 border-r border-border">#</th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5 border-r border-border last:border-r-0 cursor-pointer hover:text-foreground select-none"
                  style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                  onClick={() => toggleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </span>
                </th>
              ))}
              <th className="w-12 text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, idx) => (
              <tr
                key={row.id}
                className={`border-b border-border/50 hover:bg-surface-hover/50 transition-colors ${saving === row.id ? "opacity-60" : ""}`}
              >
                <td className="px-3 py-2 text-xs text-muted border-r border-border">{idx + 1}</td>
                {columns.map((col) => {
                  const isEditing = editingCell?.rowId === row.id && editingCell?.key === col.key;
                  const value = row[col.key];

                  /* Select cell */
                  if (col.type === "select") {
                    return (
                      <td key={col.key} className="px-2 py-1.5 border-r border-border">
                        <select
                          value={String(value ?? "")}
                          onChange={(e) => handleUpdate(row.id, { [col.key]: e.target.value })}
                          className={`w-full bg-transparent text-xs border-none focus:outline-none cursor-pointer [&>option]:bg-surface ${statusColors[String(value ?? "")] || "text-muted"}`}
                        >
                          {col.options?.map((opt) => (
                            <option key={opt} value={opt}>{opt.replace(/_/g, " ")}</option>
                          ))}
                        </select>
                      </td>
                    );
                  }

                  /* Textarea cell editing */
                  if (col.type === "textarea" && isEditing) {
                    return (
                      <td key={col.key} className="px-3 py-2 border-r border-border">
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => { if (e.key === "Escape") setEditingCell(null); }}
                          autoFocus
                          className="w-full bg-background border border-accent rounded px-1.5 py-0.5 text-xs text-foreground resize-none h-16 focus:outline-none"
                        />
                      </td>
                    );
                  }

                  /* Editing normal cell */
                  if (isEditing) {
                    return (
                      <td key={col.key} className="px-3 py-2 border-r border-border">
                        <input
                          type={col.type === "number" ? "number" : col.type === "date" ? "date" : "text"}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit();
                            if (e.key === "Escape") setEditingCell(null);
                          }}
                          autoFocus
                          className="w-full bg-background border border-accent rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none [color-scheme:dark]"
                        />
                      </td>
                    );
                  }

                  /* Display cell */
                  return (
                    <td
                      key={col.key}
                      className="px-3 py-2 text-xs border-r border-border cursor-pointer"
                      onClick={() => startEdit(row.id, col.key, value)}
                    >
                      {col.type === "url" && value ? (
                        <a
                          href={String(value)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {String(value).replace(/^https?:\/\//, "").slice(0, 40)}
                        </a>
                      ) : col.type === "date" && value ? (
                        <span className="text-foreground">{new Date(String(value)).toLocaleDateString()}</span>
                      ) : value ? (
                        <span className="text-foreground">{String(value)}</span>
                      ) : (
                        <span className="text-muted/40 italic">Click to add...</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2">
                  <button
                    onClick={() => handleDelete(row.id)}
                    className="text-muted hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="py-16 text-center text-muted text-sm">
                  {rows.length === 0 ? "No records yet — click \"Add Row\" to get started" : "No matching records"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
