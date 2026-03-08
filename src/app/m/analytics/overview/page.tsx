"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Loader2,
  IndianRupee,
  Megaphone,
  MousePointer,
  Users,
  FileText,
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Target,
  ArrowRight,
  Activity,
  CreditCard,
  UserPlus,
  BarChart3,
} from "lucide-react";
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
import { apiFetch } from "@/lib/api-fetch";

/* ── Types ─────────────────────────────────────────── */

interface MetaInsight {
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  date_start?: string;
  date_stop?: string;
  actions?: { action_type: string; value: string }[];
  purchase_roas?: { action_type: string; value: string }[];
}

interface SEORow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface RazorpayPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  razorpay_created_at: number;
}

interface SalesRecord {
  opportunity_id?: string;
  fees_quoted?: number;
  fees_collected?: number;
  collection_status?: string;
  closed_date?: string;
  created_at?: string;
}

interface GHLOpportunity {
  monetaryValue?: number;
  status?: string;
  pipelineStageId?: string;
  createdAt?: string;
}

interface CohortMetric {
  date: string;
  ad_spend: number;
  impressions: number;
  clicks: number;
  optins: number;
  meetings_booked: number;
  calls_completed: number;
  show_ups: number;
  admissions: number;
  revenue_collected: number;
  payments: number;
  last_synced_at: string | null;
}

/* ── Date Helpers ─────────────────────────────────── */

const DATE_PRESETS = [
  { label: "Last 7 Days", value: "last_7d" },
  { label: "Last 30 Days", value: "last_30d" },
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
];

function getDateRange(preset: string) {
  const now = new Date();
  const seoEnd = new Date(now);
  seoEnd.setDate(seoEnd.getDate() - 2);
  const seoStart = new Date(seoEnd);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "last_7d":
      start.setDate(start.getDate() - 7);
      seoStart.setDate(seoStart.getDate() - 7);
      break;
    case "last_30d":
      start.setDate(start.getDate() - 30);
      seoStart.setDate(seoStart.getDate() - 30);
      break;
    case "this_month":
      start.setDate(1);
      seoStart.setDate(1);
      break;
    case "last_month":
      start.setMonth(start.getMonth() - 1); start.setDate(1);
      end.setDate(0);
      seoStart.setMonth(seoStart.getMonth() - 1); seoStart.setDate(1);
      seoEnd.setDate(0);
      break;
  }
  return {
    startDate: seoStart.toISOString().slice(0, 10),
    endDate: seoEnd.toISOString().slice(0, 10),
    fromUnix: Math.floor(start.getTime() / 1000),
    toUnix: Math.floor(end.getTime() / 1000),
    startIso: start.toISOString().slice(0, 10),
    endIso: end.toISOString().slice(0, 10),
  };
}

/* ── Constants ─────────────────────────────────────── */

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

const COHORT_BUDGET = 600_000;
const COHORT_TARGET_ADMISSIONS = 40;
const COHORT_START = "2026-03-01";
const COHORT_END = "2026-05-16";

/* ── Helpers ───────────────────────────────────────── */

function currency(val: number) {
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function compact(val: number) {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(0);
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/* ── Reusable Components ──────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color = "text-accent",
  delta,
  deltaLabel,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ElementType;
  color?: string;
  delta?: number;
  deltaLabel?: string;
}) {
  return (
    <div className="card rounded-xl p-4 transition-all">
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon className={`w-3.5 h-3.5 ${color}`} />}
        <span className="text-[10px] text-muted uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-xl font-bold text-foreground">{value}</span>
      <div className="flex items-center gap-2 mt-0.5">
        {delta !== undefined && delta !== 0 && (
          <span className={`flex items-center gap-0.5 text-[10px] font-medium ${delta > 0 ? "text-green-500" : "text-red-500"}`}>
            {delta > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
            {deltaLabel && <span className="text-muted ml-0.5">{deltaLabel}</span>}
          </span>
        )}
        {sub && <p className="text-[10px] text-muted">{sub}</p>}
      </div>
    </div>
  );
}

function WidgetCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-foreground tracking-wide">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

interface Insight {
  type: "warning" | "success" | "info";
  title: string;
  detail: string;
  link?: string;
  linkLabel?: string;
}

function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const config = {
    warning: {
      icon: <AlertTriangle size={16} />,
      iconBg: "bg-amber-500/15",
      iconText: "text-amber-500",
      badge: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      badgeLabel: "Needs Attention",
      glow: "shadow-amber-500/5",
    },
    success: {
      icon: <CheckCircle size={16} />,
      iconBg: "bg-green-500/15",
      iconText: "text-green-500",
      badge: "bg-green-500/10 text-green-500 border-green-500/20",
      badgeLabel: "Healthy",
      glow: "shadow-green-500/5",
    },
    info: {
      icon: <Activity size={16} />,
      iconBg: "bg-blue-500/15",
      iconText: "text-blue-500",
      badge: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      badgeLabel: "Opportunity",
      glow: "shadow-blue-500/5",
    },
  }[insight.type];

  return (
    <div
      className={`card rounded-xl p-4 hover:shadow-lg transition-all ${config.glow}`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 ${config.iconBg} ${config.iconText} shrink-0`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground leading-tight">{insight.title}</span>
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border shrink-0 ${config.badge}`}>
              {config.badgeLabel}
            </span>
          </div>
          <p className="text-xs text-muted leading-relaxed">{insight.detail}</p>
          {insight.link && (
            <Link
              href={insight.link}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-accent mt-2 hover:underline group"
            >
              {insight.linkLabel || "View details"}
              <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Dashboard ────────────────────────────────── */

export default function AnalyticsOverview() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [datePreset, setDatePreset] = useState("last_30d");

  const [metaInsights, setMetaInsights] = useState<MetaInsight[]>([]);
  const [seoRows, setSeoRows] = useState<SEORow[]>([]);
  const [payments, setPayments] = useState<RazorpayPayment[]>([]);
  const [maverickRecords, setMaverickRecords] = useState<SalesRecord[]>([]);
  const [jobinRecords, setJobinRecords] = useState<SalesRecord[]>([]);
  const [opportunities, setOpportunities] = useState<GHLOpportunity[]>([]);
  const [cohortMetrics, setCohortMetrics] = useState<CohortMetric[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchAll() {
      setLoading(true);
      setError("");
      try {
        const { startDate: sd, endDate: ed, fromUnix, toUnix, startIso, endIso } = getDateRange(datePreset);
        const payParams = new URLSearchParams();
        payParams.set("from", String(fromUnix));
        payParams.set("to", String(toUnix));

        const [metaRes, seoRes, payRes, mavRes, jobRes, ghlRes, cohortRes] = await Promise.all([
          apiFetch(`/api/meta/account-insights?date_preset=${datePreset}`, { signal: controller.signal }).then((r) => r.json()).catch(() => ({ insights: [] })),
          apiFetch(`/api/seo/daily?startDate=${sd}&endDate=${ed}`, { signal: controller.signal }).then((r) => r.json()).catch(() => ({ rows: [] })),
          apiFetch(`/api/razorpay/payments?${payParams}`, { signal: controller.signal }).then((r) => r.json()).catch(() => ({ payments: [] })),
          apiFetch("/api/sales/maverick-sales-tracking", { signal: controller.signal }).then((r) => r.json()).catch(() => ({ records: [] })),
          apiFetch("/api/sales/jobin-sales-tracking", { signal: controller.signal }).then((r) => r.json()).catch(() => ({ records: [] })),
          apiFetch("/api/ghl/opportunities", { signal: controller.signal }).then((r) => r.json()).catch(() => ({ opportunities: [] })),
          apiFetch("/api/analytics/cohort-metrics", { signal: controller.signal }).then((r) => r.json()).catch(() => ({ metrics: [] })),
        ]);

        const metaRaw = metaRes.insights;
        setMetaInsights(Array.isArray(metaRaw) ? metaRaw : metaRaw ? [metaRaw] : []);
        setSeoRows(seoRes.rows || []);
        setPayments(payRes.payments || []);
        setCohortMetrics(cohortRes.metrics || []);

        const filterSales = (records: SalesRecord[]) =>
          (records || []).filter((r) => {
            const d = r.closed_date || r.created_at;
            if (!d) return true;
            const dateStr = d.slice(0, 10);
            return dateStr >= startIso && dateStr <= endIso;
          });
        setMaverickRecords(filterSales(mavRes.records || []));
        setJobinRecords(filterSales(jobRes.records || []));

        const allOpps: GHLOpportunity[] = ghlRes.opportunities || [];
        setOpportunities(
          allOpps.filter((o) => {
            if (!o.createdAt) return true;
            const d = new Date(o.createdAt).toISOString().slice(0, 10);
            return d >= startIso && d <= endIso;
          })
        );
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load analytics data");
      } finally {
        setLoading(false);
      }
    }
    fetchAll();

    return () => controller.abort();
  }, [datePreset]);

  /* ── KPI Calculations ───────────────────────────── */

  const totalRevenue = useMemo(() => {
    return payments.filter((p) => p.status === "captured").reduce((sum, p) => sum + p.amount / 100, 0);
  }, [payments]);

  const metaSpend = useMemo(() => {
    return metaInsights.reduce((sum, row) => sum + parseFloat(row.spend || "0"), 0);
  }, [metaInsights]);

  const metaClicks = useMemo(() => {
    return metaInsights.reduce((sum, row) => sum + parseInt(row.clicks || "0"), 0);
  }, [metaInsights]);

  const metaImpressions = useMemo(() => {
    return metaInsights.reduce((sum, row) => sum + parseInt(row.impressions || "0"), 0);
  }, [metaInsights]);

  const seoClicks = useMemo(() => {
    return seoRows.reduce((sum, row) => sum + (row.clicks || 0), 0);
  }, [seoRows]);

  const seoImpressions = useMemo(() => {
    return seoRows.reduce((sum, row) => sum + (row.impressions || 0), 0);
  }, [seoRows]);

  const totalLeads = opportunities.length;

  const salesQuoted = useMemo(() => {
    return maverickRecords.reduce((sum, r) => sum + (r.fees_quoted || 0), 0) +
      jobinRecords.reduce((sum, r) => sum + (r.fees_quoted || 0), 0);
  }, [maverickRecords, jobinRecords]);

  const salesCollected = useMemo(() => {
    return maverickRecords.reduce((sum, r) => sum + (r.fees_collected || 0), 0) +
      jobinRecords.reduce((sum, r) => sum + (r.fees_collected || 0), 0);
  }, [maverickRecords, jobinRecords]);

  const collectionRate = salesQuoted > 0 ? (salesCollected / salesQuoted) * 100 : 0;

  const roas = metaSpend > 0 ? totalRevenue / metaSpend : 0;

  const metaCTR = metaImpressions > 0 ? (metaClicks / metaImpressions) * 100 : 0;

  /* ── Cohort Campaign Snapshot ────────────────────── */

  const cohort = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const totalDays = Math.ceil((new Date(COHORT_END).getTime() - new Date(COHORT_START).getTime()) / 86_400_000) + 1;
    const daysElapsed = Math.max(0, Math.ceil((new Date(today).getTime() - new Date(COHORT_START).getTime()) / 86_400_000) + 1);
    const daysRemaining = Math.max(0, totalDays - daysElapsed);

    let totalSpend = 0, totalAdmissions = 0, totalRevenue = 0;
    let totalOptins = 0, totalMeetings = 0, totalPayments = 0;
    for (const m of cohortMetrics) {
      totalSpend += m.ad_spend || 0;
      totalAdmissions += m.admissions || 0;
      totalRevenue += m.revenue_collected || 0;
      totalOptins += m.optins || 0;
      totalMeetings += m.meetings_booked || 0;
      totalPayments += m.payments || 0;
    }

    const budgetUsed = COHORT_BUDGET > 0 ? (totalSpend / COHORT_BUDGET) * 100 : 0;
    const cpa = totalAdmissions > 0 ? totalSpend / totalAdmissions : 0;
    const dailyBurn = daysElapsed > 0 ? totalSpend / daysElapsed : 0;
    const projectedSpend = totalSpend + dailyBurn * daysRemaining;
    const dailyAdmRate = daysElapsed > 0 ? totalAdmissions / daysElapsed : 0;
    const projectedAdmissions = Math.round(totalAdmissions + dailyAdmRate * daysRemaining);

    let status: "on-track" | "overspending" | "underspending" = "on-track";
    if (projectedSpend > COHORT_BUDGET * 1.05) status = "overspending";
    else if (projectedSpend < COHORT_BUDGET * 0.85) status = "underspending";

    return {
      totalSpend, totalAdmissions, totalRevenue, totalOptins, totalMeetings,
      totalPayments, budgetUsed, cpa, dailyBurn, projectedSpend,
      projectedAdmissions, status, daysElapsed, daysRemaining, totalDays,
    };
  }, [cohortMetrics]);

  /* ── Period Comparison (first vs second half of date range) ─── */

  const periodDeltas = useMemo(() => {
    const sorted = [...metaInsights].sort((a, b) => (a.date_start || "").localeCompare(b.date_start || ""));
    const mid = Math.floor(sorted.length / 2);
    const first = sorted.slice(0, mid);
    const second = sorted.slice(mid);

    const firstSpend = first.reduce((s, r) => s + parseFloat(r.spend || "0"), 0);
    const secondSpend = second.reduce((s, r) => s + parseFloat(r.spend || "0"), 0);

    const firstPay = payments.filter((p) => p.status === "captured");
    const sortedPay = [...firstPay].sort((a, b) => a.razorpay_created_at - b.razorpay_created_at);
    const midPay = Math.floor(sortedPay.length / 2);
    const firstRev = sortedPay.slice(0, midPay).reduce((s, p) => s + p.amount / 100, 0);
    const secondRev = sortedPay.slice(midPay).reduce((s, p) => s + p.amount / 100, 0);

    return {
      spendDelta: pctChange(secondSpend, firstSpend),
      revenueDelta: pctChange(secondRev, firstRev),
    };
  }, [metaInsights, payments]);

  /* ── Revenue vs Ad Spend (daily trend) ──────────── */

  const revenueVsSpend = useMemo(() => {
    const byDate: Record<string, { revenue: number; adSpend: number }> = {};
    payments.filter((p) => p.status === "captured" && p.razorpay_created_at).forEach((p) => {
      const date = new Date(p.razorpay_created_at * 1000).toISOString().slice(0, 10);
      if (!byDate[date]) byDate[date] = { revenue: 0, adSpend: 0 };
      byDate[date].revenue += p.amount / 100;
    });
    metaInsights.forEach((row) => {
      const date = row.date_start?.slice(0, 10);
      if (!date) return;
      if (!byDate[date]) byDate[date] = { revenue: 0, adSpend: 0 };
      byDate[date].adSpend += parseFloat(row.spend || "0");
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date: date.slice(5), ...data }));
  }, [payments, metaInsights]);

  /* ── Cumulative Revenue Trend ───────────────────── */

  const cumulativeRevenue = useMemo(() => {
    let cumRev = 0, cumSpend = 0;
    return revenueVsSpend.map((d) => {
      cumRev += d.revenue;
      cumSpend += d.adSpend;
      return { date: d.date, revenue: cumRev, adSpend: cumSpend, profit: cumRev - cumSpend };
    });
  }, [revenueVsSpend]);

  /* ── Sales Pipeline ─────────────────────────────── */

  const salesPipeline = useMemo(() => {
    const mavQuoted = maverickRecords.reduce((sum, r) => sum + (r.fees_quoted || 0), 0);
    const mavCollected = maverickRecords.reduce((sum, r) => sum + (r.fees_collected || 0), 0);
    const jobQuoted = jobinRecords.reduce((sum, r) => sum + (r.fees_quoted || 0), 0);
    const jobCollected = jobinRecords.reduce((sum, r) => sum + (r.fees_collected || 0), 0);
    return [
      { name: "Maverick", quoted: mavQuoted, collected: mavCollected },
      { name: "Jobin", quoted: jobQuoted, collected: jobCollected },
    ];
  }, [maverickRecords, jobinRecords]);

  /* ── SEO Performance ────────────────────────────── */

  const seoPerformance = useMemo(() => {
    return seoRows
      .filter((r) => r.keys && r.keys[0])
      .sort((a, b) => a.keys[0].localeCompare(b.keys[0]))
      .map((r) => ({ date: r.keys[0].slice(5), clicks: r.clicks || 0, impressions: r.impressions || 0 }));
  }, [seoRows]);

  /* ── Department Revenue Split ───────────────────── */

  const revenueSplit = useMemo(() => {
    const data: { name: string; value: number }[] = [];
    if (totalRevenue > 0) data.push({ name: "Payments (Razorpay)", value: totalRevenue });
    if (salesCollected > 0) data.push({ name: "Sales Collected", value: salesCollected });
    if (cohort.totalRevenue > 0) data.push({ name: "Cohort Revenue", value: cohort.totalRevenue });
    return data;
  }, [totalRevenue, salesCollected, cohort.totalRevenue]);

  /* ── Actionable Insights ────────────────────────── */

  const insights = useMemo(() => {
    const items: Insight[] = [];

    // Budget pacing
    if (cohort.projectedSpend > COHORT_BUDGET * 1.1) {
      items.push({
        type: "warning",
        title: "Campaign Overspending",
        detail: `Projected spend ${currency(cohort.projectedSpend)} exceeds budget by ${currency(cohort.projectedSpend - COHORT_BUDGET)}. Consider reducing daily ad spend.`,
        link: "/m/analytics/cohort-tracker",
        linkLabel: "View cohort tracker",
      });
    } else if (cohort.projectedSpend < COHORT_BUDGET * 0.8 && cohort.daysElapsed > 7) {
      items.push({
        type: "warning",
        title: "Campaign Underspending",
        detail: `Only ${currency(cohort.totalSpend)} spent of ${currency(COHORT_BUDGET)} budget. ${cohort.daysRemaining} days left — consider scaling ads.`,
        link: "/m/analytics/cohort-tracker",
        linkLabel: "View cohort tracker",
      });
    }

    // Admissions pace
    if (cohort.daysElapsed > 7) {
      const expectedAdm = (cohort.daysElapsed / cohort.totalDays) * COHORT_TARGET_ADMISSIONS;
      if (cohort.totalAdmissions < expectedAdm * 0.7) {
        items.push({
          type: "warning",
          title: "Admissions Behind Target",
          detail: `${cohort.totalAdmissions}/${COHORT_TARGET_ADMISSIONS} admissions (expected ~${Math.round(expectedAdm)} by now). Close rate or pipeline may need attention.`,
          link: "/m/analytics/sales",
          linkLabel: "View sales analytics",
        });
      } else if (cohort.totalAdmissions >= expectedAdm) {
        items.push({
          type: "success",
          title: "Admissions On Track",
          detail: `${cohort.totalAdmissions}/${COHORT_TARGET_ADMISSIONS} admissions — ahead of target pace. Projected: ${cohort.projectedAdmissions}.`,
          link: "/m/analytics/cohort-tracker",
        });
      }
    }

    // Collection rate
    if (salesQuoted > 0 && collectionRate < 50) {
      items.push({
        type: "warning",
        title: "Low Collection Rate",
        detail: `Only ${collectionRate.toFixed(0)}% of quoted fees collected (${currency(salesCollected)} / ${currency(salesQuoted)}). Follow up on pending payments.`,
        link: "/m/sales/pipeline/settings",
        linkLabel: "View pipeline",
      });
    } else if (collectionRate >= 70) {
      items.push({
        type: "success",
        title: "Strong Collection Rate",
        detail: `${collectionRate.toFixed(0)}% collection rate — ${currency(salesCollected)} collected out of ${currency(salesQuoted)} quoted.`,
      });
    }

    // ROAS check
    if (metaSpend > 10000 && roas < 1) {
      items.push({
        type: "warning",
        title: "ROAS Below 1x",
        detail: `Ad spend of ${currency(metaSpend)} generating only ${currency(totalRevenue)} revenue (${roas.toFixed(1)}x ROAS). Review ad performance.`,
        link: "/m/analytics/meta-ads",
        linkLabel: "View Meta analytics",
      });
    } else if (roas >= 3) {
      items.push({
        type: "success",
        title: `Strong ROAS: ${roas.toFixed(1)}x`,
        detail: `Every ₹1 in ads is generating ₹${roas.toFixed(1)} in revenue. Consider scaling winning campaigns.`,
        link: "/m/marketing/meta/analytics",
      });
    }

    // Meta CTR
    if (metaImpressions > 10000 && metaCTR < 1) {
      items.push({
        type: "info",
        title: "Low Meta CTR",
        detail: `CTR is ${metaCTR.toFixed(2)}% (below 1%). Creative or audience may need refreshing.`,
        link: "/m/marketing/meta/ads",
        linkLabel: "View ads",
      });
    }

    // SEO opportunity
    if (seoImpressions > 10000 && seoClicks < seoImpressions * 0.02) {
      items.push({
        type: "info",
        title: "SEO CTR Opportunity",
        detail: `${compact(seoImpressions)} impressions but only ${compact(seoClicks)} clicks. Improve meta titles and descriptions.`,
        link: "/m/analytics/seo",
        linkLabel: "View SEO analytics",
      });
    }

    // If no issues — all clear
    if (items.length === 0) {
      items.push({
        type: "success",
        title: "All Systems Healthy",
        detail: "No anomalies detected. All KPIs are within expected ranges.",
      });
    }

    return items;
  }, [cohort, salesQuoted, salesCollected, collectionRate, metaSpend, totalRevenue, roas, metaCTR, metaImpressions, seoImpressions, seoClicks]);

  /* ── Render ─────────────────────────────────────── */

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <h1 className="text-xl font-bold text-foreground tracking-tight">Company Overview</h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
          <span className="ml-2 text-muted text-sm">Loading analytics data...</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card rounded-xl p-4 animate-pulse">
              <div className="h-3 w-20 bg-surface-hover rounded mb-3" />
              <div className="h-6 w-16 bg-surface-hover rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card rounded-xl p-4 animate-pulse">
              <div className="h-4 w-32 bg-surface-hover rounded mb-4" />
              <div className="h-[220px] bg-surface-hover rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Company Overview</h1>
            <p className="text-muted text-xs mt-0.5">Aggregated analytics across all departments</p>
          </div>
        </div>
        <select
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value)}
          className="bg-surface border border-border text-foreground text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {DATE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">{error}</div>
      )}

      {/* ── Actionable Insights ──────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <Activity size={14} className="text-accent" />
            <h2 className="text-sm font-bold text-foreground">Insights</h2>
          </div>
          <div className="h-px flex-1 bg-border/50" />
          <span className="text-[10px] text-muted">{insights.filter((i) => i.type === "warning").length} alerts</span>
        </div>

        {/* Warnings first, then info, then successes */}
        {(() => {
          const warnings = insights.filter((i) => i.type === "warning");
          const infos = insights.filter((i) => i.type === "info");
          const successes = insights.filter((i) => i.type === "success");
          const sorted = [...warnings, ...infos, ...successes];

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sorted.map((ins, i) => (
                <InsightCard key={i} insight={ins} index={i} />
              ))}
            </div>
          );
        })()}
      </section>

      {/* ── Primary KPI Cards ────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Key Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatCard label="Revenue" value={currency(totalRevenue)} icon={IndianRupee} color="text-green-400" delta={periodDeltas.revenueDelta} deltaLabel="vs prev" />
          <StatCard label="Ad Spend" value={currency(metaSpend)} icon={Megaphone} color="text-amber-400" delta={periodDeltas.spendDelta} deltaLabel="vs prev" />
          <StatCard label="ROAS" value={roas > 0 ? `${roas.toFixed(1)}x` : "—"} icon={TrendingUp} color={roas >= 2 ? "text-green-400" : roas >= 1 ? "text-amber-400" : "text-red-400"} sub="Revenue / Ad Spend" />
          <StatCard label="SEO Clicks" value={compact(seoClicks)} icon={MousePointer} color="text-blue-400" sub="Search console" />
          <StatCard label="Leads" value={compact(totalLeads)} icon={Users} color="text-purple-400" sub="GHL opportunities" />
          <StatCard label="Quoted" value={currency(salesQuoted)} icon={FileText} color="text-teal-400" />
          <StatCard label="Collected" value={currency(salesCollected)} icon={Wallet} color="text-green-400" sub={`${collectionRate.toFixed(0)}% rate`} />
          <StatCard label="Meta CTR" value={`${metaCTR.toFixed(2)}%`} icon={MousePointer} color={metaCTR >= 2 ? "text-green-400" : "text-amber-400"} sub={`${compact(metaClicks)} clicks`} />
        </div>
      </section>

      {/* ── Cohort Campaign Snapshot ──────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">Admissions Campaign</h2>
          <Link href="/m/analytics/cohort-tracker" className="flex items-center gap-1 text-[10px] text-accent hover:underline">
            Open Cohort Tracker <ArrowRight size={10} />
          </Link>
        </div>
        <div className="card rounded-xl p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
            <div>
              <div className="flex items-center gap-1 mb-1"><Target size={12} className="text-amber-500" /><span className="text-[10px] text-muted uppercase">Admissions</span></div>
              <div className="text-lg font-bold text-foreground">{cohort.totalAdmissions} <span className="text-sm text-muted font-normal">/ {COHORT_TARGET_ADMISSIONS}</span></div>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1"><Megaphone size={12} className="text-red-400" /><span className="text-[10px] text-muted uppercase">Ad Spend</span></div>
              <div className="text-lg font-bold text-foreground">{currency(cohort.totalSpend)}</div>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1"><UserPlus size={12} className="text-purple-400" /><span className="text-[10px] text-muted uppercase">Optins</span></div>
              <div className="text-lg font-bold text-foreground">{cohort.totalOptins}</div>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1"><Users size={12} className="text-cyan-400" /><span className="text-[10px] text-muted uppercase">Meetings</span></div>
              <div className="text-lg font-bold text-foreground">{cohort.totalMeetings}</div>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1"><CreditCard size={12} className="text-green-400" /><span className="text-[10px] text-muted uppercase">CPA</span></div>
              <div className="text-lg font-bold text-foreground">{cohort.cpa > 0 ? currency(cohort.cpa) : "—"}</div>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1"><BarChart3 size={12} className="text-blue-400" /><span className="text-[10px] text-muted uppercase">Forecast</span></div>
              <div className={`text-lg font-bold capitalize ${cohort.status === "on-track" ? "text-green-500" : cohort.status === "overspending" ? "text-red-500" : "text-amber-500"}`}>
                {cohort.status.replace("-", " ")}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1"><Activity size={12} className="text-indigo-400" /><span className="text-[10px] text-muted uppercase">Days Left</span></div>
              <div className="text-lg font-bold text-foreground">{cohort.daysRemaining} <span className="text-sm text-muted font-normal">/ {cohort.totalDays}</span></div>
            </div>
          </div>

          {/* Budget + Admissions progress */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <div className="flex justify-between text-[10px] text-muted mb-1">
                <span>Budget: {currency(cohort.totalSpend)} / {currency(COHORT_BUDGET)}</span>
                <span>{cohort.budgetUsed.toFixed(1)}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-surface overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, cohort.budgetUsed)}%`,
                    backgroundColor: cohort.budgetUsed > 95 ? "#ef4444" : cohort.budgetUsed > 75 ? "#f59e0b" : "#22c55e",
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-muted mb-1">
                <span>Admissions: {cohort.totalAdmissions} / {COHORT_TARGET_ADMISSIONS}</span>
                <span>{COHORT_TARGET_ADMISSIONS > 0 ? ((cohort.totalAdmissions / COHORT_TARGET_ADMISSIONS) * 100).toFixed(0) : 0}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-surface overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (cohort.totalAdmissions / COHORT_TARGET_ADMISSIONS) * 100)}%`,
                    backgroundColor: "#B8860B",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Charts Row 1 ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Revenue vs Ad Spend */}
        <WidgetCard
          title="Revenue vs Ad Spend"
          action={<Link href="/m/analytics/payments" className="text-[10px] text-accent hover:underline">Details →</Link>}
        >
          {revenueVsSpend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenueVsSpend}>
                <XAxis dataKey="date" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${compact(Number(v))}`} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={false} name="Revenue" />
                <Line type="monotone" dataKey="adSpend" stroke="#f59e0b" strokeWidth={2} dot={false} name="Ad Spend" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted text-sm">No data available</div>
          )}
        </WidgetCard>

        {/* Cumulative Revenue & Profit */}
        <WidgetCard title="Cumulative Revenue & Profit">
          {cumulativeRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={cumulativeRevenue}>
                <defs>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${compact(Number(v))}`} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="revenue" stroke="#22c55e" fill="url(#profitGrad)" strokeWidth={2} name="Cum. Revenue" />
                <Area type="monotone" dataKey="adSpend" stroke="#f59e0b" fill="none" strokeWidth={1.5} strokeDasharray="6 3" name="Cum. Ad Spend" />
                <Line type="monotone" dataKey="profit" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Net Profit" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted text-sm">No data available</div>
          )}
        </WidgetCard>
      </div>

      {/* ── Charts Row 2 ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sales Pipeline */}
        <WidgetCard
          title="Sales Pipeline"
          action={<Link href="/m/analytics/sales" className="text-[10px] text-accent hover:underline">Details →</Link>}
        >
          {salesPipeline.some((s) => s.quoted > 0 || s.collected > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={salesPipeline}>
                <XAxis dataKey="name" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${compact(Number(v))}`} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="quoted" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Quoted" />
                <Bar dataKey="collected" fill="#22c55e" radius={[4, 4, 0, 0]} name="Collected" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted text-sm">No data available</div>
          )}
        </WidgetCard>

        {/* SEO Performance */}
        <WidgetCard
          title="SEO Performance"
          action={<Link href="/m/analytics/seo" className="text-[10px] text-accent hover:underline">Details →</Link>}
        >
          {seoPerformance.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={seoPerformance}>
                <XAxis dataKey="date" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#3b82f6" strokeWidth={2} dot={false} name="Clicks" />
                <Line yAxisId="right" type="monotone" dataKey="impressions" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Impressions" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted text-sm">No data available</div>
          )}
        </WidgetCard>
      </div>

      {/* ── Charts Row 3 ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Department Revenue Split */}
        <WidgetCard title="Revenue Breakdown">
          {revenueSplit.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={revenueSplit}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  label={({ name, value }) => `${name || ""}: ${currency(Number(value))}`}
                  labelLine={false}
                >
                  {revenueSplit.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted text-sm">No data available</div>
          )}
        </WidgetCard>

        {/* Quick Links */}
        <WidgetCard title="Quick Actions">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Cohort Tracker", href: "/m/analytics/cohort-tracker", icon: Target, color: "text-amber-500" },
              { label: "Meta Ads", href: "/m/analytics/meta-ads", icon: Megaphone, color: "text-orange-400" },
              { label: "Sales Analytics", href: "/m/analytics/sales", icon: BarChart3, color: "text-green-400" },
              { label: "SEO Analytics", href: "/m/analytics/seo", icon: MousePointer, color: "text-blue-400" },
              { label: "Payment Analytics", href: "/m/analytics/payments", icon: CreditCard, color: "text-purple-400" },
              { label: "GHL Dashboard", href: "/m/analytics/ghl", icon: Users, color: "text-cyan-400" },
              { label: "Pipeline Settings", href: "/m/sales/pipeline/settings", icon: Activity, color: "text-teal-400" },
              { label: "Maverick Sales", href: "/m/sales/pipeline/meetings/maverick/sales-management", icon: Wallet, color: "text-green-400" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-surface hover:bg-surface-hover transition-colors group"
              >
                <item.icon size={14} className={item.color} />
                <span className="text-xs text-muted group-hover:text-foreground transition-colors">{item.label}</span>
                <ArrowRight size={10} className="ml-auto text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </WidgetCard>
      </div>
    </div>
  );
}
