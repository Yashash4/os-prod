"use client";

import { useEffect, useState, useMemo } from "react";
import {
  IndianRupee,
  Landmark,
  Clock,
  CheckCircle,
} from "lucide-react";
import { PaymentsTableSkeleton } from "@/components/Skeleton";
import { apiFetch } from "@/lib/api-fetch";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ── Types ─────────────────────────────────────────── */

interface Settlement {
  id: string;
  amount: number;
  status: string;
  utr: string;
  fees: number;
  tax: number;
  razorpay_created_at: number;
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

const STATUS_COLORS: Record<string, string> = {
  processed: "bg-green-500/10 text-green-400 border-green-500/20",
  created: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
};

const TOOLTIP_STYLE = {
  background: "#171717",
  border: "1px solid #262626",
  borderRadius: "8px",
  color: "#F5F5F5",
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

function WidgetCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card rounded-xl p-4">
      <h3 className="text-sm font-bold text-foreground tracking-wide mb-4">{title}</h3>
      {children}
    </div>
  );
}

/* ── Main Component ────────────────────────────────── */

export default function SettlementsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [datePreset, setDatePreset] = useState("last_30d");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const { from, to } = getDateRange(datePreset);
        const params = new URLSearchParams();
        if (from) params.set("from", String(from));
        if (to) params.set("to", String(to));

        const res = await apiFetch(`/api/razorpay/settlements?${params}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setSettlements(data.settlements || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [datePreset]);

  const totals = useMemo(() => {
    let totalSettled = 0, pending = 0, totalFees = 0;
    let lastDate = 0;

    settlements.forEach((s) => {
      if (s.status === "processed") {
        totalSettled += s.amount;
        if (s.razorpay_created_at > lastDate) lastDate = s.razorpay_created_at;
      } else {
        pending += s.amount;
      }
      totalFees += s.fees || 0;
    });

    return {
      totalSettled: totalSettled / 100,
      pending: pending / 100,
      totalFees: totalFees / 100,
      lastDate: lastDate ? formatDate(lastDate) : "—",
    };
  }, [settlements]);

  const timelineData = useMemo(() => {
    return settlements
      .filter((s) => s.razorpay_created_at)
      .sort((a, b) => a.razorpay_created_at - b.razorpay_created_at)
      .map((s) => ({
        date: new Date(s.razorpay_created_at * 1000).toISOString().slice(5, 10),
        amount: s.amount / 100,
        fees: (s.fees || 0) / 100,
      }));
  }, [settlements]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <h1 className="text-xl font-bold text-foreground tracking-tight">Settlements</h1>
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
            <h1 className="text-xl font-bold text-foreground tracking-tight">Settlements</h1>
            <p className="text-muted text-xs mt-0.5">Bank settlement cycles from Razorpay</p>
          </div>
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
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">{error}</div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Settled" value={`₹${totals.totalSettled.toLocaleString("en-IN")}`} icon={IndianRupee} color="text-green-400" />
        <StatCard label="Pending" value={`₹${totals.pending.toLocaleString("en-IN")}`} icon={Clock} color="text-amber-400" />
        <StatCard label="Total Fees" value={`₹${totals.totalFees.toLocaleString("en-IN")}`} icon={Landmark} color="text-red-400" />
        <StatCard label="Last Settlement" value={totals.lastDate} icon={CheckCircle} color="text-blue-400" />
      </div>

      {/* Settlement Timeline */}
      {timelineData.length > 0 && (
        <WidgetCard title="Settlement Timeline">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={timelineData}>
              <XAxis dataKey="date" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`} />
              <Bar dataKey="amount" fill="#22c55e" radius={[4, 4, 0, 0]} name="Amount" />
              <Bar dataKey="fees" fill="#ef4444" radius={[4, 4, 0, 0]} name="Fees" />
            </BarChart>
          </ResponsiveContainer>
        </WidgetCard>
      )}

      {/* Table */}
      <div className="card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Settlement ID</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Amount</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Status</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">UTR</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Fees</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Tax</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {settlements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">
                    No settlements found for this period.
                  </td>
                </tr>
              ) : (
                settlements.map((s) => (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{s.id}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{currency(s.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_COLORS[s.status] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{s.utr || "—"}</td>
                    <td className="px-4 py-3 text-muted text-xs">{currency(s.fees || 0)}</td>
                    <td className="px-4 py-3 text-muted text-xs">{currency(s.tax || 0)}</td>
                    <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">{formatDate(s.razorpay_created_at)}</td>
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
