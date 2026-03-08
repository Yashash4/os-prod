"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Search,
  Download,
  Loader2,
  IndianRupee,
  FileText,
  Clock,
  Hash,
  ExternalLink,
} from "lucide-react";
import { PaymentsTableSkeleton } from "@/components/Skeleton";

/* ── Types ─────────────────────────────────────────── */

interface Invoice {
  id: string;
  type: string;
  status: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  description: string;
  short_url: string;
  customer_details?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  created_at: number;
  issued_at: number;
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

const STATUS_OPTIONS = ["All", "draft", "issued", "partially_paid", "paid", "cancelled", "expired"];

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-500/10 text-green-400 border-green-500/20",
  issued: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  partially_paid: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  draft: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  expired: "bg-red-500/10 text-red-400 border-red-500/20",
};

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

function StatCard({
  label,
  value,
  icon: Icon,
  color = "text-accent",
}: {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  color?: string;
}) {
  return (
    <div className="card rounded-xl p-4 transition-all">
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon className={`w-3.5 h-3.5 ${color}`} />}
        <span className="text-[10px] text-muted uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-xl font-bold text-foreground">{value}</span>
    </div>
  );
}

/* ── Main Component ────────────────────────────────── */

export default function InvoicesPage() {
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [datePreset, setDatePreset] = useState("last_30d");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const { from, to } = getDateRange(datePreset);
        const params = new URLSearchParams();
        if (from) params.set("from", String(from));
        if (to) params.set("to", String(to));

        const res = await fetch(`/api/razorpay/invoices?${params}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setAllInvoices(data.invoices || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [datePreset]);

  const filtered = useMemo(() => {
    let result = allInvoices;
    if (statusFilter !== "All") {
      result = result.filter((inv) => inv.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((inv) =>
        (inv.id && inv.id.toLowerCase().includes(q)) ||
        (inv.customer_details?.email && inv.customer_details.email.toLowerCase().includes(q)) ||
        (inv.customer_details?.name && inv.customer_details.name.toLowerCase().includes(q))
      );
    }
    return result;
  }, [allInvoices, statusFilter, search]);

  const totals = useMemo(() => {
    let totalInvoiced = 0, totalPaid = 0, totalDue = 0;
    allInvoices.forEach((inv) => {
      totalInvoiced += inv.amount || 0;
      totalPaid += inv.amount_paid || 0;
      totalDue += inv.amount_due || 0;
    });
    return {
      totalInvoiced: totalInvoiced / 100,
      totalPaid: totalPaid / 100,
      totalDue: totalDue / 100,
      count: allInvoices.length,
    };
  }, [allInvoices]);

  function exportCSV() {
    if (filtered.length === 0) return;
    const headers = ["Invoice ID", "Customer", "Email", "Amount (₹)", "Paid (₹)", "Due (₹)", "Status", "Created"];
    const rows = filtered.map((inv) => [
      inv.id,
      inv.customer_details?.name || "",
      inv.customer_details?.email || "",
      ((inv.amount || 0) / 100).toFixed(2),
      ((inv.amount_paid || 0) / 100).toFixed(2),
      ((inv.amount_due || 0) / 100).toFixed(2),
      inv.status,
      inv.created_at ? new Date(inv.created_at * 1000).toISOString() : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading && allInvoices.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <h1 className="text-xl font-bold text-foreground tracking-tight">Invoices</h1>
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
            <h1 className="text-xl font-bold text-foreground tracking-tight">Invoices</h1>
            <p className="text-muted text-xs mt-0.5">Razorpay invoices and payment links</p>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Invoiced" value={`₹${totals.totalInvoiced.toLocaleString("en-IN")}`} icon={FileText} color="text-blue-400" />
        <StatCard label="Total Paid" value={`₹${totals.totalPaid.toLocaleString("en-IN")}`} icon={IndianRupee} color="text-green-400" />
        <StatCard label="Outstanding" value={`₹${totals.totalDue.toLocaleString("en-IN")}`} icon={Clock} color="text-amber-400" />
        <StatCard label="Invoice Count" value={totals.count} icon={Hash} color="text-purple-400" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search by ID, name, or email..."
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
              {s === "All" ? "All Statuses" : s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
      </div>

      {/* Table */}
      <div className="card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Invoice ID</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Customer</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Amount</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Paid</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Due</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Status</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Created</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Link</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted">
                    No invoices found for this period.
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{inv.id}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-foreground">{inv.customer_details?.name || "—"}</div>
                      <div className="text-[10px] text-muted">{inv.customer_details?.email || ""}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{currency(inv.amount || 0)}</td>
                    <td className="px-4 py-3 text-green-400 text-xs">{currency(inv.amount_paid || 0)}</td>
                    <td className="px-4 py-3 text-amber-400 text-xs">{currency(inv.amount_due || 0)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_COLORS[inv.status] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                        {inv.status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">{formatDate(inv.created_at)}</td>
                    <td className="px-4 py-3">
                      {inv.short_url ? (
                        <a href={inv.short_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
