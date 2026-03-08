"use client";

import { useEffect, useState, useMemo } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Percent,
  Loader2,
  IndianRupee,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Activity,
  Zap,
  Trophy,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  CreditCard,
} from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/* ── Types ─────────────────────────────────────────── */

interface SalesRecord {
  opportunity_id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  source: string;
  closed_date: string | null;
  fees_quoted: number;
  fees_collected: number;
  pending_amount: number;
  payment_mode: string | null;
  collection_status: string;
  onboarding_status: string;
  invoice_number: string | null;
  notes: string | null;
  team?: string;
}

interface MeetRecord {
  opportunity_id: string;
  contact_name: string;
  status: string;
  rating: string;
  outcome: string;
  created_at: string;
}

interface Insight {
  type: "warning" | "success" | "info";
  title: string;
  detail: string;
}

/* ── Constants ─────────────────────────────────────── */

const DATE_PRESETS = [
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
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

/* ── Helpers ───────────────────────────────────────── */

function getDateRange(preset: string): { start: string; end: string } | null {
  if (preset === "all") return null;
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const s = new Date(now);
  switch (preset) {
    case "7d": s.setDate(s.getDate() - 7); break;
    case "30d": s.setDate(s.getDate() - 30); break;
    case "this_month": s.setDate(1); break;
    case "last_month":
      s.setMonth(s.getMonth() - 1); s.setDate(1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) };
  }
  return { start: s.toISOString().slice(0, 10), end };
}

/** Get the previous equivalent period for delta comparison */
function getPreviousPeriodRange(preset: string): { start: string; end: string } | null {
  if (preset === "all") return null;
  const now = new Date();
  switch (preset) {
    case "7d": {
      const e = new Date(now); e.setDate(e.getDate() - 7);
      const s = new Date(e); s.setDate(s.getDate() - 7);
      return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) };
    }
    case "30d": {
      const e = new Date(now); e.setDate(e.getDate() - 30);
      const s = new Date(e); s.setDate(s.getDate() - 30);
      return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) };
    }
    case "this_month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) };
    }
    case "last_month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const e = new Date(now.getFullYear(), now.getMonth() - 1, 0);
      return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) };
    }
  }
  return null;
}

function currency(val: number) {
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/* ── Reusable Components ──────────────────────────── */

function DeltaBadge({
  current,
  previous,
  invertColors = false,
  format = "number",
}: {
  current: number;
  previous: number;
  invertColors?: boolean;
  format?: "number" | "currency" | "percent";
}) {
  if (previous === 0 && current === 0) return null;
  const diff = previous === 0 ? 100 : ((current - previous) / previous) * 100;
  const isPositive = diff > 0;
  const isNeutral = diff === 0;

  if (isNeutral) return null;

  // For metrics where increase is bad (e.g. pending amount), invert the color logic
  const isGood = invertColors ? !isPositive : isPositive;
  const color = isGood ? "text-green-400" : "text-red-400";
  const bgColor = isGood ? "bg-green-500/10" : "bg-red-500/10";
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;

  let label = `${Math.abs(diff).toFixed(0)}%`;
  if (format === "currency") {
    const absDiff = Math.abs(current - previous);
    label = `${isPositive ? "+" : "-"}${currency(absDiff)}`;
  }

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${color} ${bgColor}`}>
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color = "text-accent",
  delta,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ElementType;
  color?: string;
  delta?: React.ReactNode;
}) {
  return (
    <div className="card rounded-xl p-4 transition-all">
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon className={`w-3.5 h-3.5 ${color}`} />}
        <span className="text-[10px] text-muted uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold text-foreground">{value}</span>
        {delta}
      </div>
      {sub && <p className="text-[10px] text-muted mt-0.5">{sub}</p>}
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

/* ── Main Page ────────────────────────────────────── */

export default function SalesAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [datePreset, setDatePreset] = useState("all");

  // Raw unfiltered data for previous period comparison
  const [rawMaverickSales, setRawMaverickSales] = useState<SalesRecord[]>([]);
  const [rawJobinSales, setRawJobinSales] = useState<SalesRecord[]>([]);

  const [maverickSales, setMaverickSales] = useState<SalesRecord[]>([]);
  const [jobinSales, setJobinSales] = useState<SalesRecord[]>([]);
  const [maverickMeets, setMaverickMeets] = useState<MeetRecord[]>([]);
  const [jobinMeets, setJobinMeets] = useState<MeetRecord[]>([]);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setError("");
      try {
        const [mavSalesRes, jobSalesRes, mavMeetRes, jobMeetRes] = await Promise.all([
          fetch("/api/sales/maverick-sales-tracking").then((r) => r.json()).catch(() => ({ records: [] })),
          fetch("/api/sales/jobin-sales-tracking").then((r) => r.json()).catch(() => ({ records: [] })),
          fetch("/api/sales/maverick-meet-tracking").then((r) => r.json()).catch(() => ({ records: [] })),
          fetch("/api/sales/jobin-meet-tracking").then((r) => r.json()).catch(() => ({ records: [] })),
        ]);

        // Store raw unfiltered data
        setRawMaverickSales(mavSalesRes.records || []);
        setRawJobinSales(jobSalesRes.records || []);

        const range = getDateRange(datePreset);
        const filterByDate = (records: any[], dateField: string) => {
          if (!range) return records;
          return records.filter((r) => {
            const d = r[dateField]?.slice(0, 10);
            if (!d) return true;
            return d >= range.start && d <= range.end;
          });
        };

        setMaverickSales(filterByDate(mavSalesRes.records || [], "closed_date"));
        setJobinSales(filterByDate(jobSalesRes.records || [], "closed_date"));
        setMaverickMeets(filterByDate(mavMeetRes.records || [], "created_at"));
        setJobinMeets(filterByDate(jobMeetRes.records || [], "created_at"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load sales analytics");
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [datePreset]);

  /* ── Combined records with team tag ─────────────── */

  const allSales = useMemo(() => {
    const mavIds = new Set(
      maverickSales
        .filter((r) => (r.fees_quoted || 0) > 0 || (r.fees_collected || 0) > 0)
        .map((r) => r.opportunity_id)
    );
    const jobIds = new Set(
      jobinSales
        .filter((r) => (r.fees_quoted || 0) > 0 || (r.fees_collected || 0) > 0)
        .map((r) => r.opportunity_id)
    );

    const mav = maverickSales
      .filter((r) => mavIds.has(r.opportunity_id) || !jobIds.has(r.opportunity_id))
      .map((r) => ({ ...r, team: "Maverick" }));
    const job = jobinSales
      .filter((r) => jobIds.has(r.opportunity_id))
      .map((r) => ({ ...r, team: "Jobin" }));
    return [...mav, ...job];
  }, [maverickSales, jobinSales]);

  /* ── Previous period data for delta comparison ──── */

  const prevPeriodSales = useMemo(() => {
    const prevRange = getPreviousPeriodRange(datePreset);
    if (!prevRange) return [];

    const filterByDate = (records: SalesRecord[]) => {
      return records.filter((r) => {
        const d = r.closed_date?.slice(0, 10);
        if (!d) return false;
        return d >= prevRange.start && d <= prevRange.end;
      });
    };

    const prevMav = filterByDate(rawMaverickSales);
    const prevJob = filterByDate(rawJobinSales);

    const mavIds = new Set(
      prevMav.filter((r) => (r.fees_quoted || 0) > 0 || (r.fees_collected || 0) > 0).map((r) => r.opportunity_id)
    );
    const jobIds = new Set(
      prevJob.filter((r) => (r.fees_quoted || 0) > 0 || (r.fees_collected || 0) > 0).map((r) => r.opportunity_id)
    );

    const mav = prevMav.filter((r) => mavIds.has(r.opportunity_id) || !jobIds.has(r.opportunity_id)).map((r) => ({ ...r, team: "Maverick" }));
    const job = prevJob.filter((r) => jobIds.has(r.opportunity_id)).map((r) => ({ ...r, team: "Jobin" }));
    return [...mav, ...job];
  }, [datePreset, rawMaverickSales, rawJobinSales]);

  const prevTotalQuoted = useMemo(() => prevPeriodSales.reduce((s, r) => s + (r.fees_quoted || 0), 0), [prevPeriodSales]);
  const prevTotalCollected = useMemo(() => prevPeriodSales.reduce((s, r) => s + (r.fees_collected || 0), 0), [prevPeriodSales]);
  const prevTotalPending = useMemo(() => prevPeriodSales.reduce((s, r) => s + (r.pending_amount || 0), 0), [prevPeriodSales]);
  const prevCollectionRate = useMemo(() => (prevTotalQuoted > 0 ? (prevTotalCollected / prevTotalQuoted) * 100 : 0), [prevTotalQuoted, prevTotalCollected]);
  const prevAvgDealSize = useMemo(() => (prevPeriodSales.length > 0 ? prevTotalQuoted / prevPeriodSales.length : 0), [prevTotalQuoted, prevPeriodSales]);
  const hasPrevData = datePreset !== "all" && prevPeriodSales.length > 0;

  /* ── KPI Calculations ───────────────────────────── */

  const totalQuoted = useMemo(() => allSales.reduce((s, r) => s + (r.fees_quoted || 0), 0), [allSales]);
  const totalCollected = useMemo(() => allSales.reduce((s, r) => s + (r.fees_collected || 0), 0), [allSales]);
  const totalPending = useMemo(() => allSales.reduce((s, r) => s + (r.pending_amount || 0), 0), [allSales]);
  const collectionRate = useMemo(() => (totalQuoted > 0 ? (totalCollected / totalQuoted) * 100 : 0), [totalQuoted, totalCollected]);
  const totalMeetings = maverickMeets.length + jobinMeets.length;
  const avgDealSize = useMemo(() => (allSales.length > 0 ? totalQuoted / allSales.length : 0), [totalQuoted, allSales]);

  /* ── Team-level KPIs ────────────────────────────── */

  const teamKPIs = useMemo(() => {
    const teams = ["Maverick", "Jobin"] as const;
    return teams.map((team) => {
      const sales = allSales.filter((r) => r.team === team);
      const meets = team === "Maverick" ? maverickMeets : jobinMeets;
      const quoted = sales.reduce((s, r) => s + (r.fees_quoted || 0), 0);
      const collected = sales.reduce((s, r) => s + (r.fees_collected || 0), 0);
      const pending = sales.reduce((s, r) => s + (r.pending_amount || 0), 0);
      const rate = quoted > 0 ? (collected / quoted) * 100 : 0;
      const wonDeals = sales.length;
      const meetingsCount = meets.length;
      const wonMeets = meets.filter((m) => m.outcome === "Won" || m.outcome === "won" || m.status === "won").length;
      const meetToWonRate = meetingsCount > 0 ? (wonDeals / meetingsCount) * 100 : 0;

      return { team, quoted, collected, pending, rate, wonDeals, meetingsCount, wonMeets, meetToWonRate };
    });
  }, [allSales, maverickMeets, jobinMeets]);

  /* ── Sales Velocity Metrics ─────────────────────── */

  const velocityMetrics = useMemo(() => {
    // Win rate: deals won out of total meetings with outcomes (won + lost)
    const allMeets = [...maverickMeets, ...jobinMeets];
    const decidedMeets = allMeets.filter((m) =>
      ["Won", "won", "Lost", "lost"].includes(m.outcome || m.status || "")
    );
    const wonMeets = allMeets.filter((m) =>
      ["Won", "won"].includes(m.outcome || m.status || "")
    );
    const winRate = decidedMeets.length > 0 ? (wonMeets.length / decidedMeets.length) * 100 : 0;

    // Average deal cycle time (days from earliest meet to closed_date)
    let totalCycleDays = 0;
    let cycleCount = 0;
    allSales.forEach((sale) => {
      if (!sale.closed_date) return;
      const closedDate = new Date(sale.closed_date).getTime();
      // Find matching meeting by opportunity_id
      const matchingMeet = allMeets.find((m) => m.opportunity_id === sale.opportunity_id);
      if (matchingMeet && matchingMeet.created_at) {
        const meetDate = new Date(matchingMeet.created_at).getTime();
        const diffDays = (closedDate - meetDate) / (1000 * 60 * 60 * 24);
        if (diffDays >= 0 && diffDays < 365) {
          totalCycleDays += diffDays;
          cycleCount++;
        }
      }
    });
    const avgCycleTime = cycleCount > 0 ? totalCycleDays / cycleCount : 0;

    // Meetings to Won conversion
    const meetToWonRate = allMeets.length > 0 ? (allSales.length / allMeets.length) * 100 : 0;

    // Collection efficiency per team
    const mavTeam = teamKPIs.find((t) => t.team === "Maverick");
    const jobTeam = teamKPIs.find((t) => t.team === "Jobin");

    return {
      winRate,
      avgCycleTime,
      meetToWonRate,
      mavCollectionEff: mavTeam?.rate || 0,
      jobCollectionEff: jobTeam?.rate || 0,
    };
  }, [allSales, maverickMeets, jobinMeets, teamKPIs]);

  /* ── Chart: Maverick vs Jobin Revenue ───────────── */

  const revenueComparison = useMemo(() => {
    const mavSales = allSales.filter((r) => r.team === "Maverick");
    const jobSales = allSales.filter((r) => r.team === "Jobin");
    const mavQuoted = mavSales.reduce((s, r) => s + (r.fees_quoted || 0), 0);
    const mavCollected = mavSales.reduce((s, r) => s + (r.fees_collected || 0), 0);
    const jobQuoted = jobSales.reduce((s, r) => s + (r.fees_quoted || 0), 0);
    const jobCollected = jobSales.reduce((s, r) => s + (r.fees_collected || 0), 0);
    return [
      { team: "Maverick", Quoted: mavQuoted, Collected: mavCollected },
      { team: "Jobin", Quoted: jobQuoted, Collected: jobCollected },
    ];
  }, [allSales]);

  /* ── Chart: Collection Status Breakdown ─────────── */

  const collectionStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    allSales.forEach((r) => {
      const status = r.collection_status || "Unknown";
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [allSales]);

  /* ── Chart: Monthly Revenue Trend ───────────────── */

  const monthlyRevenue = useMemo(() => {
    const months: Record<string, { collected: number; quoted: number }> = {};
    allSales.forEach((r) => {
      if (!r.closed_date) return;
      const date = new Date(r.closed_date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!months[key]) months[key] = { collected: 0, quoted: 0 };
      months[key].collected += (r.fees_collected || 0);
      months[key].quoted += (r.fees_quoted || 0);
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, collected: data.collected, quoted: data.quoted }));
  }, [allSales]);

  /* ── Chart: Cumulative Revenue ──────────────────── */

  const cumulativeRevenue = useMemo(() => {
    let cumulative = 0;
    return monthlyRevenue.map((m) => {
      cumulative += m.collected;
      return { month: m.month, cumulative };
    });
  }, [monthlyRevenue]);

  /* ── Chart: Payment Mode Distribution ───────────── */

  const paymentModeData = useMemo(() => {
    const counts: Record<string, number> = {};
    allSales.forEach((r) => {
      const mode = r.payment_mode || "Unknown";
      counts[mode] = (counts[mode] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [allSales]);

  /* ── Recent Deals (last 20) ─────────────────────── */

  const recentDeals = useMemo(() => {
    return [...allSales]
      .sort((a, b) => {
        const da = a.closed_date ? new Date(a.closed_date).getTime() : 0;
        const db = b.closed_date ? new Date(b.closed_date).getTime() : 0;
        return db - da;
      })
      .slice(0, 20);
  }, [allSales]);

  /* ── Smart Insights ─────────────────────────────── */

  const insights = useMemo(() => {
    const items: Insight[] = [];

    // 1. Collection rate health
    if (allSales.length >= 3) {
      if (collectionRate < 70) {
        items.push({
          type: "warning",
          title: `Low Collection Rate: ${collectionRate.toFixed(1)}%`,
          detail: `Only ${currency(totalCollected)} collected of ${currency(totalQuoted)} quoted. Below 70% threshold — follow up on pending payments and tighten collection process.`,
        });
      } else if (collectionRate >= 85) {
        items.push({
          type: "success",
          title: `Strong Collection Rate: ${collectionRate.toFixed(1)}%`,
          detail: `${currency(totalCollected)} collected from ${currency(totalQuoted)} quoted — excellent payment follow-through.`,
        });
      } else {
        items.push({
          type: "info",
          title: `Collection Rate: ${collectionRate.toFixed(1)}%`,
          detail: `Moderate collection efficiency. ${currency(totalPending)} still pending — room for improvement.`,
        });
      }
    }

    // 2. Pending amount alert
    if (totalQuoted > 0 && totalPending > totalQuoted * 0.5) {
      items.push({
        type: "warning",
        title: `High Pending Amount: ${currency(totalPending)}`,
        detail: `Pending amount is ${((totalPending / totalQuoted) * 100).toFixed(0)}% of total quoted value. Prioritize collection calls and payment reminders.`,
      });
    }

    // 3. Team performance comparison
    const mavTeam = teamKPIs.find((t) => t.team === "Maverick");
    const jobTeam = teamKPIs.find((t) => t.team === "Jobin");
    if (mavTeam && jobTeam && mavTeam.wonDeals >= 2 && jobTeam.wonDeals >= 2) {
      const rateGap = Math.abs(mavTeam.rate - jobTeam.rate);
      if (rateGap > 15) {
        const better = mavTeam.rate > jobTeam.rate ? "Maverick" : "Jobin";
        const worse = better === "Maverick" ? "Jobin" : "Maverick";
        const betterRate = Math.max(mavTeam.rate, jobTeam.rate);
        const worseRate = Math.min(mavTeam.rate, jobTeam.rate);
        items.push({
          type: "info",
          title: `${better} Leading in Collections`,
          detail: `${better} has ${betterRate.toFixed(0)}% collection rate vs ${worse} at ${worseRate.toFixed(0)}%. ${worse} team may need support with payment follow-ups.`,
        });
      } else {
        items.push({
          type: "success",
          title: "Teams Performing Evenly",
          detail: `Both Maverick (${mavTeam.rate.toFixed(0)}%) and Jobin (${jobTeam.rate.toFixed(0)}%) have similar collection rates — balanced team performance.`,
        });
      }
    }

    // 4. Deal velocity
    if (velocityMetrics.avgCycleTime > 0) {
      if (velocityMetrics.avgCycleTime > 30) {
        items.push({
          type: "warning",
          title: `Slow Deal Cycle: ${velocityMetrics.avgCycleTime.toFixed(0)} Days Avg`,
          detail: "Average deal takes over 30 days from meeting to close. Consider streamlining the proposal and follow-up process.",
        });
      } else if (velocityMetrics.avgCycleTime <= 14) {
        items.push({
          type: "success",
          title: `Fast Deal Cycle: ${velocityMetrics.avgCycleTime.toFixed(0)} Days Avg`,
          detail: "Deals are closing within 2 weeks on average — efficient sales process.",
        });
      } else {
        items.push({
          type: "info",
          title: `Deal Cycle: ${velocityMetrics.avgCycleTime.toFixed(0)} Days Avg`,
          detail: "Average time from first meeting to deal close. Monitor for trends.",
        });
      }
    }

    // 5. High-value deal detection
    const highValueThreshold = avgDealSize * 2;
    const highValueDeals = allSales.filter((r) => (r.fees_quoted || 0) >= highValueThreshold && highValueThreshold > 0);
    if (highValueDeals.length > 0) {
      const highValueTotal = highValueDeals.reduce((s, r) => s + (r.fees_quoted || 0), 0);
      items.push({
        type: "info",
        title: `${highValueDeals.length} High-Value Deal${highValueDeals.length > 1 ? "s" : ""} Detected`,
        detail: `${highValueDeals.length} deal${highValueDeals.length > 1 ? "s" : ""} worth ${currency(highValueTotal)} are 2x+ above average deal size of ${currency(avgDealSize)}.`,
      });
    }

    // 6. Revenue trend between months
    if (monthlyRevenue.length >= 2) {
      const last = monthlyRevenue[monthlyRevenue.length - 1];
      const prev = monthlyRevenue[monthlyRevenue.length - 2];
      if (last.collected > prev.collected) {
        const growth = prev.collected > 0 ? ((last.collected - prev.collected) / prev.collected) * 100 : 100;
        items.push({
          type: "success",
          title: `Revenue Up ${growth.toFixed(0)}% Month-over-Month`,
          detail: `${last.month} collected ${currency(last.collected)} vs ${prev.month} at ${currency(prev.collected)} — positive trend.`,
        });
      } else if (last.collected < prev.collected && prev.collected > 0) {
        const decline = ((prev.collected - last.collected) / prev.collected) * 100;
        items.push({
          type: "warning",
          title: `Revenue Down ${decline.toFixed(0)}% Month-over-Month`,
          detail: `${last.month} collected ${currency(last.collected)} vs ${prev.month} at ${currency(prev.collected)}. Investigate drop in deal closures.`,
        });
      }
    }

    // 7. Payment mode concentration
    if (paymentModeData.length > 0) {
      const totalPayments = paymentModeData.reduce((s, p) => s + p.value, 0);
      const dominant = paymentModeData.sort((a, b) => b.value - a.value)[0];
      const share = totalPayments > 0 ? (dominant.value / totalPayments) * 100 : 0;
      if (share > 80 && dominant.name !== "Unknown") {
        items.push({
          type: "info",
          title: `${dominant.name} Dominates Payments (${share.toFixed(0)}%)`,
          detail: `${dominant.value} of ${totalPayments} payments use ${dominant.name}. Consider diversifying payment options to reduce dependency.`,
        });
      }
    }

    if (items.length === 0) {
      items.push({ type: "success", title: "Sales Pipeline Healthy", detail: "No anomalies detected in sales performance metrics." });
    }

    return items;
  }, [allSales, collectionRate, totalCollected, totalQuoted, totalPending, teamKPIs, velocityMetrics, avgDealSize, monthlyRevenue, paymentModeData]);

  const sortedInsights = useMemo(() => [
    ...insights.filter((i) => i.type === "warning"),
    ...insights.filter((i) => i.type === "info"),
    ...insights.filter((i) => i.type === "success"),
  ], [insights]);

  /* ── Status badge helper ────────────────────────── */

  function statusBadge(status: string) {
    let color = "bg-gray-500/10 text-gray-400 border-gray-500/20";
    if (status === "Fully Paid" || status === "fully_paid") color = "bg-green-500/10 text-green-400 border-green-500/20";
    else if (status === "Partially Paid" || status === "partial") color = "bg-amber-500/10 text-amber-400 border-amber-500/20";
    else if (status === "Pending" || status === "pending") color = "bg-red-500/10 text-red-400 border-red-500/20";
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${color}`}>
        {status}
      </span>
    );
  }

  /* ── Loading State ──────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 gap-2 text-muted">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading sales analytics...</span>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────── */

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Sales Analytics</h1>
            <p className="text-muted text-xs mt-0.5">Combined Maverick &amp; Jobin sales performance</p>
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
        <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
          {error}
        </div>
      )}

      {/* KPI Cards with Delta Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Quoted"
          value={currency(totalQuoted)}
          icon={IndianRupee}
          color="text-amber-400"
          delta={hasPrevData ? <DeltaBadge current={totalQuoted} previous={prevTotalQuoted} /> : undefined}
        />
        <StatCard
          label="Total Collected"
          value={currency(totalCollected)}
          icon={DollarSign}
          color="text-green-400"
          delta={hasPrevData ? <DeltaBadge current={totalCollected} previous={prevTotalCollected} /> : undefined}
        />
        <StatCard
          label="Total Pending"
          value={currency(totalPending)}
          icon={TrendingUp}
          color="text-red-400"
          delta={hasPrevData ? <DeltaBadge current={totalPending} previous={prevTotalPending} invertColors /> : undefined}
        />
        <StatCard
          label="Collection Rate"
          value={`${collectionRate.toFixed(1)}%`}
          icon={Percent}
          color="text-teal-400"
          delta={hasPrevData ? <DeltaBadge current={collectionRate} previous={prevCollectionRate} /> : undefined}
        />
        <StatCard label="Maverick Deals" value={allSales.filter((r) => r.team === "Maverick").length} icon={Target} color="text-blue-400" />
        <StatCard label="Jobin Deals" value={allSales.filter((r) => r.team === "Jobin").length} icon={Users} color="text-purple-400" />
        <StatCard label="Total Meetings" value={totalMeetings} icon={Calendar} color="text-indigo-400" />
        <StatCard
          label="Avg Deal Size"
          value={currency(avgDealSize)}
          icon={IndianRupee}
          color="text-pink-400"
          delta={hasPrevData ? <DeltaBadge current={avgDealSize} previous={prevAvgDealSize} /> : undefined}
        />
      </div>

      {/* Sales Velocity Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Win Rate"
          value={`${velocityMetrics.winRate.toFixed(1)}%`}
          sub="Won / decided meetings"
          icon={Trophy}
          color="text-amber-400"
        />
        <StatCard
          label="Avg Cycle Time"
          value={velocityMetrics.avgCycleTime > 0 ? `${velocityMetrics.avgCycleTime.toFixed(0)}d` : "N/A"}
          sub="Meeting to close"
          icon={Clock}
          color="text-cyan-400"
        />
        <StatCard
          label="Meeting → Won"
          value={`${velocityMetrics.meetToWonRate.toFixed(1)}%`}
          sub="Meetings that converted"
          icon={Zap}
          color="text-orange-400"
        />
        <StatCard
          label="Collection Efficiency"
          value={`M: ${velocityMetrics.mavCollectionEff.toFixed(0)}% / J: ${velocityMetrics.jobCollectionEff.toFixed(0)}%`}
          sub="Collected / quoted per team"
          icon={CreditCard}
          color="text-emerald-400"
        />
      </div>

      {/* Smart Insights */}
      {sortedInsights.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-bold text-foreground tracking-wide">Smart Insights</h2>
            <span className="text-[10px] text-muted">({sortedInsights.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sortedInsights.map((ins, i) => (
              <InsightCard key={i} insight={ins} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Team Leaderboard */}
      {teamKPIs.length === 2 && (teamKPIs[0].wonDeals > 0 || teamKPIs[1].wonDeals > 0) && (
        <WidgetCard title="Team Leaderboard">
          <div className="overflow-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2">Metric</th>
                  {teamKPIs.map((t) => (
                    <th key={t.team} className="text-right text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2">
                      {t.team}
                    </th>
                  ))}
                  <th className="text-right text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2">Leader</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { metric: "Deals Won", values: teamKPIs.map((t) => t.wonDeals), format: (v: number) => String(v), higherBetter: true },
                  { metric: "Quoted", values: teamKPIs.map((t) => t.quoted), format: currency, higherBetter: true },
                  { metric: "Collected", values: teamKPIs.map((t) => t.collected), format: currency, higherBetter: true },
                  { metric: "Pending", values: teamKPIs.map((t) => t.pending), format: currency, higherBetter: false },
                  { metric: "Collection Rate", values: teamKPIs.map((t) => t.rate), format: (v: number) => `${v.toFixed(1)}%`, higherBetter: true },
                  { metric: "Meetings", values: teamKPIs.map((t) => t.meetingsCount), format: (v: number) => String(v), higherBetter: true },
                  { metric: "Meet → Won Rate", values: teamKPIs.map((t) => t.meetToWonRate), format: (v: number) => `${v.toFixed(1)}%`, higherBetter: true },
                ].map((row) => {
                  const leader = row.higherBetter
                    ? (row.values[0] >= row.values[1] ? (row.values[0] === row.values[1] ? "Tie" : teamKPIs[0].team) : teamKPIs[1].team)
                    : (row.values[0] <= row.values[1] ? (row.values[0] === row.values[1] ? "Tie" : teamKPIs[0].team) : teamKPIs[1].team);
                  const leaderColor = leader === "Maverick" ? "text-blue-400" : leader === "Jobin" ? "text-purple-400" : "text-muted";
                  return (
                    <tr key={row.metric} className="border-b border-border/30 hover:bg-surface-hover/50 transition-colors">
                      <td className="px-3 py-2 text-foreground font-medium">{row.metric}</td>
                      {row.values.map((v, i) => (
                        <td key={i} className="px-3 py-2 text-right text-foreground">{row.format(v)}</td>
                      ))}
                      <td className={`px-3 py-2 text-right font-semibold ${leaderColor}`}>
                        {leader === "Tie" ? "—" : leader}
                        {leader !== "Tie" && <Trophy className="inline w-3 h-3 ml-1 text-amber-400" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </WidgetCard>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Maverick vs Jobin Revenue */}
        <WidgetCard title="Maverick vs Jobin Revenue">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenueComparison} barCategoryGap="30%">
              <XAxis dataKey="team" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(Number(v) / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val) => currency(Number(val))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Quoted" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Collected" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </WidgetCard>

        {/* Collection Status Breakdown */}
        <WidgetCard title="Collection Status Breakdown">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={collectionStatusData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name || ""} ${((percent || 0) * 100).toFixed(0)}%`}
                labelLine={false}
                style={{ fontSize: 10 }}
              >
                {collectionStatusData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </WidgetCard>

        {/* Monthly Revenue Trend */}
        <WidgetCard title="Monthly Revenue Trend">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthlyRevenue}>
              <XAxis dataKey="month" tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(Number(v) / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val) => currency(Number(val))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="collected" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: "#22c55e" }} name="Collected" />
              <Line type="monotone" dataKey="quoted" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: "#f59e0b" }} strokeDasharray="5 5" name="Quoted" />
            </LineChart>
          </ResponsiveContainer>
        </WidgetCard>

        {/* Cumulative Revenue Chart */}
        <WidgetCard title="Cumulative Collected Revenue">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={cumulativeRevenue}>
              <defs>
                <linearGradient id="cumulativeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(Number(v) / 100000).toFixed(1)}L`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val) => currency(Number(val))} />
              <Area type="monotone" dataKey="cumulative" stroke="#22c55e" strokeWidth={2} fill="url(#cumulativeGrad)" dot={{ r: 3, fill: "#22c55e" }} name="Cumulative Revenue" />
            </AreaChart>
          </ResponsiveContainer>
        </WidgetCard>

        {/* Payment Mode Distribution */}
        <WidgetCard title="Payment Mode Distribution">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={paymentModeData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name || ""} ${((percent || 0) * 100).toFixed(0)}%`}
                labelLine={false}
                style={{ fontSize: 10 }}
              >
                {paymentModeData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </WidgetCard>
      </div>

      {/* Recent Deals Table */}
      <div className="card rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50">
          <h3 className="text-sm font-bold text-foreground tracking-wide">Recent Deals</h3>
          <p className="text-[10px] text-muted mt-0.5">Last 20 deals across both teams</p>
        </div>
        <div className="overflow-auto max-h-[480px]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface border-b border-border/50">
                <th className="text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5">Team</th>
                <th className="text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5">Contact</th>
                <th className="text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5">Quoted</th>
                <th className="text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5">Collected</th>
                <th className="text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5">Pending</th>
                <th className="text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5">Status</th>
                <th className="text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentDeals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted text-sm">No deals found.</td>
                </tr>
              ) : (
                recentDeals.map((deal) => (
                  <tr key={`${deal.team}-${deal.opportunity_id}`} className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors text-xs">
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                        deal.team === "Maverick"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                      }`}>
                        {deal.team}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-foreground font-medium">{deal.contact_name || "-"}</td>
                    <td className="px-3 py-2 text-foreground">{currency(deal.fees_quoted || 0)}</td>
                    <td className="px-3 py-2 text-green-400">{currency(deal.fees_collected || 0)}</td>
                    <td className="px-3 py-2 text-amber-400">{currency(deal.pending_amount || 0)}</td>
                    <td className="px-3 py-2">{statusBadge(deal.collection_status || "Unknown")}</td>
                    <td className="px-3 py-2 text-muted">
                      {deal.closed_date ? new Date(deal.closed_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
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
