"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Loader2,
  IndianRupee,
  Eye,
  MousePointer,
  Users,
  TrendingUp,
  TrendingDown,
  Percent,
  Activity,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Target,
  Zap,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend,
  ReferenceLine,
} from "recharts";
import { apiFetch } from "@/lib/api-fetch";

/* ── Types ─────────────────────────────────────────── */

interface ActionItem {
  action_type: string;
  value: string;
}

interface AccountInsight {
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  date_start?: string;
  actions?: ActionItem[];
  purchase_roas?: ActionItem[];
}

interface CampaignRow {
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: ActionItem[];
  purchase_roas?: ActionItem[];
}

interface DailyInsight {
  date_start: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  ctr?: string;
  cpc?: string;
}

/* ── Constants ─────────────────────────────────────── */

const DATE_PRESETS = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 Days", value: "last_7d" },
  { label: "Last 30 Days", value: "last_30d" },
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
];

const COLORS = [
  "#B8860B", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#6366f1", "#14b8a6", "#f97316",
];

const TOOLTIP_STYLE = {
  background: "#171717",
  border: "1px solid #262626",
  borderRadius: "8px",
  color: "#F5F5F5",
};

// Cohort plan targets
const COHORT_BUDGET = 600_000;
const COHORT_START = "2026-03-01";
const COHORT_END = "2026-05-16";
const PHASE_TARGETS = [
  { phase: "Warmup", start: "2026-03-01", end: "2026-03-07", dailyBudget: 3000, days: 7 },
  { phase: "Phase 1", start: "2026-03-08", end: "2026-03-21", dailyBudget: 4000, days: 14 },
  { phase: "Phase 2", start: "2026-03-22", end: "2026-04-30", dailyBudget: 9000, days: 40 },
  { phase: "Phase 3", start: "2026-05-01", end: "2026-05-16", dailyBudget: 10000, days: 16 },
];

/* ── Helpers ───────────────────────────────────────── */

function rupee(val: number) {
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function num(val: number, digits = 0) {
  return val.toLocaleString("en-IN", { maximumFractionDigits: digits });
}

function compact(val: number) {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(0);
}

function pf(v: string | undefined) {
  return parseFloat(v || "0") || 0;
}

function getLeads(actions?: ActionItem[]) {
  if (!actions) return 0;
  const lead = actions.find((a) => a.action_type === "lead");
  return lead ? pf(lead.value) : 0;
}

function getRoas(roas?: ActionItem[]) {
  if (!roas || roas.length === 0) return null;
  return pf(roas[0].value);
}

function getCurrentPhase() {
  const today = new Date().toISOString().slice(0, 10);
  for (const p of PHASE_TARGETS) {
    if (today >= p.start && today <= p.end) return p;
  }
  return PHASE_TARGETS[PHASE_TARGETS.length - 1];
}

/* ── Insight Type ─────────────────────────────────── */

interface Insight {
  type: "warning" | "success" | "info";
  title: string;
  detail: string;
  link?: string;
  linkLabel?: string;
}

/* ── Sub-components ────────────────────────────────── */

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
  delta?: number;
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
            <Link href={insight.link} className="inline-flex items-center gap-1.5 text-xs font-medium text-accent mt-2 hover:underline group">
              {insight.linkLabel || "View details"}
              <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────── */

export default function MetaAdsAnalyticsPage() {
  const [accountData, setAccountData] = useState<AccountInsight | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [dailyInsights, setDailyInsights] = useState<DailyInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState("last_30d");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const today = new Date().toISOString().slice(0, 10);
        const untilDate = today <= COHORT_END ? today : COHORT_END;

        const [acctRes, campRes, dailyRes] = await Promise.all([
          apiFetch(`/api/meta/account-insights?date_preset=${datePreset}&time_increment=all_days`, { signal: controller.signal }),
          apiFetch(`/api/meta/campaign-insights-bulk?date_preset=${datePreset}`, { signal: controller.signal }),
          apiFetch(`/api/meta/account-insights-range?since=${COHORT_START}&until=${untilDate}&time_increment=1`, { signal: controller.signal })
            .then((r) => r.json()).catch(() => ({ insights: [] })),
        ]);

        if (!acctRes.ok) throw new Error("Failed to fetch account insights");
        if (!campRes.ok) throw new Error("Failed to fetch campaign insights");

        const acctJson = await acctRes.json();
        const campJson = await campRes.json();

        const acctRaw = acctJson.insights;
        const acct: AccountInsight = Array.isArray(acctRaw) ? acctRaw[0] || {} : acctRaw || {};
        const camps: CampaignRow[] = campJson.insights || [];

        setAccountData(acct);
        setCampaigns(camps);
        setDailyInsights(dailyRes.insights || []);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    load();

    return () => controller.abort();
  }, [datePreset]);

  /* ── Derived data ── */

  const sortedCampaigns = useMemo(
    () => [...campaigns].sort((a, b) => pf(b.spend) - pf(a.spend)),
    [campaigns]
  );

  const spendChartData = useMemo(
    () => sortedCampaigns.slice(0, 10).map((c) => ({
      name: (c.campaign_name || "Unnamed").length > 28 ? (c.campaign_name || "Unnamed").slice(0, 28) + "..." : c.campaign_name || "Unnamed",
      spend: pf(c.spend),
    })),
    [sortedCampaigns]
  );

  /* ── KPI values ── */

  const totalSpend = pf(accountData?.spend);
  const totalImpressions = pf(accountData?.impressions);
  const totalClicks = pf(accountData?.clicks);
  const totalReach = pf(accountData?.reach);
  const ctr = pf(accountData?.ctr);
  const cpc = pf(accountData?.cpc);
  const cpm = pf(accountData?.cpm);
  const roasVal = getRoas(accountData?.purchase_roas);
  const totalLeads = useMemo(() => getLeads(accountData?.actions), [accountData]);
  const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

  /* ── Daily trend data (campaign lifetime) ── */

  const dailyTrend = useMemo(() => {
    return dailyInsights
      .sort((a, b) => a.date_start.localeCompare(b.date_start))
      .map((d) => {
        const spend = pf(d.spend);
        const clicks = pf(d.clicks);
        const impressions = pf(d.impressions);
        const ctrDay = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const cpcDay = clicks > 0 ? spend / clicks : 0;
        const dateLabel = new Date(d.date_start).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        return { date: dateLabel, rawDate: d.date_start, spend, clicks, impressions, ctr: +ctrDay.toFixed(2), cpc: +cpcDay.toFixed(0) };
      });
  }, [dailyInsights]);

  /* ── 7-day rolling averages ── */

  const rollingData = useMemo(() => {
    return dailyTrend.map((_, i, arr) => {
      const start = Math.max(0, i - 6);
      const slice = arr.slice(start, i + 1);
      const n = slice.length;
      const avgSpend = slice.reduce((s, r) => s + r.spend, 0) / n;
      const avgCTR = slice.reduce((s, r) => s + r.ctr, 0) / n;
      const avgCPC = slice.reduce((s, r) => s + r.cpc, 0) / n;
      return { date: arr[i].date, avgSpend: Math.round(avgSpend), avgCTR: +avgCTR.toFixed(2), avgCPC: Math.round(avgCPC) };
    });
  }, [dailyTrend]);

  /* ── Cumulative spend vs plan ── */

  const cumulativeVsPlan = useMemo(() => {
    let cumActual = 0;
    let cumPlan = 0;
    return dailyTrend.map((d) => {
      cumActual += d.spend;
      const phase = PHASE_TARGETS.find((p) => d.rawDate >= p.start && d.rawDate <= p.end);
      cumPlan += phase ? phase.dailyBudget : 0;
      return { date: d.date, actual: cumActual, plan: cumPlan };
    });
  }, [dailyTrend]);

  /* ── Period comparison (first vs second half) ── */

  const periodDelta = useMemo(() => {
    const mid = Math.floor(dailyTrend.length / 2);
    if (mid === 0) return { spendDelta: 0, ctrDelta: 0, cpcDelta: 0 };
    const first = dailyTrend.slice(0, mid);
    const second = dailyTrend.slice(mid);
    const fSpend = first.reduce((s, r) => s + r.spend, 0) / first.length;
    const sSpend = second.reduce((s, r) => s + r.spend, 0) / second.length;
    const fCTR = first.reduce((s, r) => s + r.ctr, 0) / first.length;
    const sCTR = second.reduce((s, r) => s + r.ctr, 0) / second.length;
    const fCPC = first.reduce((s, r) => s + r.cpc, 0) / first.length;
    const sCPC = second.reduce((s, r) => s + r.cpc, 0) / second.length;
    return {
      spendDelta: fSpend > 0 ? ((sSpend - fSpend) / fSpend) * 100 : 0,
      ctrDelta: fCTR > 0 ? ((sCTR - fCTR) / fCTR) * 100 : 0,
      cpcDelta: fCPC > 0 ? ((sCPC - fCPC) / fCPC) * 100 : 0,
    };
  }, [dailyTrend]);

  /* ── Campaign Health Scores ── */

  const campaignHealth = useMemo(() => {
    return sortedCampaigns.slice(0, 10).map((c) => {
      const spend = pf(c.spend);
      const clicks = pf(c.clicks);
      const impressions = pf(c.impressions);
      const campCTR = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const campCPC = clicks > 0 ? spend / clicks : 0;
      const campROAS = getRoas(c.purchase_roas) ?? 0;
      const leads = getLeads(c.actions);
      const campCPL = leads > 0 ? spend / leads : 0;

      // Score: CTR weight 25, CPC weight 25 (lower = better), ROAS weight 25, leads weight 25
      let score = 0;
      if (campCTR >= 2) score += 25; else if (campCTR >= 1) score += 15; else if (campCTR > 0) score += 5;
      if (campCPC > 0 && campCPC <= 15) score += 25; else if (campCPC <= 30) score += 15; else if (campCPC > 0) score += 5;
      if (campROAS >= 3) score += 25; else if (campROAS >= 1) score += 15; else if (campROAS > 0) score += 5;
      if (leads >= 10) score += 25; else if (leads >= 3) score += 15; else if (leads > 0) score += 5;

      const health = score >= 70 ? "excellent" : score >= 45 ? "good" : score >= 20 ? "average" : "poor";

      return {
        name: c.campaign_name || "Unnamed",
        spend, clicks, campCTR, campCPC, campROAS, leads, campCPL, score, health,
      };
    });
  }, [sortedCampaigns]);

  /* ── Budget pacing for current phase ── */

  const pacing = useMemo(() => {
    const phase = getCurrentPhase();
    const today = new Date().toISOString().slice(0, 10);
    const totalCampaignSpend = dailyTrend.reduce((s, d) => s + d.spend, 0);
    const remaining = Math.max(0, COHORT_BUDGET - totalCampaignSpend);

    const totalDays = Math.ceil((new Date(COHORT_END).getTime() - new Date(COHORT_START).getTime()) / 86_400_000) + 1;
    const daysElapsed = Math.max(1, Math.ceil((new Date(today).getTime() - new Date(COHORT_START).getTime()) / 86_400_000) + 1);
    const daysRemaining = Math.max(0, totalDays - daysElapsed);
    const suggestedDaily = daysRemaining > 0 ? remaining / daysRemaining : 0;
    const dailyAvg = totalCampaignSpend / daysElapsed;
    const budgetUsed = (totalCampaignSpend / COHORT_BUDGET) * 100;

    return { phase, totalCampaignSpend, remaining, suggestedDaily, dailyAvg, budgetUsed, daysElapsed, daysRemaining };
  }, [dailyTrend]);

  /* ── Insights ── */

  const insights = useMemo(() => {
    const items: Insight[] = [];
    const phase = getCurrentPhase();

    // Spend vs plan
    if (pacing.dailyAvg > phase.dailyBudget * 1.3) {
      items.push({
        type: "warning",
        title: "Daily Spend Exceeds Plan",
        detail: `Averaging ${rupee(pacing.dailyAvg)}/day vs ${rupee(phase.dailyBudget)}/day target for ${phase.phase}. ${rupee(pacing.remaining)} budget remaining.`,
        link: "/m/analytics/cohort-tracker",
        linkLabel: "View budget pacing",
      });
    } else if (pacing.dailyAvg < phase.dailyBudget * 0.6 && pacing.daysElapsed > 3) {
      items.push({
        type: "warning",
        title: "Underspending vs Plan",
        detail: `Averaging ${rupee(pacing.dailyAvg)}/day vs ${rupee(phase.dailyBudget)}/day plan. Consider scaling up to utilize budget.`,
        link: "/m/marketing/meta/campaigns",
        linkLabel: "View campaigns",
      });
    } else {
      items.push({
        type: "success",
        title: "Spend On Track",
        detail: `Daily average ${rupee(pacing.dailyAvg)} aligns with ${rupee(phase.dailyBudget)}/day plan for ${phase.phase}.`,
      });
    }

    // CTR health
    if (totalImpressions > 5000) {
      if (ctr < 1) {
        items.push({
          type: "warning",
          title: `Low CTR: ${ctr.toFixed(2)}%`,
          detail: "Below 1% — ad creatives or targeting may need refresh. Test new hooks and audiences.",
          link: "/m/marketing/meta/ads",
          linkLabel: "Review ad creatives",
        });
      } else if (ctr >= 2) {
        items.push({
          type: "success",
          title: `Strong CTR: ${ctr.toFixed(2)}%`,
          detail: "Above 2% — creatives are resonating well. Consider scaling these ads.",
        });
      } else {
        items.push({
          type: "info",
          title: `CTR: ${ctr.toFixed(2)}%`,
          detail: "Between 1-2% — decent but room for improvement. A/B test headlines and visuals.",
        });
      }
    }

    // CPC trend
    if (periodDelta.cpcDelta > 20) {
      items.push({
        type: "warning",
        title: "CPC Rising",
        detail: `CPC increased ${periodDelta.cpcDelta.toFixed(0)}% in recent period. Audience fatigue may be setting in — refresh creatives or expand targeting.`,
      });
    } else if (periodDelta.cpcDelta < -15) {
      items.push({
        type: "success",
        title: "CPC Improving",
        detail: `CPC decreased ${Math.abs(periodDelta.cpcDelta).toFixed(0)}% recently. Ad efficiency is improving.`,
      });
    }

    // Top campaign health
    const poorCamps = campaignHealth.filter((c) => c.health === "poor" && c.spend > 1000);
    if (poorCamps.length > 0) {
      items.push({
        type: "warning",
        title: `${poorCamps.length} Low-Performing Campaign${poorCamps.length > 1 ? "s" : ""}`,
        detail: `${poorCamps.map((c) => `"${c.name.slice(0, 30)}"`).join(", ")} — spending budget with poor returns. Consider pausing or restructuring.`,
        link: "/m/marketing/meta/campaigns",
        linkLabel: "Review campaigns",
      });
    }

    const excellentCamps = campaignHealth.filter((c) => c.health === "excellent");
    if (excellentCamps.length > 0) {
      items.push({
        type: "success",
        title: `${excellentCamps.length} High-Performing Campaign${excellentCamps.length > 1 ? "s" : ""}`,
        detail: `${excellentCamps.map((c) => `"${c.name.slice(0, 30)}"`).join(", ")} — strong metrics. Scale budget here.`,
      });
    }

    // Lead cost
    if (cpl > 0 && cpl > 500) {
      items.push({
        type: "info",
        title: `CPL: ${rupee(cpl)}`,
        detail: "Cost per lead is above ₹500. Optimize landing pages and lead forms to improve conversion rate.",
      });
    }

    return items;
  }, [pacing, ctr, totalImpressions, periodDelta, campaignHealth, cpl]);

  /* ── Render ── */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  const sortedInsights = [
    ...insights.filter((i) => i.type === "warning"),
    ...insights.filter((i) => i.type === "info"),
    ...insights.filter((i) => i.type === "success"),
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="h-1 w-10 rounded bg-accent mb-3" />
          <h1 className="text-lg font-bold text-foreground tracking-wide">Meta Ads Analytics</h1>
          <p className="text-xs text-muted mt-0.5">Facebook &amp; Instagram ad performance — Campaign period Mar 1 – May 16</p>
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

      {/* ── Insights ─────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <Zap size={14} className="text-accent" />
            <h2 className="text-sm font-bold text-foreground">Insights</h2>
          </div>
          <div className="h-px flex-1 bg-border/50" />
          <span className="text-[10px] text-muted">{insights.filter((i) => i.type === "warning").length} alerts</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sortedInsights.map((ins, i) => (
            <InsightCard key={i} insight={ins} index={i} />
          ))}
        </div>
      </section>

      {/* ── KPI Cards ────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Performance Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatCard label="Total Spend" value={rupee(totalSpend)} icon={IndianRupee} color="text-amber-500" delta={periodDelta.spendDelta} />
          <StatCard label="Impressions" value={compact(totalImpressions)} icon={Eye} color="text-blue-500" />
          <StatCard label="Clicks" value={compact(totalClicks)} icon={MousePointer} color="text-green-500" />
          <StatCard label="Reach" value={compact(totalReach)} icon={Users} color="text-purple-500" />
          <StatCard label="CTR" value={`${ctr.toFixed(2)}%`} icon={Percent} color={ctr >= 2 ? "text-green-500" : ctr >= 1 ? "text-amber-500" : "text-red-500"} delta={periodDelta.ctrDelta} />
          <StatCard label="CPC" value={rupee(cpc)} icon={IndianRupee} color="text-pink-500" delta={periodDelta.cpcDelta ? -periodDelta.cpcDelta : undefined} sub="Lower is better" />
          <StatCard label="CPM" value={rupee(cpm)} icon={IndianRupee} color="text-orange-500" />
          <StatCard label="ROAS" value={roasVal !== null ? `${roasVal.toFixed(1)}x` : "N/A"} icon={TrendingUp} color={roasVal && roasVal >= 2 ? "text-green-500" : "text-amber-500"} />
        </div>
      </section>

      {/* ── Budget Pacing (Plan Context) ─────────────── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">Budget Pacing</h2>
          <Link href="/m/analytics/cohort-tracker" className="flex items-center gap-1 text-[10px] text-accent hover:underline">
            Full cohort tracker <ArrowRight size={10} />
          </Link>
        </div>
        <div className="card rounded-xl p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
            <div>
              <div className="text-[10px] text-muted uppercase mb-0.5">Current Phase</div>
              <div className="text-sm font-bold text-foreground">{pacing.phase.phase}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted uppercase mb-0.5">Daily Avg</div>
              <div className="text-sm font-bold text-foreground">{rupee(pacing.dailyAvg)}</div>
              <div className="text-[10px] text-muted">Plan: {rupee(pacing.phase.dailyBudget)}/day</div>
            </div>
            <div>
              <div className="text-[10px] text-muted uppercase mb-0.5">Total Spent</div>
              <div className="text-sm font-bold text-foreground">{rupee(pacing.totalCampaignSpend)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted uppercase mb-0.5">Remaining</div>
              <div className="text-sm font-bold text-foreground">{rupee(pacing.remaining)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted uppercase mb-0.5">Suggested / Day</div>
              <div className="text-sm font-bold text-foreground">{rupee(pacing.suggestedDaily)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted uppercase mb-0.5">Days Left</div>
              <div className="text-sm font-bold text-foreground">{pacing.daysRemaining}</div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-muted mb-1">
              <span>Budget Utilization</span>
              <span>{rupee(pacing.totalCampaignSpend)} / {rupee(COHORT_BUDGET)} ({pacing.budgetUsed.toFixed(1)}%)</span>
            </div>
            <div className="h-2.5 rounded-full bg-surface overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, pacing.budgetUsed)}%`,
                  backgroundColor: pacing.budgetUsed > 95 ? "#ef4444" : pacing.budgetUsed > 75 ? "#f59e0b" : "#22c55e",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Daily Trend Charts ────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Daily Trends</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WidgetCard title="Daily Spend vs Plan">
            {dailyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dailyTrend}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#737373" }} interval={Math.max(1, Math.floor(dailyTrend.length / 10))} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#737373" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${compact(Number(v))}`} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => [rupee(Number(v)), "Spend"]} />
                  <Bar dataKey="spend" fill={COLORS[2]} radius={[2, 2, 0, 0]} />
                  {PHASE_TARGETS.map((p, i) => (
                    <ReferenceLine key={i} y={p.dailyBudget} stroke={COLORS[i + 3]} strokeDasharray="4 4" />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-muted text-sm">No daily data</div>
            )}
          </WidgetCard>

          <WidgetCard title="Cumulative Spend vs Plan">
            {cumulativeVsPlan.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={cumulativeVsPlan}>
                  <defs>
                    <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS[2]} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={COLORS[2]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#737373" }} interval={Math.max(1, Math.floor(cumulativeVsPlan.length / 10))} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#737373" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${compact(Number(v))}`} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown, n: unknown) => [rupee(Number(v)), String(n) === "actual" ? "Actual" : "Plan"]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => v === "actual" ? "Actual Spend" : "Planned Spend"} />
                  <Area type="monotone" dataKey="actual" stroke={COLORS[2]} fill="url(#actualGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="plan" stroke={COLORS[0]} fill="none" strokeWidth={1.5} strokeDasharray="6 3" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-muted text-sm">No daily data</div>
            )}
          </WidgetCard>
        </div>
      </section>

      {/* ── Rolling Averages ──────────────────────────── */}
      {rollingData.length > 3 && (
        <section>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">7-Day Rolling Averages</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <WidgetCard title="Avg Daily Spend (7d)">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={rollingData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#737373" }} interval={Math.max(1, Math.floor(rollingData.length / 10))} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#737373" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${compact(Number(v))}`} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => [rupee(Number(v)), "Avg Spend"]} />
                  <Line type="monotone" dataKey="avgSpend" stroke={COLORS[2]} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </WidgetCard>

            <WidgetCard title="CTR & CPC (7d Rolling)">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={rollingData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#737373" }} interval={Math.max(1, Math.floor(rollingData.length / 10))} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="ctr" tick={{ fontSize: 10, fill: "#737373" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Number(v)}%`} />
                  <YAxis yAxisId="cpc" orientation="right" tick={{ fontSize: 10, fill: "#737373" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${Number(v)}`} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown, n: unknown) => [
                    String(n) === "avgCTR" ? `${Number(v).toFixed(2)}%` : rupee(Number(v)),
                    String(n) === "avgCTR" ? "Avg CTR" : "Avg CPC",
                  ]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => v === "avgCTR" ? "CTR %" : "CPC ₹"} />
                  <Line yAxisId="ctr" type="monotone" dataKey="avgCTR" stroke={COLORS[5]} strokeWidth={2} dot={false} />
                  <Line yAxisId="cpc" type="monotone" dataKey="avgCPC" stroke={COLORS[3]} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </WidgetCard>
          </div>
        </section>
      )}

      {/* ── Campaign Health Table ─────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Campaign Health</h2>
        <div className="card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: "900px" }}>
              <thead>
                <tr className="sticky top-0 bg-surface text-muted border-b border-border">
                  <th className="text-left py-2.5 px-3 font-medium">Campaign</th>
                  <th className="text-center py-2.5 px-3 font-medium">Health</th>
                  <th className="text-right py-2.5 px-3 font-medium">Spend</th>
                  <th className="text-right py-2.5 px-3 font-medium">CTR</th>
                  <th className="text-right py-2.5 px-3 font-medium">CPC</th>
                  <th className="text-right py-2.5 px-3 font-medium">ROAS</th>
                  <th className="text-right py-2.5 px-3 font-medium">Leads</th>
                  <th className="text-right py-2.5 px-3 font-medium">CPL</th>
                  <th className="text-right py-2.5 px-3 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {campaignHealth.map((c, i) => {
                  const healthColor = {
                    excellent: "bg-green-500/15 text-green-500 border-green-500/30",
                    good: "bg-blue-500/15 text-blue-500 border-blue-500/30",
                    average: "bg-amber-500/15 text-amber-500 border-amber-500/30",
                    poor: "bg-red-500/15 text-red-500 border-red-500/30",
                  }[c.health];
                  return (
                    <tr key={i} className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors">
                      <td className="py-2 px-3 text-foreground font-medium max-w-[250px] truncate">{c.name}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${healthColor}`}>
                          {c.health}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-foreground tabular-nums">{rupee(c.spend)}</td>
                      <td className={`py-2 px-3 text-right tabular-nums ${c.campCTR >= 2 ? "text-green-500" : c.campCTR >= 1 ? "text-foreground" : "text-red-400"}`}>
                        {c.campCTR.toFixed(2)}%
                      </td>
                      <td className={`py-2 px-3 text-right tabular-nums ${c.campCPC <= 15 ? "text-green-500" : c.campCPC <= 30 ? "text-foreground" : "text-red-400"}`}>
                        {rupee(c.campCPC)}
                      </td>
                      <td className={`py-2 px-3 text-right tabular-nums ${c.campROAS >= 3 ? "text-green-500" : c.campROAS >= 1 ? "text-foreground" : "text-muted"}`}>
                        {c.campROAS > 0 ? `${c.campROAS.toFixed(1)}x` : "—"}
                      </td>
                      <td className="py-2 px-3 text-right text-foreground tabular-nums">{c.leads > 0 ? num(c.leads) : "—"}</td>
                      <td className="py-2 px-3 text-right text-foreground tabular-nums">{c.campCPL > 0 ? rupee(c.campCPL) : "—"}</td>
                      <td className="py-2 px-3 text-right">
                        <span className="text-foreground font-bold">{c.score}</span>
                        <span className="text-muted">/100</span>
                      </td>
                    </tr>
                  );
                })}
                {campaignHealth.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted text-xs">No campaign data available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Spend by Campaign Chart ──────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WidgetCard title="Spend by Campaign (Top 10)">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={spendChartData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v) => rupee(Number(v))} />
              <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 10, fill: "#888" }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [rupee(Number(v)), "Spend"]} />
              <Bar dataKey="spend" fill={COLORS[0]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </WidgetCard>

        {/* Phase Plan Reference */}
        <WidgetCard title="Campaign Plan">
          <div className="space-y-3">
            {PHASE_TARGETS.map((p, i) => {
              const today = new Date().toISOString().slice(0, 10);
              const isActive = today >= p.start && today <= p.end;
              const isPast = today > p.end;
              const phaseSpend = dailyTrend.filter((d) => d.rawDate >= p.start && d.rawDate <= p.end).reduce((s, d) => s + d.spend, 0);
              const planned = p.dailyBudget * p.days;
              const usedPct = planned > 0 ? (phaseSpend / planned) * 100 : 0;

              return (
                <div key={i} className={`p-3 rounded-lg ${isActive ? "bg-accent/10 border border-accent/30" : "bg-surface"} ${!isPast && !isActive ? "opacity-50" : ""}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{p.phase}</span>
                      {isActive && <span className="text-[9px] font-medium text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded-full">Active</span>}
                    </div>
                    <span className="text-[10px] text-muted">{rupee(p.dailyBudget)}/day × {p.days}d = {rupee(planned)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-muted mb-1">
                    <span>Spent: {rupee(phaseSpend)}</span>
                    <span>{usedPct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, usedPct)}%`, backgroundColor: COLORS[i + 1] }} />
                  </div>
                </div>
              );
            })}
            <div className="p-3 rounded-lg bg-surface border border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Total Budget</span>
                <span className="text-xs font-bold text-foreground">{rupee(COHORT_BUDGET)}</span>
              </div>
            </div>
          </div>
        </WidgetCard>
      </div>
    </div>
  );
}
