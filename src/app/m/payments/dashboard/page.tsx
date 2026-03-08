"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  IndianRupee,
  Hash,
  CheckCircle,
  XCircle,
  TrendingUp,
  RotateCcw,
  Wallet,
  Percent,
  ArrowUp,
  ArrowDown,
  Target,
  AlertTriangle,
  Clock,
  RefreshCw,
  ShieldAlert,
  CreditCard,
} from "lucide-react";
import Link from "next/link";
import { PaymentsDashboardSkeleton } from "@/components/Skeleton";
import { apiFetch } from "@/lib/api-fetch";
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

interface RevenueTarget {
  id?: string;
  period_type: "daily" | "weekly" | "monthly";
  target_amount: number;
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

function getTodayRange(): { from: number; to: number } {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return { from: Math.floor(startOfDay.getTime() / 1000), to: Math.floor(endOfDay.getTime() / 1000) };
}

function getYesterdayRange(): { from: number; to: number } {
  const now = new Date();
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const startOfDay = new Date(y.getFullYear(), y.getMonth(), y.getDate());
  const endOfDay = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59);
  return { from: Math.floor(startOfDay.getTime() / 1000), to: Math.floor(endOfDay.getTime() / 1000) };
}

function computeTotals(payments: Payment[], refunds: Refund[]) {
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

function DeltaIndicator({ current, prev }: { current: number; prev: number | undefined }) {
  if (prev === undefined || prev === null) return null;
  if (current === prev || (prev === 0 && current === 0)) {
    return <span className="text-[10px] text-muted ml-1">--</span>;
  }
  if (prev === 0) {
    return (
      <span className="inline-flex items-center text-[10px] text-green-400 ml-1">
        <ArrowUp className="w-2.5 h-2.5 mr-0.5" />new
      </span>
    );
  }
  const pct = ((current - prev) / Math.abs(prev)) * 100;
  const isUp = pct > 0;
  return (
    <span className={`inline-flex items-center text-[10px] ml-1 ${isUp ? "text-green-400" : "text-red-400"}`}>
      {isUp ? <ArrowUp className="w-2.5 h-2.5 mr-0.5" /> : <ArrowDown className="w-2.5 h-2.5 mr-0.5" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color = "text-accent",
  prevValue,
  currentNumeric,
}: {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  color?: string;
  prevValue?: number;
  currentNumeric?: number;
}) {
  return (
    <div className="card rounded-xl p-4 transition-all">
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon className={`w-3.5 h-3.5 ${color}`} />}
        <span className="text-[10px] text-muted uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline">
        <span className="text-xl font-bold text-foreground">{value}</span>
        {prevValue !== undefined && currentNumeric !== undefined && (
          <DeltaIndicator current={currentNumeric} prev={prevValue} />
        )}
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

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    captured: "bg-green-500/20 text-green-400",
    failed: "bg-red-500/20 text-red-400",
    authorized: "bg-blue-500/20 text-blue-400",
    refunded: "bg-amber-500/20 text-amber-400",
    created: "bg-purple-500/20 text-purple-400",
  };
  const cls = colorMap[status] || "bg-gray-500/20 text-gray-400";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cls}`}>
      {status}
    </span>
  );
}

/* ── Main Dashboard ────────────────────────────────── */

export default function PaymentsDashboard() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [yesterdayPayments, setYesterdayPayments] = useState<Payment[]>([]);
  const [yesterdayRefunds, setYesterdayRefunds] = useState<Refund[]>([]);
  const [todayPayments, setTodayPayments] = useState<Payment[]>([]);
  const [todayRefunds, setTodayRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [datePreset, setDatePreset] = useState("last_30d");

  // Revenue Targets
  const [targets, setTargets] = useState<RevenueTarget[]>([]);
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [targetPeriod, setTargetPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [targetAmount, setTargetAmount] = useState("");
  const [savingTarget, setSavingTarget] = useState(false);

  const fetchTodayData = useCallback(async () => {
    try {
      const todayRange = getTodayRange();
      const todayParams = new URLSearchParams();
      todayParams.set("from", String(todayRange.from));
      todayParams.set("to", String(todayRange.to));

      const [pRes, rRes] = await Promise.all([
        apiFetch(`/api/razorpay/payments?${todayParams}`),
        apiFetch(`/api/razorpay/refunds?${todayParams}`),
      ]);
      const [pData, rData] = await Promise.all([pRes.json(), rRes.json()]);
      setTodayPayments(pData.payments || []);
      setTodayRefunds(rData.refunds || []);
    } catch {
      // silently fail for live feed refresh
    }
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const { from, to } = getDateRange(datePreset);
        const params = new URLSearchParams();
        if (from) params.set("from", String(from));
        if (to) params.set("to", String(to));

        // Always fetch today + yesterday for comparison, plus the selected preset
        const todayRange = getTodayRange();
        const yesterdayRange = getYesterdayRange();

        const todayParams = new URLSearchParams();
        todayParams.set("from", String(todayRange.from));
        todayParams.set("to", String(todayRange.to));

        const yesterdayParams = new URLSearchParams();
        yesterdayParams.set("from", String(yesterdayRange.from));
        yesterdayParams.set("to", String(yesterdayRange.to));

        const [
          paymentsRes, refundsRes,
          todayPayRes, todayRefRes,
          yesterdayPayRes, yesterdayRefRes,
          targetsRes,
        ] = await Promise.all([
          apiFetch(`/api/razorpay/payments?${params}`),
          apiFetch(`/api/razorpay/refunds?${params}`),
          apiFetch(`/api/razorpay/payments?${todayParams}`),
          apiFetch(`/api/razorpay/refunds?${todayParams}`),
          apiFetch(`/api/razorpay/payments?${yesterdayParams}`),
          apiFetch(`/api/razorpay/refunds?${yesterdayParams}`),
          apiFetch(`/api/payments/revenue-targets`).catch(() => null),
        ]);

        const [
          paymentsData, refundsData,
          todayPayData, todayRefData,
          yesterdayPayData, yesterdayRefData,
        ] = await Promise.all([
          paymentsRes.json(),
          refundsRes.json(),
          todayPayRes.json(),
          todayRefRes.json(),
          yesterdayPayRes.json(),
          yesterdayRefRes.json(),
        ]);

        if (paymentsData.error) throw new Error(paymentsData.error);

        setPayments(paymentsData.payments || []);
        setRefunds(refundsData.refunds || []);
        setTodayPayments(todayPayData.payments || []);
        setTodayRefunds(todayRefData.refunds || []);
        setYesterdayPayments(yesterdayPayData.payments || []);
        setYesterdayRefunds(yesterdayRefData.refunds || []);

        if (targetsRes) {
          const targetsData = await targetsRes.json();
          setTargets(targetsData.targets || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [datePreset]);

  // Auto-refresh today's payments every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchTodayData, 60_000);
    return () => clearInterval(interval);
  }, [fetchTodayData]);

  /* ── KPI Calculations ───────────────────────────── */
  const totals = useMemo(() => computeTotals(payments, refunds), [payments, refunds]);
  const todayTotals = useMemo(() => computeTotals(todayPayments, todayRefunds), [todayPayments, todayRefunds]);
  const yesterdayTotals = useMemo(() => computeTotals(yesterdayPayments, yesterdayRefunds), [yesterdayPayments, yesterdayRefunds]);

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

  /* ── Action Items (from already-fetched data) ───── */
  const actionItems = useMemo(() => {
    const failedCount = payments.filter((p) => p.status === "failed").length;
    const authorizedCount = payments.filter((p) => p.status === "authorized").length;
    const totalRefundAmount = refunds.reduce((sum, r) => sum + r.amount, 0) / 100;
    return { failedCount, authorizedCount, totalRefundAmount };
  }, [payments, refunds]);

  /* ── Live Feed: Today's Payments sorted by time ─── */
  const todayFeed = useMemo(() => {
    return [...todayPayments]
      .sort((a, b) => b.razorpay_created_at - a.razorpay_created_at);
  }, [todayPayments]);

  /* ── Revenue Targets: current revenue for progress */
  const targetProgress = useMemo(() => {
    const todayRev = todayTotals.revenue;
    // Weekly: sum captured payments from last 7 days from main dataset
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0);
    const weekStartUnix = Math.floor(weekStart.getTime() / 1000);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartUnix = Math.floor(monthStart.getTime() / 1000);

    let weeklyRev = 0;
    let monthlyRev = 0;
    payments
      .filter((p) => p.status === "captured" && p.razorpay_created_at)
      .forEach((p) => {
        if (p.razorpay_created_at >= weekStartUnix) weeklyRev += p.amount / 100;
        if (p.razorpay_created_at >= monthStartUnix) monthlyRev += p.amount / 100;
      });

    return { daily: todayRev, weekly: weeklyRev, monthly: monthlyRev };
  }, [todayTotals.revenue, payments]);

  /* ── Save Target Handler ────────────────────────── */
  async function handleSaveTarget() {
    if (!targetAmount || isNaN(Number(targetAmount))) return;
    setSavingTarget(true);
    try {
      const res = await apiFetch(`/api/payments/revenue-targets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_type: targetPeriod, target_amount: Number(targetAmount) }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      // Refresh targets
      const tRes = await apiFetch(`/api/payments/revenue-targets`);
      const tData = await tRes.json();
      setTargets(tData.targets || []);
      setShowTargetForm(false);
      setTargetAmount("");
    } catch {
      // silently fail
    } finally {
      setSavingTarget(false);
    }
  }

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

      {/* KPI Cards with Today vs Yesterday Comparison */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Revenue" value={currency(totals.revenue)} icon={IndianRupee} color="text-green-400" prevValue={yesterdayTotals.revenue} currentNumeric={todayTotals.revenue} />
        <StatCard label="Payment Count" value={compact(totals.capturedCount)} icon={Hash} color="text-blue-400" prevValue={yesterdayTotals.capturedCount} currentNumeric={todayTotals.capturedCount} />
        <StatCard label="Success Rate" value={`${totals.successRate.toFixed(1)}%`} icon={CheckCircle} color="text-emerald-400" prevValue={yesterdayTotals.successRate} currentNumeric={todayTotals.successRate} />
        <StatCard label="Failed Payments" value={compact(totals.failedCount)} icon={XCircle} color="text-red-400" prevValue={yesterdayTotals.failedCount} currentNumeric={todayTotals.failedCount} />
        <StatCard label="Avg Order Value" value={currency(totals.avgOrderValue)} icon={TrendingUp} color="text-amber-400" prevValue={yesterdayTotals.avgOrderValue} currentNumeric={todayTotals.avgOrderValue} />
        <StatCard label="Refunds Issued" value={currency(totals.totalRefunds)} icon={RotateCcw} color="text-purple-400" prevValue={yesterdayTotals.totalRefunds} currentNumeric={todayTotals.totalRefunds} />
        <StatCard label="Net Revenue" value={currency(totals.netRevenue)} icon={Wallet} color="text-teal-400" prevValue={yesterdayTotals.netRevenue} currentNumeric={todayTotals.netRevenue} />
        <StatCard label="Refund Rate" value={`${totals.refundRate.toFixed(1)}%`} icon={Percent} color="text-pink-400" prevValue={yesterdayTotals.refundRate} currentNumeric={todayTotals.refundRate} />
      </div>

      {/* Revenue Targets Section */}
      <div className="card rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-bold text-foreground tracking-wide">Revenue Targets</h3>
          </div>
          <button
            onClick={() => setShowTargetForm(!showTargetForm)}
            className="text-xs px-3 py-1.5 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 transition-colors font-medium"
          >
            {showTargetForm ? "Cancel" : "Set Target"}
          </button>
        </div>

        {/* Inline target form */}
        {showTargetForm && (
          <div className="flex items-end gap-3 mb-4 p-3 rounded-lg bg-surface-hover/50 border border-border">
            <div className="flex-1">
              <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Period</label>
              <select
                value={targetPeriod}
                onChange={(e) => setTargetPeriod(e.target.value as "daily" | "weekly" | "monthly")}
                className="w-full px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Target Amount (₹)</label>
              <input
                type="number"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <button
              onClick={handleSaveTarget}
              disabled={savingTarget || !targetAmount}
              className="px-4 py-2 rounded-lg bg-accent text-black text-sm font-medium hover:bg-accent/80 transition-colors disabled:opacity-50"
            >
              {savingTarget ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => { setShowTargetForm(false); setTargetAmount(""); }}
              className="px-4 py-2 rounded-lg bg-surface-hover text-muted text-sm font-medium hover:bg-surface-hover/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Progress bars */}
        <div className="space-y-3">
          {(["daily", "weekly", "monthly"] as const).map((period) => {
            const target = targets.find((t) => t.period_type === period);
            if (!target) return null;
            const current = targetProgress[period];
            const pct = Math.min((current / target.target_amount) * 100, 100);
            return (
              <div key={period}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted capitalize">{period} Target</span>
                  <span className="text-xs text-foreground">
                    {currency(current)} / {currency(target.target_amount)} ({pct.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-hover overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: "#B8860B" }}
                  />
                </div>
              </div>
            );
          })}
          {targets.length === 0 && !showTargetForm && (
            <p className="text-xs text-muted">No revenue targets set. Click &quot;Set Target&quot; to add one.</p>
          )}
        </div>
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

      {/* Charts Row 2: Volume + Status + Needs Attention */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {/* Needs Attention Panel */}
        <WidgetCard
          title="Needs Attention"
          right={<AlertTriangle className="w-4 h-4 text-amber-400" />}
        >
          <div className="space-y-3">
            <Link
              href="/m/payments/failed-payments"
              className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 hover:bg-red-500/15 transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted">Failed Payments</p>
                <p className="text-lg font-bold text-red-400">{actionItems.failedCount}</p>
              </div>
            </Link>

            <Link
              href="/m/payments/transactions"
              className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 hover:bg-blue-500/15 transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted">Authorized (Not Captured)</p>
                <p className="text-lg font-bold text-blue-400">{actionItems.authorizedCount}</p>
              </div>
            </Link>

            <Link
              href="/m/payments/transactions"
              className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/15 transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <RotateCcw className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted">Total Refunds</p>
                <p className="text-lg font-bold text-amber-400">{currency(actionItems.totalRefundAmount)}</p>
              </div>
            </Link>
          </div>
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

      {/* Live Payment Feed */}
      <WidgetCard
        title={`Today's Payments (${todayFeed.length})`}
        right={
          <button
            onClick={fetchTodayData}
            className="flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        }
      >
        {todayFeed.length > 0 ? (
          <div className="max-h-[300px] overflow-y-auto space-y-1 scrollbar-thin">
            {todayFeed.map((p) => {
              const time = new Date(p.razorpay_created_at * 1000);
              const hh = String(time.getHours()).padStart(2, "0");
              const mm = String(time.getMinutes()).padStart(2, "0");
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-hover/50 transition-colors text-sm"
                >
                  <span className="text-muted text-xs font-mono w-12 flex-shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {hh}:{mm}
                  </span>
                  <span className="font-semibold text-foreground w-24 flex-shrink-0">
                    {currency(p.amount / 100)}
                  </span>
                  <StatusBadge status={p.status} />
                  <span className="text-xs text-muted flex items-center gap-1 flex-shrink-0">
                    <CreditCard className="w-3 h-3" />
                    {(p.method || "—").toUpperCase()}
                  </span>
                  <span className="text-xs text-muted truncate ml-auto" title={p.email}>
                    {p.email || "—"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-[100px] flex items-center justify-center text-muted text-sm">
            No payments today yet
          </div>
        )}
      </WidgetCard>
    </div>
  );
}
