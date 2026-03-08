"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Hash,
  IndianRupee,
  TrendingUp,
  CreditCard,
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
} from "recharts";

/* ── Types ─────────────────────────────────────────── */

interface Payment {
  id: string;
  amount: number;
  status: string;
  method: string;
  razorpay_created_at: number;
}

interface Refund {
  id: string;
  amount: number;
  razorpay_created_at: number;
}

interface Settlement {
  id: string;
  amount: number;
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

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const GRANULARITY_OPTIONS = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];

/* ── Helpers ───────────────────────────────────────── */

function currency(val: number) {
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function compact(val: number) {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(0);
}

function getWeekKey(date: Date) {
  const year = date.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const week = Math.ceil(((date.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
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

/* ── Main Component ────────────────────────────────── */

export default function AnalyticsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [granularity, setGranularity] = useState("daily");
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

        const [paymentsRes, refundsRes, settlementsRes] = await Promise.all([
          fetch(`/api/razorpay/payments?${params}`),
          fetch(`/api/razorpay/refunds?${params}`),
          fetch(`/api/razorpay/settlements?${params}`),
        ]);
        const [paymentsData, refundsData, settlementsData] = await Promise.all([
          paymentsRes.json(),
          refundsRes.json(),
          settlementsRes.json(),
        ]);
        if (paymentsData.error) throw new Error(paymentsData.error);
        setPayments(paymentsData.payments || []);
        setRefunds(refundsData.refunds || []);
        setSettlements(settlementsData.settlements || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [datePreset]);

  /* ── Summary Stats ──────────────────────────────── */
  const summaryStats = useMemo(() => {
    const captured = payments.filter((p) => p.status === "captured");
    const totalRevenue = captured.reduce((s, p) => s + p.amount, 0) / 100;
    const uniqueDays = new Set(
      captured
        .filter((p) => p.razorpay_created_at)
        .map((p) => new Date(p.razorpay_created_at * 1000).toISOString().slice(0, 10))
    ).size;
    const avgDailyRevenue = uniqueDays > 0 ? totalRevenue / uniqueDays : 0;
    const highestPayment = captured.length > 0 ? Math.max(...captured.map((p) => p.amount)) / 100 : 0;

    const methodCounts: Record<string, number> = {};
    captured.forEach((p) => {
      const m = (p.method || "unknown").toUpperCase();
      methodCounts[m] = (methodCounts[m] || 0) + 1;
    });
    const topMethod = Object.entries(methodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

    return {
      totalTransactions: payments.length,
      avgDailyRevenue,
      highestPayment,
      topMethod,
    };
  }, [payments]);

  /* ── Revenue Trend ──────────────────────────────── */
  const revenueTrend = useMemo(() => {
    const byPeriod: Record<string, number> = {};
    payments
      .filter((p) => p.status === "captured" && p.razorpay_created_at)
      .forEach((p) => {
        const date = new Date(p.razorpay_created_at * 1000);
        let key: string;
        if (granularity === "monthly") {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        } else if (granularity === "weekly") {
          key = getWeekKey(date);
        } else {
          key = date.toISOString().slice(0, 10);
        }
        byPeriod[key] = (byPeriod[key] || 0) + p.amount / 100;
      });
    return Object.entries(byPeriod)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, amount]) => ({ period, amount }));
  }, [payments, granularity]);

  /* ── Payment Method Distribution ────────────────── */
  const methodDistribution = useMemo(() => {
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

  /* ── Success Rate Over Time ─────────────────────── */
  const successRateTrend = useMemo(() => {
    const byDate: Record<string, { total: number; captured: number }> = {};
    payments
      .filter((p) => p.razorpay_created_at)
      .forEach((p) => {
        const date = new Date(p.razorpay_created_at * 1000).toISOString().slice(0, 10);
        if (!byDate[date]) byDate[date] = { total: 0, captured: 0 };
        byDate[date].total++;
        if (p.status === "captured") byDate[date].captured++;
      });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { total, captured }]) => ({
        date: date.slice(5),
        rate: total > 0 ? parseFloat(((captured / total) * 100).toFixed(1)) : 0,
      }));
  }, [payments]);

  /* ── Peak Payment Hours ─────────────────────────── */
  const peakHours = useMemo(() => {
    const byHour = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2, "0")}:00`, count: 0 }));
    payments
      .filter((p) => p.razorpay_created_at)
      .forEach((p) => {
        const hour = new Date(p.razorpay_created_at * 1000).getHours();
        byHour[hour].count++;
      });
    return byHour;
  }, [payments]);

  /* ── Peak Payment Days ──────────────────────────── */
  const peakDays = useMemo(() => {
    const byDay = DAY_NAMES.map((name) => ({ name, count: 0 }));
    payments
      .filter((p) => p.razorpay_created_at)
      .forEach((p) => {
        const day = new Date(p.razorpay_created_at * 1000).getDay();
        byDay[day].count++;
      });
    return byDay;
  }, [payments]);

  /* ── Amount Distribution ────────────────────────── */
  const amountBuckets = useMemo(() => {
    const buckets = [
      { name: "₹0-500", min: 0, max: 50000, count: 0 },
      { name: "₹500-1K", min: 50000, max: 100000, count: 0 },
      { name: "₹1K-5K", min: 100000, max: 500000, count: 0 },
      { name: "₹5K-10K", min: 500000, max: 1000000, count: 0 },
      { name: "₹10K+", min: 1000000, max: Infinity, count: 0 },
    ];
    payments
      .filter((p) => p.status === "captured")
      .forEach((p) => {
        const bucket = buckets.find((b) => p.amount >= b.min && p.amount < b.max);
        if (bucket) bucket.count++;
      });
    return buckets.map(({ name, count }) => ({ name, count }));
  }, [payments]);

  /* ── Refund Trend ───────────────────────────────── */
  const refundTrend = useMemo(() => {
    const byDate: Record<string, number> = {};
    refunds
      .filter((r) => r.razorpay_created_at)
      .forEach((r) => {
        const date = new Date(r.razorpay_created_at * 1000).toISOString().slice(0, 10);
        byDate[date] = (byDate[date] || 0) + r.amount / 100;
      });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date: date.slice(5), amount }));
  }, [refunds]);

  /* ── Fees & Tax Breakdown ───────────────────────── */
  const feesBreakdown = useMemo(() => {
    return settlements
      .filter((s) => s.razorpay_created_at)
      .sort((a, b) => a.razorpay_created_at - b.razorpay_created_at)
      .map((s) => ({
        date: new Date(s.razorpay_created_at * 1000).toISOString().slice(5, 10),
        fees: (s.fees || 0) / 100,
        tax: (s.tax || 0) / 100,
      }));
  }, [settlements]);

  /* ── Render ─────────────────────────────────────── */

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <h1 className="text-xl font-bold text-foreground tracking-tight">Payment Analytics</h1>
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
            <h1 className="text-xl font-bold text-foreground tracking-tight">Payment Analytics</h1>
            <p className="text-muted text-xs mt-0.5">Deep payment insights and trends</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
            value={granularity}
            onChange={(e) => setGranularity(e.target.value)}
            className="px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
          >
            {GRANULARITY_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">{error}</div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Transactions" value={compact(summaryStats.totalTransactions)} icon={Hash} color="text-blue-400" />
        <StatCard label="Avg Daily Revenue" value={currency(summaryStats.avgDailyRevenue)} icon={IndianRupee} color="text-green-400" />
        <StatCard label="Highest Payment" value={currency(summaryStats.highestPayment)} icon={TrendingUp} color="text-amber-400" />
        <StatCard label="Top Method" value={summaryStats.topMethod} icon={CreditCard} color="text-purple-400" />
      </div>

      {/* Row 1: Revenue Trend + Method Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WidgetCard title="Revenue Trend">
          {revenueTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={revenueTrend}>
                <XAxis dataKey="period" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                <Line type="monotone" dataKey="amount" stroke="#22c55e" strokeWidth={2} dot={false} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted text-sm">No data available</div>
          )}
        </WidgetCard>

        <WidgetCard title="Payment Method Distribution">
          {methodDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={methodDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${currency(value)}`} labelLine>
                  {methodDistribution.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted text-sm">No data available</div>
          )}
        </WidgetCard>
      </div>

      {/* Row 2: Success Rate + Peak Hours */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WidgetCard title="Success Rate Over Time">
          {successRateTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={successRateTrend}>
                <XAxis dataKey="date" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${v}%`} />
                <Line type="monotone" dataKey="rate" stroke="#B8860B" strokeWidth={2} dot={false} name="Success Rate" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted text-sm">No data available</div>
          )}
        </WidgetCard>

        <WidgetCard title="Peak Payment Hours">
          {peakHours.some((h) => h.count > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={peakHours}>
                <XAxis dataKey="hour" tick={{ fill: "#A3A3A3", fontSize: 9 }} axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[2, 2, 0, 0]} name="Payments" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted text-sm">No data available</div>
          )}
        </WidgetCard>
      </div>

      {/* Row 3: Peak Days + Amount Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WidgetCard title="Peak Payment Days">
          {peakDays.some((d) => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={peakDays}>
                <XAxis dataKey="name" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Payments" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted text-sm">No data available</div>
          )}
        </WidgetCard>

        <WidgetCard title="Amount Distribution">
          {amountBuckets.some((b) => b.count > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={amountBuckets}>
                <XAxis dataKey="name" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Payments" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted text-sm">No data available</div>
          )}
        </WidgetCard>
      </div>

      {/* Row 4: Refund Trend + Fees Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WidgetCard title="Refund Trend">
          {refundTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={refundTrend}>
                <XAxis dataKey="date" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                <Line type="monotone" dataKey="amount" stroke="#ef4444" strokeWidth={2} dot={false} name="Refunds" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted text-sm">No refund data</div>
          )}
        </WidgetCard>

        <WidgetCard title="Fees & Tax Breakdown">
          {feesBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={feesBreakdown}>
                <XAxis dataKey="date" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                <Bar dataKey="fees" stackId="a" fill="#ef4444" name="Fees" />
                <Bar dataKey="tax" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Tax" />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted text-sm">No settlement data</div>
          )}
        </WidgetCard>
      </div>
    </div>
  );
}
