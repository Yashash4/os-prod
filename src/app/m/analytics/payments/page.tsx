"use client";

import { useEffect, useState, useMemo } from "react";
import {
  IndianRupee,
  Hash,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Wallet,
  Percent,
  Loader2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Zap,
} from "lucide-react";
import {
  AreaChart,
  Area,
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
  Line,
  ComposedChart,
} from "recharts";
import { apiFetch } from "@/lib/api-fetch";

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

interface HalfKPIs {
  revenue: number;
  capturedCount: number;
  failedCount: number;
  totalCount: number;
  successRate: number;
  avgOrderValue: number;
  totalRefunds: number;
  netRevenue: number;
  refundRate: number;
}

interface Insight {
  type: "warning" | "success" | "info";
  title: string;
  detail: string;
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
  "#06b6d4", "#ec4899",
];

const STATUS_COLORS: Record<string, string> = {
  captured: "#22c55e",
  failed: "#ef4444",
  refunded: "#f59e0b",
  authorized: "#3b82f6",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ── Helpers ───────────────────────────────────────── */

function currency(val: number) {
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function compact(val: number) {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(0);
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return 100;
  return ((current - previous) / Math.abs(previous)) * 100;
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

function computeKPIs(payments: Payment[], refunds: Refund[]): HalfKPIs {
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
}

/* ── Reusable Components ──────────────────────────── */

function DeltaBadge({ delta, invertColor = false }: { delta: number | null; invertColor?: boolean }) {
  if (delta === null) return null;
  const isPositive = delta > 0;
  const isNeutral = delta === 0;

  if (isNeutral) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted">
        0%
      </span>
    );
  }

  const isGood = invertColor ? !isPositive : isPositive;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
        isGood ? "text-green-400" : "text-red-400"
      }`}
    >
      {isPositive ? (
        <ArrowUpRight className="w-3 h-3" />
      ) : (
        <ArrowDownRight className="w-3 h-3" />
      )}
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color = "text-accent",
  delta,
  invertDelta = false,
}: {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  color?: string;
  delta?: number | null;
  invertDelta?: boolean;
}) {
  return (
    <div className="card rounded-xl p-4 transition-all">
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon className={`w-3.5 h-3.5 ${color}`} />}
        <span className="text-[10px] text-muted uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-xl font-bold text-foreground">{value}</span>
        {delta !== undefined && <DeltaBadge delta={delta} invertColor={invertDelta} />}
      </div>
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

function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const config = {
    warning: { icon: <AlertTriangle size={16} />, iconBg: "bg-amber-500/15", iconText: "text-amber-500", badge: "bg-amber-500/10 text-amber-500 border-amber-500/20", badgeLabel: "Needs Attention", glow: "shadow-amber-500/5" },
    success: { icon: <CheckCircle size={16} />, iconBg: "bg-green-500/15", iconText: "text-green-500", badge: "bg-green-500/10 text-green-500 border-green-500/20", badgeLabel: "Healthy", glow: "shadow-green-500/5" },
    info: { icon: <Activity size={16} />, iconBg: "bg-blue-500/15", iconText: "text-blue-500", badge: "bg-blue-500/10 text-blue-500 border-blue-500/20", badgeLabel: "Insight", glow: "shadow-blue-500/5" },
  }[insight.type];
  return (
    <div className={`card rounded-xl p-4 hover:shadow-lg transition-all ${config.glow}`} style={{ animationDelay: `${index * 50}ms` }}>
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 ${config.iconBg} ${config.iconText} shrink-0`}>{config.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground leading-tight">{insight.title}</span>
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border shrink-0 ${config.badge}`}>{config.badgeLabel}</span>
          </div>
          <p className="text-xs text-muted leading-relaxed">{insight.detail}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────── */

export default function PaymentsAnalyticsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [datePreset, setDatePreset] = useState("last_30d");

  useEffect(() => {
    const controller = new AbortController();

    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const { from, to } = getDateRange(datePreset);
        const params = new URLSearchParams();
        if (from) params.set("from", String(from));
        if (to) params.set("to", String(to));

        const [paymentsRes, refundsRes] = await Promise.all([
          apiFetch(`/api/razorpay/payments?${params}`, { signal: controller.signal }),
          apiFetch(`/api/razorpay/refunds?${params}`, { signal: controller.signal }),
        ]);
        const [paymentsData, refundsData] = await Promise.all([
          paymentsRes.json(),
          refundsRes.json(),
        ]);
        if (paymentsData.error) throw new Error(paymentsData.error);
        setPayments(paymentsData.payments || []);
        setRefunds(refundsData.refunds || []);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    return () => controller.abort();
  }, [datePreset]);

  /* ── KPI Calculations ───────────────────────────── */
  const totals = useMemo(() => computeKPIs(payments, refunds), [payments, refunds]);

  /* ── Period Delta (first half vs second half) ────── */
  const deltas = useMemo(() => {
    if (payments.length === 0) return null;

    const sorted = [...payments].sort((a, b) => a.razorpay_created_at - b.razorpay_created_at);
    const timestamps = sorted.map((p) => p.razorpay_created_at);
    const minTs = timestamps[0];
    const maxTs = timestamps[timestamps.length - 1];
    const midTs = Math.floor((minTs + maxTs) / 2);

    const firstHalfPayments = sorted.filter((p) => p.razorpay_created_at <= midTs);
    const secondHalfPayments = sorted.filter((p) => p.razorpay_created_at > midTs);

    const refundsSorted = [...refunds].sort((a, b) => a.razorpay_created_at - b.razorpay_created_at);
    const firstHalfRefunds = refundsSorted.filter((r) => r.razorpay_created_at <= midTs);
    const secondHalfRefunds = refundsSorted.filter((r) => r.razorpay_created_at > midTs);

    const first = computeKPIs(firstHalfPayments, firstHalfRefunds);
    const second = computeKPIs(secondHalfPayments, secondHalfRefunds);

    return {
      revenue: pctChange(second.revenue, first.revenue),
      capturedCount: pctChange(second.capturedCount, first.capturedCount),
      failedCount: pctChange(second.failedCount, first.failedCount),
      successRate: pctChange(second.successRate, first.successRate),
      avgOrderValue: pctChange(second.avgOrderValue, first.avgOrderValue),
      totalRefunds: pctChange(second.totalRefunds, first.totalRefunds),
      netRevenue: pctChange(second.netRevenue, first.netRevenue),
      refundRate: pctChange(second.refundRate, first.refundRate),
      firstHalf: first,
      secondHalf: second,
    };
  }, [payments, refunds]);

  /* ── Revenue Over Time (with 7-day rolling avg) ─── */
  const dailyRevenue = useMemo(() => {
    const byDate: Record<string, number> = {};
    payments
      .filter((p) => p.status === "captured" && p.razorpay_created_at)
      .forEach((p) => {
        const date = new Date(p.razorpay_created_at * 1000).toISOString().slice(0, 10);
        byDate[date] = (byDate[date] || 0) + p.amount / 100;
      });
    const sorted = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date: date.slice(5), fullDate: date, amount, rolling7d: 0 }));

    // Compute 7-day rolling average
    for (let i = 0; i < sorted.length; i++) {
      const windowStart = Math.max(0, i - 6);
      let sum = 0;
      for (let j = windowStart; j <= i; j++) {
        sum += sorted[j].amount;
      }
      sorted[i].rolling7d = sum / (i - windowStart + 1);
    }

    return sorted;
  }, [payments]);

  /* ── Cumulative Revenue ────────────────────────── */
  const cumulativeRevenue = useMemo(() => {
    let cumulative = 0;
    return dailyRevenue.map((d) => {
      cumulative += d.amount;
      return { date: d.date, cumulative };
    });
  }, [dailyRevenue]);

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

  /* ── Top 5 Payers ──────────────────────────────── */
  const topPayers = useMemo(() => {
    const byPayer: Record<string, number> = {};
    payments
      .filter((p) => p.status === "captured")
      .forEach((p) => {
        const key = p.email || p.contact || "Unknown";
        byPayer[key] = (byPayer[key] || 0) + p.amount / 100;
      });
    const sorted = Object.entries(byPayer)
      .map(([payer, amount]) => ({ payer, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const totalRevenue = totals.revenue;
    const top5Total = sorted.reduce((sum, p) => sum + p.amount, 0);
    const concentrationPct = totalRevenue > 0 ? (top5Total / totalRevenue) * 100 : 0;

    return { payers: sorted, concentrationPct, top5Total };
  }, [payments, totals.revenue]);

  /* ── Peak Day of Week ──────────────────────────── */
  const peakDay = useMemo(() => {
    const byDay: Record<number, number> = {};
    payments
      .filter((p) => p.status === "captured" && p.razorpay_created_at)
      .forEach((p) => {
        const day = new Date(p.razorpay_created_at * 1000).getDay();
        byDay[day] = (byDay[day] || 0) + p.amount / 100;
      });
    let maxDay = 0, maxAmount = 0;
    for (const [day, amount] of Object.entries(byDay)) {
      if (amount > maxAmount) {
        maxAmount = amount;
        maxDay = Number(day);
      }
    }
    return { day: DAY_NAMES[maxDay], amount: maxAmount };
  }, [payments]);

  /* ── High Value Payments ───────────────────────── */
  const highValuePayments = useMemo(() => {
    return payments.filter((p) => p.status === "captured" && p.amount / 100 > 50000);
  }, [payments]);

  /* ── Insights Generation ───────────────────────── */
  const insights = useMemo(() => {
    const items: Insight[] = [];

    // Success rate health
    if (totals.successRate >= 95) {
      items.push({
        type: "success",
        title: `Excellent Success Rate: ${totals.successRate.toFixed(1)}%`,
        detail: "Payment success rate is above 95%. Your checkout flow is performing exceptionally well.",
      });
    } else if (totals.successRate < 90 && totals.totalCount > 0) {
      items.push({
        type: "warning",
        title: `Low Success Rate: ${totals.successRate.toFixed(1)}%`,
        detail: "Payment success rate is below 90%. Consider reviewing checkout UX, payment gateway issues, or card decline patterns.",
      });
    }

    // Refund rate alert
    if (totals.refundRate > 5) {
      items.push({
        type: "warning",
        title: `High Refund Rate: ${totals.refundRate.toFixed(1)}%`,
        detail: "Refund rate exceeds 5%. Investigate product/service issues or potential fraud patterns.",
      });
    }

    // Revenue trend (compare halves)
    if (deltas) {
      const revDelta = deltas.revenue;
      if (revDelta !== null && revDelta > 10) {
        items.push({
          type: "success",
          title: `Revenue Growing: +${revDelta.toFixed(1)}%`,
          detail: `Revenue increased from ${currency(deltas.firstHalf.revenue)} in the first half to ${currency(deltas.secondHalf.revenue)} in the second half of this period.`,
        });
      } else if (revDelta !== null && revDelta < -10) {
        items.push({
          type: "warning",
          title: `Revenue Declining: ${revDelta.toFixed(1)}%`,
          detail: `Revenue dropped from ${currency(deltas.firstHalf.revenue)} to ${currency(deltas.secondHalf.revenue)} in the second half of this period.`,
        });
      }
    }

    // High-value payment detection
    if (highValuePayments.length > 0) {
      const maxPayment = Math.max(...highValuePayments.map((p) => p.amount / 100));
      items.push({
        type: "info",
        title: `${highValuePayments.length} High-Value Payment${highValuePayments.length > 1 ? "s" : ""} Detected`,
        detail: `Found ${highValuePayments.length} payment${highValuePayments.length > 1 ? "s" : ""} above ₹50K. Largest: ${currency(maxPayment)}.`,
      });
    }

    // Failed payment spikes
    const failedRate = totals.totalCount > 0 ? (totals.failedCount / totals.totalCount) * 100 : 0;
    if (failedRate > 15) {
      items.push({
        type: "warning",
        title: `Failed Payment Spike: ${failedRate.toFixed(1)}%`,
        detail: `${totals.failedCount} out of ${totals.totalCount} payments failed. This is above the 15% threshold. Check gateway health and card network issues.`,
      });
    }

    // AOV changes between halves
    if (deltas) {
      const aovDelta = deltas.avgOrderValue;
      if (aovDelta !== null && Math.abs(aovDelta) > 10) {
        items.push({
          type: aovDelta > 0 ? "info" : "warning",
          title: `AOV ${aovDelta > 0 ? "Increased" : "Decreased"}: ${aovDelta > 0 ? "+" : ""}${aovDelta.toFixed(1)}%`,
          detail: `Average order value shifted from ${currency(deltas.firstHalf.avgOrderValue)} to ${currency(deltas.secondHalf.avgOrderValue)}.`,
        });
      }
    }

    // Peak payment day
    if (peakDay.amount > 0) {
      items.push({
        type: "info",
        title: `Peak Day: ${peakDay.day}`,
        detail: `${peakDay.day} is the highest revenue day of the week with ${currency(peakDay.amount)} in total captured payments.`,
      });
    }

    // Revenue concentration
    if (topPayers.payers.length >= 5 && topPayers.concentrationPct > 50) {
      items.push({
        type: "warning",
        title: `High Revenue Concentration: ${topPayers.concentrationPct.toFixed(0)}%`,
        detail: `Top 5 payers account for ${topPayers.concentrationPct.toFixed(1)}% of total revenue (${currency(topPayers.top5Total)}). Consider diversifying your customer base.`,
      });
    } else if (topPayers.payers.length >= 5) {
      items.push({
        type: "success",
        title: `Healthy Revenue Distribution`,
        detail: `Top 5 payers account for only ${topPayers.concentrationPct.toFixed(1)}% of revenue. Revenue is well-distributed across customers.`,
      });
    }

    if (items.length === 0) {
      items.push({ type: "success", title: "Payments Healthy", detail: "No anomalies detected in your payment metrics." });
    }

    return items;
  }, [totals, deltas, highValuePayments, peakDay, topPayers]);

  const sortedInsights = useMemo(() => [
    ...insights.filter((i) => i.type === "warning"),
    ...insights.filter((i) => i.type === "info"),
    ...insights.filter((i) => i.type === "success"),
  ], [insights]);

  /* ── Render ─────────────────────────────────────── */

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <h1 className="text-xl font-bold text-foreground tracking-tight">Payments Analytics</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-muted animate-spin" />
        </div>
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
            <h1 className="text-xl font-bold text-foreground tracking-tight">Payments Analytics</h1>
            <p className="text-muted text-xs mt-0.5">Revenue insights and payment trends</p>
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
        <StatCard label="Total Revenue" value={currency(totals.revenue)} icon={IndianRupee} color="text-green-400" delta={deltas?.revenue} />
        <StatCard label="Payment Count" value={compact(totals.capturedCount)} icon={Hash} color="text-blue-400" delta={deltas?.capturedCount} />
        <StatCard label="Success Rate" value={`${totals.successRate.toFixed(1)}%`} icon={CheckCircle} color="text-emerald-400" delta={deltas?.successRate} />
        <StatCard label="Failed" value={compact(totals.failedCount)} icon={XCircle} color="text-red-400" delta={deltas?.failedCount} invertDelta />
        <StatCard label="Avg Order Value" value={currency(totals.avgOrderValue)} icon={TrendingUp} color="text-amber-400" delta={deltas?.avgOrderValue} />
        <StatCard label="Refunds" value={currency(totals.totalRefunds)} icon={RotateCcw} color="text-purple-400" delta={deltas?.totalRefunds} invertDelta />
        <StatCard label="Net Revenue" value={currency(totals.netRevenue)} icon={Wallet} color="text-teal-400" delta={deltas?.netRevenue} />
        <StatCard label="Refund Rate" value={`${totals.refundRate.toFixed(1)}%`} icon={Percent} color="text-pink-400" delta={deltas?.refundRate} invertDelta />
      </div>

      {/* Insights */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1.5"><Zap size={14} className="text-accent" /><h2 className="text-sm font-bold text-foreground">Insights</h2></div>
          <div className="h-px flex-1 bg-border/50" />
          <span className="text-[10px] text-muted">{sortedInsights.filter((i) => i.type === "warning").length} alerts</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sortedInsights.map((ins, i) => (<InsightCard key={i} insight={ins} index={i} />))}
        </div>
      </section>

      {/* Charts Row 1: Revenue Over Time (with rolling avg) + Method Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WidgetCard title="Revenue Over Time" right={<span className="text-[10px] text-muted">— 7d rolling avg</span>}>
          {dailyRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={dailyRevenue}>
                <XAxis dataKey="date" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [currency(Number(v)), name === "rolling7d" ? "7d Avg" : "Revenue"]} />
                <Area type="monotone" dataKey="amount" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} strokeWidth={2} name="Revenue" />
                <Line type="monotone" dataKey="rolling7d" stroke="#B8860B" strokeWidth={2} strokeDasharray="5 3" dot={false} name="7d Avg" />
              </ComposedChart>
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

      {/* Charts Row 2: Cumulative Revenue + Top Payers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WidgetCard title="Cumulative Revenue">
          {cumulativeRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={cumulativeRevenue}>
                <XAxis dataKey="date" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                <Area type="monotone" dataKey="cumulative" stroke="#B8860B" fill="#B8860B" fillOpacity={0.15} strokeWidth={2} name="Cumulative Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted text-sm">No data for this period</div>
          )}
        </WidgetCard>

        <WidgetCard
          title="Top 5 Payers"
          right={
            topPayers.payers.length > 0 ? (
              <span className="text-[10px] text-muted">{topPayers.concentrationPct.toFixed(1)}% of revenue</span>
            ) : undefined
          }
        >
          {topPayers.payers.length > 0 ? (
            <div className="space-y-3">
              {topPayers.payers.map((p, i) => {
                const pctOfTotal = totals.revenue > 0 ? (p.amount / totals.revenue) * 100 : 0;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-accent w-5 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-foreground truncate max-w-[160px]">{p.payer}</span>
                        <span className="text-xs font-semibold text-foreground">{currency(p.amount)}</span>
                      </div>
                      <div className="w-full bg-border rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${Math.min(pctOfTotal, 100)}%`,
                            backgroundColor: COLORS[i % COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-muted text-sm">No data available</div>
          )}
        </WidgetCard>
      </div>

      {/* Charts Row 3: Daily Volume + Status Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WidgetCard title="Daily Volume">
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
    </div>
  );
}
