"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  IndianRupee,
  Landmark,
  CheckCircle,
  Plus,
  Trash2,
  Search,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

/* ── Types ─────────────────────────────────────────── */

interface CollectionEntry {
  id: string;
  log_date: string;
  customer_name: string;
  amount: number; // paise
  payment_mode: string;
  reference_id: string | null;
  bank_confirmed: boolean;
  reconciled: boolean;
  notes: string | null;
  created_at: string;
}

interface NewEntry {
  customer_name: string;
  amount: string; // rupees string for input
  payment_mode: string;
  reference_id: string;
  bank_confirmed: boolean;
  reconciled: boolean;
  notes: string;
}

const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Card", "Cheque", "Other"];

const emptyNewEntry = (): NewEntry => ({
  customer_name: "",
  amount: "",
  payment_mode: "UPI",
  reference_id: "",
  bank_confirmed: false,
  reconciled: false,
  notes: "",
});

/* ── Main Component ────────────────────────────────── */

export default function CollectionLogPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [entries, setEntries] = useState<CollectionEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  // New row
  const [newRow, setNewRow] = useState<NewEntry | null>(null);
  const [saving, setSaving] = useState(false);

  // Inline editing
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchEntries = useCallback(async (date: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/payments/daily-collection?date=${date}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEntries(data.entries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load entries");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries(selectedDate);
  }, [selectedDate, fetchEntries]);

  /* ── Stats ──────────────────────────────────────── */

  const stats = useMemo(() => {
    const totalAmount = entries.reduce((s, e) => s + (e.amount || 0), 0);
    const bankConfirmed = entries.filter((e) => e.bank_confirmed).length;
    const reconciled = entries.filter((e) => e.reconciled).length;
    return { totalAmount, bankConfirmed, reconciled };
  }, [entries]);

  /* ── CRUD ───────────────────────────────────────── */

  const saveNewRow = async () => {
    if (!newRow) return;
    if (!newRow.customer_name.trim()) { setError("Customer name is required"); return; }
    if (!newRow.amount || parseFloat(newRow.amount) <= 0) { setError("Valid amount is required"); return; }

    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/payments/daily-collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          log_date: selectedDate,
          customer_name: newRow.customer_name.trim(),
          amount: Math.round(parseFloat(newRow.amount) * 100), // rupees to paise
          payment_mode: newRow.payment_mode,
          reference_id: newRow.reference_id.trim() || null,
          bank_confirmed: newRow.bank_confirmed,
          reconciled: newRow.reconciled,
          notes: newRow.notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEntries((prev) => [data.entry, ...prev]);
      setNewRow(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  const updateEntry = async (id: string, updates: Record<string, unknown>) => {
    try {
      const res = await apiFetch("/api/payments/daily-collection", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } as CollectionEntry : e)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      const res = await apiFetch(`/api/payments/daily-collection?id=${id}`, { method: "DELETE" });
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
    if (field === "amount") {
      value = Math.round((parseFloat(editValue) || 0) * 100); // rupees to paise
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
    { key: "customer_name", label: "Customer Name", width: "w-44" },
    { key: "amount", label: "Amount \u20B9", width: "w-32" },
    { key: "payment_mode", label: "Payment Mode", width: "w-36" },
    { key: "reference_id", label: "Reference ID", width: "w-40" },
    { key: "bank_confirmed", label: "Bank Confirmed", width: "w-32" },
    { key: "reconciled", label: "Reconciled", width: "w-28" },
    { key: "notes", label: "Notes", width: "w-48" },
    { key: "actions", label: "Actions", width: "w-20" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex-shrink-0 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-[#B8860B] rounded-full" />
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Collection Log</h1>
              <p className="text-muted text-xs mt-0.5">
                Daily collection reconciliation &mdash; {selectedDate}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-[#B8860B] [color-scheme:dark]"
            />
            <button
              onClick={() => setNewRow(emptyNewEntry())}
              disabled={!!newRow}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#B8860B] hover:bg-[#9A7209] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </button>
          </div>
        </div>
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
          label="Today's Collections"
          value={`\u20B9${(stats.totalAmount / 100).toLocaleString("en-IN", { minimumFractionDigits: 0 })}`}
          color="text-[#B8860B]"
          bg="bg-[#B8860B]/10"
        />
        <StatCard
          icon={<Landmark className="w-4 h-4" />}
          label="Bank Confirmed"
          value={`${stats.bankConfirmed}/${entries.length}`}
          color="text-blue-400"
          bg="bg-blue-500/10"
        />
        <StatCard
          icon={<CheckCircle className="w-4 h-4" />}
          label="Reconciled"
          value={`${stats.reconciled}/${entries.length}`}
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
              {/* New Row */}
              {newRow && (
                <tr className="border-b border-[#B8860B]/30 bg-[#B8860B]/5">
                  <td className="px-3 py-2 text-xs text-muted border-r border-border">*</td>
                  <td className="px-3 py-2 border-r border-border">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Customer name *"
                      value={newRow.customer_name}
                      onChange={(e) => setNewRow({ ...newRow, customer_name: e.target.value })}
                      className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-[#B8860B]"
                    />
                  </td>
                  <td className="px-3 py-2 border-r border-border">
                    <input
                      type="number"
                      placeholder="Amount *"
                      value={newRow.amount}
                      onChange={(e) => setNewRow({ ...newRow, amount: e.target.value })}
                      className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-[#B8860B]"
                    />
                  </td>
                  <td className="px-2 py-2 border-r border-border">
                    <select
                      value={newRow.payment_mode}
                      onChange={(e) => setNewRow({ ...newRow, payment_mode: e.target.value })}
                      className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none [&>option]:bg-surface"
                    >
                      {PAYMENT_MODES.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 border-r border-border">
                    <input
                      type="text"
                      placeholder="Reference ID"
                      value={newRow.reference_id}
                      onChange={(e) => setNewRow({ ...newRow, reference_id: e.target.value })}
                      className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-[#B8860B]"
                    />
                  </td>
                  <td className="px-3 py-2 border-r border-border text-center">
                    <input
                      type="checkbox"
                      checked={newRow.bank_confirmed}
                      onChange={(e) => setNewRow({ ...newRow, bank_confirmed: e.target.checked })}
                      className="w-4 h-4 rounded border-border accent-[#B8860B] cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2 border-r border-border text-center">
                    <input
                      type="checkbox"
                      checked={newRow.reconciled}
                      onChange={(e) => setNewRow({ ...newRow, reconciled: e.target.checked })}
                      className="w-4 h-4 rounded border-border accent-[#B8860B] cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2 border-r border-border">
                    <input
                      type="text"
                      placeholder="Notes"
                      value={newRow.notes}
                      onChange={(e) => setNewRow({ ...newRow, notes: e.target.value })}
                      className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-[#B8860B]"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={saveNewRow}
                        disabled={saving}
                        className="px-2 py-1 bg-[#B8860B] hover:bg-[#9A7209] text-white text-[10px] font-medium rounded transition-colors disabled:opacity-50"
                      >
                        {saving ? "..." : "Save"}
                      </button>
                      <button
                        onClick={() => setNewRow(null)}
                        className="px-2 py-1 bg-surface hover:bg-surface-hover text-muted text-[10px] rounded transition-colors border border-border"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Existing Entries */}
              {entries.length === 0 && !newRow ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="text-center py-16 text-muted text-sm">
                    No entries for {selectedDate}. Click &quot;Add Entry&quot; to start.
                  </td>
                </tr>
              ) : (
                entries.map((entry, idx) => (
                  <tr key={entry.id} className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors">
                    {/* # */}
                    <td className="px-3 py-2 text-xs text-muted border-r border-border">{idx + 1}</td>

                    {/* Customer Name (editable) */}
                    <td
                      className="px-3 py-2 text-xs border-r border-border cursor-pointer"
                      onClick={() => startEdit(entry.id, "customer_name", entry.customer_name)}
                    >
                      {editingCell?.id === entry.id && editingCell?.field === "customer_name" ? (
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
                        <span className="text-foreground font-medium">{entry.customer_name}</span>
                      )}
                    </td>

                    {/* Amount (editable, display in rupees) */}
                    <td
                      className="px-3 py-2 text-xs border-r border-border cursor-pointer"
                      onClick={() => startEdit(entry.id, "amount", String((entry.amount || 0) / 100))}
                    >
                      {editingCell?.id === entry.id && editingCell?.field === "amount" ? (
                        <input
                          autoFocus
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                          className="w-full bg-background border border-[#B8860B] rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none"
                        />
                      ) : (
                        <span className="text-foreground font-medium">
                          {`\u20B9${((entry.amount || 0) / 100).toLocaleString("en-IN")}`}
                        </span>
                      )}
                    </td>

                    {/* Payment Mode (dropdown) */}
                    <td className="px-2 py-1.5 border-r border-border">
                      <select
                        value={entry.payment_mode || ""}
                        onChange={(e) => updateEntry(entry.id, { payment_mode: e.target.value })}
                        className="w-full bg-transparent text-xs text-foreground border-none focus:outline-none cursor-pointer [&>option]:bg-surface"
                      >
                        {PAYMENT_MODES.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </td>

                    {/* Reference ID (editable) */}
                    <td
                      className="px-3 py-2 text-xs border-r border-border cursor-pointer"
                      onClick={() => startEdit(entry.id, "reference_id", entry.reference_id || "")}
                    >
                      {editingCell?.id === entry.id && editingCell?.field === "reference_id" ? (
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
                        <span className={entry.reference_id ? "text-foreground" : "text-muted/40 italic"}>
                          {entry.reference_id || "Click to add..."}
                        </span>
                      )}
                    </td>

                    {/* Bank Confirmed (checkbox) */}
                    <td className="px-3 py-2 border-r border-border text-center">
                      <input
                        type="checkbox"
                        checked={entry.bank_confirmed}
                        onChange={(e) => updateEntry(entry.id, { bank_confirmed: e.target.checked })}
                        className="w-4 h-4 rounded border-border accent-[#B8860B] cursor-pointer"
                      />
                    </td>

                    {/* Reconciled (checkbox) */}
                    <td className="px-3 py-2 border-r border-border text-center">
                      <input
                        type="checkbox"
                        checked={entry.reconciled}
                        onChange={(e) => updateEntry(entry.id, { reconciled: e.target.checked })}
                        className="w-4 h-4 rounded border-border accent-[#B8860B] cursor-pointer"
                      />
                    </td>

                    {/* Notes (editable) */}
                    <td
                      className="px-3 py-2 text-xs border-r border-border cursor-pointer"
                      onClick={() => startEdit(entry.id, "notes", entry.notes || "")}
                    >
                      {editingCell?.id === entry.id && editingCell?.field === "notes" ? (
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
                        <span className={entry.notes ? "text-foreground" : "text-muted/40 italic"}>
                          {entry.notes || "Click to add..."}
                        </span>
                      )}
                    </td>

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
