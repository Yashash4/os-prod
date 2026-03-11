"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Receipt, Plus, Trash2, Search, X, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

/* ── Types ─────────────────────────────────────────── */

interface Category {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  paid_by: string | null;
  status: string;
  notes: string | null;
  category_id: string | null;
  category: { id: string; name: string } | null;
  receipt_url: string | null;
  is_recurring: boolean;
  recurring_interval: string | null;
}

const STATUS_OPTIONS = ["pending", "approved", "rejected"];
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  approved: "bg-green-500/10 text-green-400 border-green-500/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
};

const INR = (n: number) => "₹" + n.toLocaleString("en-IN");

/* ── Component ─────────────────────────────────────── */

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");

  // Inline edit state
  const [editingCell, setEditingCell] = useState<{ id: string; key: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  // Add form state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    category_id: "",
    paid_by: "",
    notes: "",
    status: "pending",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [expRes, catRes] = await Promise.all([
        apiFetch("/api/finance/expenses"),
        apiFetch("/api/finance/categories"),
      ]);
      const expData = await expRes.json();
      const catData = await catRes.json();
      if (expData.error) throw new Error(expData.error);
      setExpenses(expData.records || []);
      setCategories(catData.categories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Create ── */
  const handleCreate = async () => {
    if (!form.title || !form.amount) return;
    try {
      const res = await apiFetch("/api/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
          category_id: form.category_id || null,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setExpenses((prev) => [data.record, ...prev]);
      setForm({ title: "", amount: "", date: new Date().toISOString().split("T")[0], category_id: "", paid_by: "", notes: "", status: "pending" });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  /* ── Update ── */
  const handleUpdate = async (id: string, updates: Record<string, unknown>) => {
    setSaving(id);
    try {
      const res = await apiFetch("/api/finance/expenses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setExpenses((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...updates, ...(data.record?.category ? { category: data.record.category } : {}) } as Expense : e))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(null);
    }
  };

  /* ── Delete ── */
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    try {
      const res = await apiFetch(`/api/finance/expenses?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  /* ── Inline edit ── */
  const startEdit = (id: string, key: string, value: unknown) => {
    setEditingCell({ id, key });
    setEditValue(value != null ? String(value) : "");
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const { id, key } = editingCell;
    const exp = expenses.find((e) => e.id === id);
    if (exp && String(exp[key as keyof Expense] ?? "") !== editValue) {
      const numKeys = ["amount"];
      const value = numKeys.includes(key) ? (parseFloat(editValue) || 0) : (editValue || null);
      handleUpdate(id, { [key]: value });
    }
    setEditingCell(null);
  };

  /* ── Filter ── */
  const filtered = useMemo(() => {
    let result = expenses;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.paid_by || "").toLowerCase().includes(q) ||
          (e.notes || "").toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") result = result.filter((e) => e.status === statusFilter);
    if (catFilter !== "all") result = result.filter((e) => e.category_id === catFilter);
    return result;
  }, [expenses, search, statusFilter, catFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 p-3 border-b border-red-500/20 flex items-center justify-between flex-shrink-0">
          {error}
          <button onClick={() => setError("")}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <Receipt className="w-5 h-5 text-accent" />
          <h1 className="text-lg font-bold">Expenses</h1>
        </div>

        {/* Add form toggle */}
        {showForm ? (
          <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Title *"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
              />
              <input
                type="number"
                placeholder="Amount *"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
              />
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent [color-scheme:dark]"
              />
              <select
                value={form.category_id}
                onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent [&>option]:bg-surface"
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Paid By"
                value={form.paid_by}
                onChange={(e) => setForm((f) => ({ ...f, paid_by: e.target.value }))}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
              />
              <input
                type="text"
                placeholder="Notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent col-span-2 md:col-span-1"
              />
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent [&>option]:bg-surface"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="bg-accent text-white px-4 py-2 rounded-lg text-sm hover:bg-accent/90 transition-colors"
              >
                Add Expense
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="border border-border text-muted px-4 py-2 rounded-lg text-sm hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search expenses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-accent placeholder:text-muted/50"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent [&>option]:bg-surface"
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent [&>option]:bg-surface"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 bg-accent text-white px-3 py-1.5 rounded-lg text-sm hover:bg-accent/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Expense
            </button>
            <span className="text-xs text-muted ml-auto">
              {filtered.length} of {expenses.length}
            </span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse min-w-[900px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface border-b border-border/50">
              {["Date", "Title", "Category", "Amount", "Paid By", "Status", "Notes", ""].map((h, i) => (
                <th
                  key={i}
                  className={`text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-4 py-2.5 border-r border-border last:border-r-0 ${
                    h === "Amount" ? "text-right" : ""
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => {
              const isEditing = (key: string) => editingCell?.id === e.id && editingCell?.key === key;

              return (
                <tr
                  key={e.id}
                  className={`border-b border-border/50 hover:bg-surface-hover/50 transition-colors ${saving === e.id ? "opacity-60" : ""}`}
                >
                  {/* Date */}
                  <td className="px-4 py-2 border-r border-border">
                    {isEditing("date") ? (
                      <input
                        type="date"
                        value={editValue}
                        onChange={(ev) => setEditValue(ev.target.value)}
                        onBlur={commitEdit}
                        autoFocus
                        className="bg-background border border-accent rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none [color-scheme:dark]"
                      />
                    ) : (
                      <span
                        className="text-xs text-muted cursor-pointer"
                        onClick={() => startEdit(e.id, "date", e.date)}
                      >
                        {new Date(e.date).toLocaleDateString("en-IN")}
                      </span>
                    )}
                  </td>

                  {/* Title */}
                  <td className="px-4 py-2 border-r border-border">
                    {isEditing("title") ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(ev) => setEditValue(ev.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(ev) => { if (ev.key === "Enter") commitEdit(); if (ev.key === "Escape") setEditingCell(null); }}
                        autoFocus
                        className="w-full bg-background border border-accent rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none"
                      />
                    ) : (
                      <span
                        className="text-sm cursor-pointer"
                        onClick={() => startEdit(e.id, "title", e.title)}
                      >
                        {e.title}
                      </span>
                    )}
                  </td>

                  {/* Category */}
                  <td className="px-4 py-2 border-r border-border">
                    <select
                      value={e.category_id || ""}
                      onChange={(ev) => handleUpdate(e.id, { category_id: ev.target.value || null })}
                      className="bg-transparent text-xs border-none focus:outline-none cursor-pointer text-muted [&>option]:bg-surface"
                    >
                      <option value="">None</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </td>

                  {/* Amount */}
                  <td className="px-4 py-2 border-r border-border text-right">
                    {isEditing("amount") ? (
                      <input
                        type="number"
                        value={editValue}
                        onChange={(ev) => setEditValue(ev.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(ev) => { if (ev.key === "Enter") commitEdit(); if (ev.key === "Escape") setEditingCell(null); }}
                        autoFocus
                        className="w-full bg-background border border-accent rounded px-1.5 py-0.5 text-xs text-foreground text-right focus:outline-none"
                      />
                    ) : (
                      <span
                        className="text-sm font-medium cursor-pointer"
                        onClick={() => startEdit(e.id, "amount", e.amount)}
                      >
                        {INR(e.amount)}
                      </span>
                    )}
                  </td>

                  {/* Paid By */}
                  <td className="px-4 py-2 border-r border-border">
                    {isEditing("paid_by") ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(ev) => setEditValue(ev.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(ev) => { if (ev.key === "Enter") commitEdit(); if (ev.key === "Escape") setEditingCell(null); }}
                        autoFocus
                        className="w-full bg-background border border-accent rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none"
                      />
                    ) : (
                      <span
                        className="text-xs text-muted cursor-pointer"
                        onClick={() => startEdit(e.id, "paid_by", e.paid_by)}
                      >
                        {e.paid_by || <span className="text-muted/40 italic">Click to add...</span>}
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-2 border-r border-border">
                    <select
                      value={e.status}
                      onChange={(ev) => handleUpdate(e.id, { status: ev.target.value })}
                      className={`bg-transparent text-[11px] border-none focus:outline-none cursor-pointer [&>option]:bg-surface ${
                        STATUS_COLORS[e.status]?.split(" ").find((c) => c.startsWith("text-")) || "text-muted"
                      }`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>

                  {/* Notes */}
                  <td className="px-4 py-2 border-r border-border">
                    {isEditing("notes") ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(ev) => setEditValue(ev.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(ev) => { if (ev.key === "Enter") commitEdit(); if (ev.key === "Escape") setEditingCell(null); }}
                        autoFocus
                        className="w-full bg-background border border-accent rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none"
                      />
                    ) : (
                      <span
                        className="text-xs text-muted cursor-pointer truncate block max-w-[200px]"
                        onClick={() => startEdit(e.id, "notes", e.notes)}
                      >
                        {e.notes || <span className="text-muted/40 italic">Click to add...</span>}
                      </span>
                    )}
                  </td>

                  {/* Delete */}
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleDelete(e.id)}
                      className="text-muted hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-16 text-center text-muted text-sm">
                  {expenses.length === 0 ? "No expenses yet" : "No matching expenses"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
