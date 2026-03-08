"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Bookmark,
  X,
} from "lucide-react";
import { PaymentsTableSkeleton } from "@/components/Skeleton";

/* ── Types ─────────────────────────────────────────── */

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  email: string;
  contact: string;
  description: string;
  razorpay_created_at: number;
}

interface AmountGroup {
  id: string;
  name: string;
  min_amount: number | null;
  max_amount: number | null;
}

/* ── Constants ─────────────────────────────────────── */

const DATE_PRESETS = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 Days", value: "last_7d" },
  { label: "Last 30 Days", value: "last_30d" },
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "All Time", value: "all" },
];

const STATUS_OPTIONS = ["All", "captured", "failed", "refunded", "authorized", "created"];
const METHOD_OPTIONS = ["All", "card", "upi", "netbanking", "wallet", "emi"];

const STATUS_COLORS: Record<string, string> = {
  captured: "bg-green-500/10 text-green-400 border-green-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
  refunded: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  authorized: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  created: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

const PAGE_SIZE = 50;

/* ── Helpers ───────────────────────────────────────── */

function currency(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDate(ts: number) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDateRange(preset: string): { from?: number; to?: number } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  const toUnix = (d: Date) => Math.floor(d.getTime() / 1000);

  switch (preset) {
    case "today":
      return { from: toUnix(startOfDay(now)), to: toUnix(endOfDay(now)) };
    case "yesterday": {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { from: toUnix(startOfDay(y)), to: toUnix(endOfDay(y)) };
    }
    case "last_7d": {
      const d = new Date(now); d.setDate(d.getDate() - 7);
      return { from: toUnix(startOfDay(d)), to: toUnix(endOfDay(now)) };
    }
    case "last_30d": {
      const d = new Date(now); d.setDate(d.getDate() - 30);
      return { from: toUnix(startOfDay(d)), to: toUnix(endOfDay(now)) };
    }
    case "this_month":
      return { from: toUnix(new Date(now.getFullYear(), now.getMonth(), 1)), to: toUnix(endOfDay(now)) };
    case "last_month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toUnix(first), to: toUnix(endOfDay(last)) };
    }
    default:
      return {};
  }
}

/* ── Main Component ────────────────────────────────── */

export default function TransactionsPage() {
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [datePreset, setDatePreset] = useState("last_30d");

  // Client-side filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [methodFilter, setMethodFilter] = useState("All");
  const [page, setPage] = useState(0);

  // Amount range filter
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  // Saved groups
  const [groups, setGroups] = useState<AmountGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [groupName, setGroupName] = useState("");

  /* ── Fetch payments ─────────────────────────────── */

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const { from, to } = getDateRange(datePreset);
        const params = new URLSearchParams();
        if (from) params.set("from", String(from));
        if (to) params.set("to", String(to));

        const res = await fetch(`/api/razorpay/payments?${params}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setAllPayments(data.payments || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [datePreset]);

  /* ── Fetch saved groups ─────────────────────────── */

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/razorpay/amount-groups");
      const data = await res.json();
      setGroups(data.groups || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  /* ── Group helpers ──────────────────────────────── */

  function applyGroup(g: AmountGroup) {
    if (activeGroupId === g.id) {
      // Deselect
      setActiveGroupId(null);
      setMinAmount("");
      setMaxAmount("");
    } else {
      setActiveGroupId(g.id);
      setMinAmount(g.min_amount != null ? String(g.min_amount / 100) : "");
      setMaxAmount(g.max_amount != null ? String(g.max_amount / 100) : "");
    }
  }

  async function saveGroup() {
    const name = groupName.trim();
    if (!name) return;
    const min = minAmount ? Math.round(parseFloat(minAmount) * 100) : null;
    const max = maxAmount ? Math.round(parseFloat(maxAmount) * 100) : null;
    if (min == null && max == null) return;

    try {
      await fetch("/api/razorpay/amount-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, min_amount: min, max_amount: max }),
      });
      setGroupName("");
      setShowSaveDialog(false);
      fetchGroups();
    } catch { /* ignore */ }
  }

  async function deleteGroup(id: string) {
    try {
      await fetch(`/api/razorpay/amount-groups?id=${id}`, { method: "DELETE" });
      if (activeGroupId === id) {
        setActiveGroupId(null);
        setMinAmount("");
        setMaxAmount("");
      }
      fetchGroups();
    } catch { /* ignore */ }
  }

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [search, statusFilter, methodFilter, datePreset, minAmount, maxAmount]);

  // Clear activeGroupId when user manually changes amount inputs
  function handleMinChange(v: string) {
    setMinAmount(v);
    setActiveGroupId(null);
  }
  function handleMaxChange(v: string) {
    setMaxAmount(v);
    setActiveGroupId(null);
  }

  /* ── Client-side filtering ──────────────────────── */

  const filtered = useMemo(() => {
    let result = allPayments;
    if (statusFilter !== "All") {
      result = result.filter((p) => p.status === statusFilter);
    }
    if (methodFilter !== "All") {
      result = result.filter((p) => p.method === methodFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((p) =>
        (p.id && p.id.toLowerCase().includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.contact && p.contact.includes(q))
      );
    }
    if (minAmount) {
      const min = parseFloat(minAmount) * 100;
      if (!isNaN(min)) result = result.filter((p) => p.amount >= min);
    }
    if (maxAmount) {
      const max = parseFloat(maxAmount) * 100;
      if (!isNaN(max)) result = result.filter((p) => p.amount <= max);
    }
    return result;
  }, [allPayments, statusFilter, methodFilter, search, minAmount, maxAmount]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  function exportCSV() {
    if (filtered.length === 0) return;
    const headers = ["Payment ID", "Amount (₹)", "Status", "Method", "Email", "Contact", "Date"];
    const rows = filtered.map((p) => [
      p.id,
      (p.amount / 100).toFixed(2),
      p.status,
      p.method || "",
      p.email || "",
      p.contact || "",
      p.razorpay_created_at ? new Date(p.razorpay_created_at * 1000).toISOString() : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading && allPayments.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <h1 className="text-xl font-bold text-foreground tracking-tight">Transactions</h1>
        </div>
        <PaymentsTableSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Transactions</h1>
            <p className="text-muted text-xs mt-0.5">{filtered.length} payments {statusFilter !== "All" && `(${statusFilter})`}</p>
          </div>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-muted hover:text-foreground transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">{error}</div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search by ID, email, or contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-background/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <select
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value)}
          className="px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
        >
          {DATE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === "All" ? "All Statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
        >
          {METHOD_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m === "All" ? "All Methods" : m.toUpperCase()}
            </option>
          ))}
        </select>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
      </div>

      {/* Amount Range Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Amount:</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted">₹</span>
            <input
              type="number"
              placeholder="Min"
              value={minAmount}
              onChange={(e) => handleMinChange(e.target.value)}
              className="w-24 px-2 py-1.5 bg-background/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <span className="text-xs text-muted">—</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted">₹</span>
            <input
              type="number"
              placeholder="Max"
              value={maxAmount}
              onChange={(e) => handleMaxChange(e.target.value)}
              className="w-24 px-2 py-1.5 bg-background/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Save Group Button */}
        {(minAmount || maxAmount) && (
          <div className="relative">
            <button
              onClick={() => setShowSaveDialog(!showSaveDialog)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent/10 border border-accent/20 rounded-lg text-xs text-accent hover:bg-accent/20 transition-colors"
            >
              <Bookmark className="w-3.5 h-3.5" />
              Save Group
            </button>
            {showSaveDialog && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowSaveDialog(false)} />
                <div className="absolute top-full left-0 mt-1 w-64 bg-surface border border-border rounded-lg shadow-xl z-30 p-3 space-y-2">
                  <p className="text-xs text-muted">
                    Save ₹{minAmount || "0"} – ₹{maxAmount || "∞"} as a group
                  </p>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Group name..."
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveGroup(); }}
                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowSaveDialog(false)}
                      className="px-2.5 py-1 text-xs text-muted hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveGroup}
                      disabled={!groupName.trim()}
                      className="px-2.5 py-1 text-xs bg-accent text-white rounded-md hover:bg-accent/80 disabled:opacity-40 transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Clear amount filter */}
        {(minAmount || maxAmount) && (
          <button
            onClick={() => { setMinAmount(""); setMaxAmount(""); setActiveGroupId(null); }}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Clear range
          </button>
        )}
      </div>

      {/* Saved Group Pills */}
      {groups.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted uppercase tracking-wider">Groups:</span>
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => applyGroup(g)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                activeGroupId === g.id
                  ? "bg-accent/20 text-accent border-accent/40"
                  : "bg-surface border-border text-muted hover:text-foreground hover:border-border/80"
              }`}
            >
              {g.name}
              <span className="text-[10px] opacity-60">
                ₹{g.min_amount != null ? (g.min_amount / 100).toLocaleString("en-IN") : "0"}
                –₹{g.max_amount != null ? (g.max_amount / 100).toLocaleString("en-IN") : "∞"}
              </span>
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); deleteGroup(g.id); }}
                className="ml-0.5 p-0.5 rounded-full hover:bg-red-500/20 hover:text-red-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Payment ID</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Amount</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Status</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Method</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Email</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Contact</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">
                    No payments found for this period.
                  </td>
                </tr>
              ) : (
                paginated.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{p.id}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{currency(p.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_COLORS[p.status] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted uppercase text-xs">{p.method || "—"}</td>
                    <td className="px-4 py-3 text-muted text-xs">{p.email || "—"}</td>
                    <td className="px-4 py-3 text-muted text-xs">{p.contact || "—"}</td>
                    <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">{formatDate(p.razorpay_created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg hover:bg-surface-hover text-muted disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted px-2">{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg hover:bg-surface-hover text-muted disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
