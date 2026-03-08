"use client";

import { useEffect, useState, useMemo } from "react";
import {
  IndianRupee,
  Hash,
  CheckCircle,
  XCircle,
  TrendingUp,
  RotateCcw,
  Wallet,
  Percent,
} from "lucide-react";
import { PaymentsDashboardSkeleton } from "@/components/Skeleton";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";

/* ── Types ─────────────────────────────────────────── */

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  email: string;
  contact: string;
  razorpay_created_at: number;
}

interface Refund {
  id: string;
  amount: number;
  status: string;
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

const TOOLTIP_STYLE = {
  background: "#171717",
  border: "1px solid #262626",
  borderRadius: "8px",
  color: "#F5F5F5",
};

const COLORS = [
  "#B8860B", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#6366f1", "#14b8a6", "#f97316",
];

const STATUS_COLORS: Record<string, string> = {
  captured: "#22c55e",
  failed: "#ef4444",
  refunded: "#f59e0b",
  authorized: "#3b82f6",
  created: "#8b5cf6",
};

/* ── Helpers ───────────────────────────────────────── */

function currency(val: number) {
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function compact(val: number) {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(0);
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

/* ── Reusable Components ──────────────────────────── */

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

function WidgetCard({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-foreground tracking-wide">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

/* ── Main Dashboard ────────────────────────────────── */

export default function PaymentsDashboard() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
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

        const [paymentsRes, refundsRes] = await Promise.all([
          fetch(`/api/razorpay/payments?${params}`),
          fetch(`/api/razorpay/refunds?${params}`),
        ]);
        const [paymentsData, refundsData] = await Promise.all([
          paymentsRes.json(),
          refundsRes.json(),
        ]);
        if (paymentsData.error) throw new Error(paymentsData.error);
        setPayments(paymentsData.payments || []);
        setRefunds(refundsData.refunds || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [datePreset]);

  /* ── KPI Calculations ───────────────────────────── */
  const totals = useMemo(() => {
    let revenue = 0, capturedCount = 0, failedCount = 0, totalCount = 0;
    payments.forEach((p) => {
      totalCount++;
      if (p.status === "captured") {
        revenue += p.amount;
        capturedCount++;
      }
      if (p.status === "failed") failedCount++;
    });

    const successRate = totalCount > 0 ? (capturedCount / totalCount) * 100 : 0;
    const avgOrderValue = capturedCount > 0 ? revenue / capturedCount : 0;
    const totalRefunds = refunds.reduce((sum, r) => sum + r.amount, 0);
    const netRevenue = revenue - totalRefunds;
    const refundRate = capturedCount > 0 ? (refunds.length / capturedCount) * 100 : 0;

    return {
      revenue: revenue / 100,
      capturedCount,
      failedCount,
      totalCount,
      successRate,
      avgOrderValue: avgOrderValue / 100,
      totalRefunds: totalRefunds / 100,
      netRevenue: netRevenue / 100,
      refundRate,
    };
  }, [payments, refunds]);

  /* ── Revenue Over Time ──────────────────────────── */
  const dailyRevenue = useMemo(() => {
    const byDate: Record<string, number> = {};
    payments
      .filter((p) => p.status === "captured" && p.razorpay_created_at)
      .forEach((p) => {
        const date = new Date(p.razorpay_created_at * 1000).toISOString().slice(0, 10);
        byDate[date] = (byDate[date] || 0) + p.amount / 100;
      });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date: date.slice(5), amount }));
  }, [payments]);

  /* ── Payment Method Breakdown ───────────────────── */
  const methodData = useMemo(() => {
    const byMethod: Record<string, number> = {};
    payments
      .filter((p) => p.status === "captured")
      .forEach((p) => {
        const method = (p.method || "unknown").toUpperCase();
        byMethod[method] = (byMethod[method] || 0) + p.amount / 100;
      });
    return Object.entries(byMethod)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [payments]);

  /* ── Daily Payment Volume ───────────────────────── */
  const dailyVolume = useMemo(() => {
    const byDate: Record<string, number> = {};
    payments
      .filter((p) => p.razorpay_created_at)
      .forEach((p) => {
        const date = new Date(p.razorpay_created_at * 1000).toISOString().slice(0, 10);
        byDate[date] = (byDate[date] || 0) + 1;
      });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date: date.slice(5), count }));
  }, [payments]);

  /* ── Status Distribution ────────────────────────── */
  const statusData = useMemo(() => {
    const byStatus: Record<string, number> = {};
    payments.forEach((p) => {
      const status = p.status || "unknown";
      byStatus[status] = (byStatus[status] || 0) + 1;
    });
    return Object.entries(byStatus)
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        fill: STATUS_COLORS[name] || "#6b7280",
      }))
      .sort((a, b) => b.value - a.value);
  }, [payments]);

  /* ── Revenue vs Refunds ─────────────────────────── */
  const revenueVsRefunds = useMemo(() => {
    const byDate: Record<string, { revenue: number; refunds: number }> = {};
    payments
      .filter((p) => p.status === "captured" && p.razorpay_created_at)
      .forEach((p) => {
        const date = new Date(p.razorpay_created_at * 1000).toISOString().slice(0, 10);
        if (!byDate[date]) byDate[date] = { revenue: 0, refunds: 0 };
        byDate[date].revenue += p.amount / 100;
      });
    refunds
      .filter((r) => r.razorpay_created_at)
      .forEach((r) => {
        const date = new Date(r.razorpay_created_at * 1000).toISOString().slice(0, 10);
        if (!byDate[date]) byDate[date] = { revenue: 0, refunds: 0 };
        byDate[date].refunds += r.amount / 100;
      });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date: date.slice(5), ...data }));
  }, [payments, refunds]);

  /* ── Cumulative Revenue ─────────────────────────── */
  const cumulativeRevenue = useMemo(() => {
    let running = 0;
    return dailyRevenue.map((d) => {
      running += d.amount;
      return { date: d.date, cumulative: running };
    });
  }, [dailyRevenue]);

  /* ── Render ─────────────────────────────────────── */

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <h1 className="text-xl font-bold text-foreground tracking-tight">Payments Dashboard</h1>
        </div>
        <PaymentsDashboardSkeleton />
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
            <h1 className="text-xl font-bold text-foreground tracking-tight">Payments Dashboard</h1>
            <p className="text-muted text-xs mt-0.5">Razorpay payment overview — live data</p>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Revenue" value={currency(totals.revenue)} icon={IndianRupee} color="text-green-400" />
        <StatCard label="Payment Count" value={compact(totals.capturedCount)} icon={Hash} color="text-blue-400" />
        <StatCard label="Success Rate" value={`${totals.successRate.toFixed(1)}%`} icon={CheckCircle} color="text-emerald-400" />
        <StatCard label="Failed Payments" value={compact(totals.failedCount)} icon={XCircle} color="text-red-400" />
        <StatCard label="Avg Order Value" value={currency(totals.avgOrderValue)} icon={TrendingUp} color="text-amber-400" />
        <StatCard label="Refunds Issued" value={currency(totals.totalRefunds)} icon={RotateCcw} color="text-purple-400" />
        <StatCard label="Net Revenue" value={currency(totals.netRevenue)} icon={Wallet} color="text-teal-400" />
        <StatCard label="Refund Rate" value={`${totals.refundRate.toFixed(1)}%`} icon={Percent} color="text-pink-400" />
      </div>

      {/* Charts Row 1: Revenue + Method Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WidgetCard title="Revenue Over Time">
          {dailyRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyRevenue}>
                <XAxis dataKey="date" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                <Line type="monotone" dataKey="amount" stroke="#22c55e" strokeWidth={2} dot={false} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted text-sm">No data for this period</div>
          )}
        </WidgetCard>

        <WidgetCard title="Payment Method Breakdown">
          {methodData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={methodData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" label={({ name, value }) => `${name}: ${currency(value)}`} labelLine={false}>
                  {methodData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted text-sm">No data available</div>
          )}
        </WidgetCard>
      </div>

      {/* Charts Row 2: Volume + Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WidgetCard title="Daily Payment Volume">
          {dailyVolume.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyVolume}>
                <XAxis dataKey="date" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="#B8860B" radius={[4, 4, 0, 0]} name="Payments" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted text-sm">No data available</div>
          )}
        </WidgetCard>

        <WidgetCard title="Payment Status Distribution">
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted text-sm">No data available</div>
          )}
        </WidgetCard>
      </div>

      {/* Charts Row 3: Revenue vs Refunds + Cumulative */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WidgetCard title="Revenue vs Refunds">
          {revenueVsRefunds.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenueVsRefunds}>
                <XAxis dataKey="date" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={false} name="Revenue" />
                <Line type="monotone" dataKey="refunds" stroke="#ef4444" strokeWidth={2} dot={false} name="Refunds" />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted text-sm">No data available</div>
          )}
        </WidgetCard>

        <WidgetCard title="Cumulative Revenue">
          {cumulativeRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={cumulativeRevenue}>
                <XAxis dataKey="date" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                <Area type="monotone" dataKey="cumulative" stroke="#B8860B" fill="#B8860B" fillOpacity={0.15} strokeWidth={2} name="Cumulative" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted text-sm">No data available</div>
          )}
        </WidgetCard>
      </div>
    </div>
  );
}
