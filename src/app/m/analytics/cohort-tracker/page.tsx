"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Target,
  Calendar,
  DollarSign,
  Phone,
  Users,
  TrendingUp,
  Loader2,
  RefreshCw,
  Filter,
  ChevronDown,
  UserPlus,
  CreditCard,
} from "lucide-react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";

/* ── Types ─────────────────────────────────────────── */

interface DailyMetric {
  id: string;
  date: string;
  ad_spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  optins: number;
  meetings_booked: number;
  calls_completed: number;
  show_ups: number;
  admissions: number;
  revenue_collected: number;
  payments: number;
  notes: string;
  last_synced_at: string | null;
}

interface LiveData {
  totalAdSpend: number;
  totalMeetings: number;
  totalAdmissions: number;
  totalRevenue: number;
  todayAdSpend: number;
  totalOptins: number;
  totalPayments: number;
}

/* ── Constants ─────────────────────────────────────── */

const ADS_START = "2026-03-01"; // Ads went live March 1st
const CAMPAIGN_START = "2026-03-08";
const CAMPAIGN_END = "2026-05-16";
const TOTAL_ADMISSIONS = 40;
const TOTAL_BUDGET = 600_000;

const COLORS = ["#B8860B", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const PHASE_CONFIG = [
  {
    phase: 0,
    name: "Warmup — Ads Live",
    start: "2026-03-01",
    end: "2026-03-07",
    days: 7,
    focus: "Warmup week, initial ad testing",
    spendRange: "₹2K–3K/day",
    dailyBudget: 3000,
    meetingsPerDay: 0,
    callsPerDay: 0,
    admissions: 0,
    borderColor: "border-l-purple-500",
    dotColor: "bg-purple-500",
    barColor: "#8b5cf6",
  },
  {
    phase: 1,
    name: "Phase 1 — Test & Learn",
    start: "2026-03-08",
    end: "2026-03-21",
    days: 14,
    focus: "Test creatives, audiences, messaging",
    spendRange: "₹3K–5K/day",
    dailyBudget: 4000,
    meetingsPerDay: 8,
    callsPerDay: 4,
    admissions: 8,
    borderColor: "border-l-amber-500",
    dotColor: "bg-amber-500",
    barColor: "#f59e0b",
  },
  {
    phase: 2,
    name: "Phase 2 — Scale Hard",
    start: "2026-03-22",
    end: "2026-04-30",
    days: 40,
    focus: "Scale winning ads, maximize pipeline",
    spendRange: "₹8K–10K/day",
    dailyBudget: 9000,
    meetingsPerDay: 12,
    callsPerDay: 6,
    admissions: 25,
    borderColor: "border-l-green-500",
    dotColor: "bg-green-500",
    barColor: "#22c55e",
  },
  {
    phase: 3,
    name: "Phase 3 — Close Out",
    start: "2026-05-01",
    end: "2026-05-16",
    days: 16,
    focus: "Final push, close remaining pipeline",
    spendRange: "₹8K–12K/day",
    dailyBudget: 10000,
    meetingsPerDay: 6,
    callsPerDay: 3,
    admissions: 7,
    borderColor: "border-l-cyan-500",
    dotColor: "bg-cyan-500",
    barColor: "#06b6d4",
  },
];

type DateRange = "all" | "phase0" | "phase1" | "phase2" | "phase3" | "custom";

/* ── Helpers ───────────────────────────────────────── */

function generateDates(start: string, end: string) {
  const dates: string[] = [];
  const current = new Date(start);
  const endDate = new Date(end);
  while (current <= endDate) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function getPhase(date: string): 0 | 1 | 2 | 3 {
  if (date < CAMPAIGN_START) return 0;
  if (date < "2026-03-22") return 1;
  if (date < "2026-05-01") return 2;
  return 3;
}

function currency(val: number) {
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function getPhaseConfig(phase: 0 | 1 | 2 | 3) {
  return PHASE_CONFIG[phase];
}

function pct(num: number, den: number) {
  return den > 0 ? `${((num / den) * 100).toFixed(1)}%` : "—";
}

const ALL_DATES = generateDates(ADS_START, CAMPAIGN_END);

/* ── Reusable Components ──────────────────────────── */

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  sub?: string;
}) {
  return (
    <div className="card rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Icon size={16} style={{ color }} />
        <span className="text-muted text-xs uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-foreground text-xl font-bold">{value}</span>
      {sub && <span className="text-muted text-[10px]">{sub}</span>}
    </div>
  );
}

function WidgetCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`card rounded-xl p-4 ${className}`}>
      <h3 className="text-foreground text-sm font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}

const chartTooltipStyle = {
  background: "#171717",
  border: "1px solid #262626",
  borderRadius: "8px",
  color: "#F5F5F5",
};

/* ── Main Page ────────────────────────────────────── */

export default function CohortTrackerPage() {
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [live, setLive] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [customStart, setCustomStart] = useState(ADS_START);
  const [customEnd, setCustomEnd] = useState(CAMPAIGN_END);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const todayRowRef = useRef<HTMLTableRowElement | null>(null);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics/cohort-metrics");
      const json = await res.json();
      if (json.metrics) {
        setMetrics(json.metrics);
        const synced = json.metrics
          .filter((m: DailyMetric) => m.last_synced_at)
          .sort((a: DailyMetric, b: DailyMetric) =>
            (b.last_synced_at || "").localeCompare(a.last_synced_at || "")
          );
        if (synced.length > 0) {
          setLastSyncTime(synced[0].last_synced_at);
        }
      }
    } catch (e) {
      console.error("Failed to fetch cohort metrics:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLiveData = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const untilDate = today <= CAMPAIGN_END ? today : CAMPAIGN_END;
    let totalAdSpend = 0;
    let todayAdSpend = 0;
    let totalMeetings = 0;
    let totalAdmissions = 0;
    let totalRevenue = 0;
    let totalOptins = 0;
    let totalPayments = 0;

    // ── 1. Meta Ad Spend ──
    try {
      const metaRes = await fetch(
        `/api/meta/account-insights-range?since=${ADS_START}&until=${untilDate}&time_increment=1`
      ).then((r) => r.json());
      interface MetaRow { date_start: string; spend?: string }
      const metaRows: MetaRow[] = metaRes.insights || [];
      totalAdSpend = metaRows.reduce((s, r) => s + parseFloat(r.spend || "0"), 0);
      const todayRow = metaRows.find((r) => r.date_start === today);
      todayAdSpend = todayRow ? parseFloat(todayRow.spend || "0") : 0;
    } catch (e) {
      console.error("Live: Meta fetch failed", e);
    }

    // ── 2. Optins ──
    try {
      const optinRes = await fetch("/api/sales/optin-tracking").then((r) => r.json());
      totalOptins = (optinRes.records || []).length;
    } catch (e) {
      console.error("Live: Optin fetch failed", e);
    }

    // ── 3. Meetings booked ──
    try {
      const callBookedRes = await fetch("/api/sales/call-booked-tracking").then((r) => r.json());
      interface CallRow { created_at?: string }
      const callBooked: CallRow[] = callBookedRes.records || [];
      totalMeetings = callBooked.filter((r) => {
        const d = r.created_at?.slice(0, 10) || "";
        return d >= CAMPAIGN_START && d <= CAMPAIGN_END;
      }).length;
    } catch (e) {
      console.error("Live: Call booked fetch failed", e);
    }

    // ── 4. Admissions + Revenue ──
    try {
      const [mavSalesRes, jobSalesRes] = await Promise.all([
        fetch("/api/sales/maverick-sales-tracking").then((r) => r.json()),
        fetch("/api/sales/jobin-sales-tracking").then((r) => r.json()),
      ]);
      interface SaleRow { opportunity_id: string; fees_collected?: number }
      const mavSales: SaleRow[] = mavSalesRes.records || [];
      const jobSales: SaleRow[] = jobSalesRes.records || [];
      const seen = new Set<string>();
      const allWonDeals: SaleRow[] = [];
      for (const r of mavSales) {
        if (!seen.has(r.opportunity_id)) { seen.add(r.opportunity_id); allWonDeals.push(r); }
      }
      for (const r of jobSales) {
        if (!seen.has(r.opportunity_id)) { seen.add(r.opportunity_id); allWonDeals.push(r); }
      }
      totalAdmissions = allWonDeals.length;
      totalRevenue = allWonDeals.reduce((s, r) => s + (r.fees_collected || 0), 0);
    } catch (e) {
      console.error("Live: Sales fetch failed", e);
    }

    // ── 5. Payments ──
    try {
      const payRes = await fetch("/api/sales/payment-done-tracking").then((r) => r.json());
      totalPayments = (payRes.records || []).length;
    } catch (e) {
      console.error("Live: Payment fetch failed", e);
    }

    setLive({ totalAdSpend, totalMeetings, totalAdmissions, totalRevenue, todayAdSpend, totalOptins, totalPayments });
  }, []);

  useEffect(() => {
    fetchMetrics();
    fetchLiveData();
  }, [fetchMetrics, fetchLiveData]);

  // Auto-sync if stale > 6 hours
  useEffect(() => {
    if (!lastSyncTime) return;
    const hoursSince = (Date.now() - new Date(lastSyncTime).getTime()) / 3_600_000;
    if (hoursSince > 6) {
      triggerSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSyncTime]);

  const triggerSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/analytics/cohort-sync", {
        method: "POST",
        headers: { "x-cron-secret": "manual-trigger" },
      });
      const json = await res.json();
      if (json.success) {
        await fetchMetrics();
      } else {
        console.error("Sync failed:", json.error);
      }
    } catch (e) {
      console.error("Sync error:", e);
    } finally {
      setSyncing(false);
    }
  };

  // ── Date range filtering ──
  const filteredDates = useMemo(() => {
    let start = ADS_START;
    let end = CAMPAIGN_END;
    switch (dateRange) {
      case "phase0": start = "2026-03-01"; end = "2026-03-07"; break;
      case "phase1": start = "2026-03-08"; end = "2026-03-21"; break;
      case "phase2": start = "2026-03-22"; end = "2026-04-30"; break;
      case "phase3": start = "2026-05-01"; end = "2026-05-16"; break;
      case "custom": start = customStart; end = customEnd; break;
    }
    return ALL_DATES.filter((d) => d >= start && d <= end);
  }, [dateRange, customStart, customEnd]);

  const metricsMap = useMemo(() => {
    const map: Record<string, DailyMetric> = {};
    metrics.forEach((m) => { map[m.date?.slice(0, 10)] = m; });
    return map;
  }, [metrics]);

  const emptyMetric = useCallback(
    (date: string): DailyMetric => ({
      id: "", date, ad_spend: 0, impressions: 0, clicks: 0, reach: 0,
      optins: 0, meetings_booked: 0, calls_completed: 0, show_ups: 0,
      admissions: 0, revenue_collected: 0, payments: 0, notes: "", last_synced_at: null,
    }),
    []
  );

  const getMetric = useCallback(
    (date: string): DailyMetric => metricsMap[date] ?? emptyMetric(date),
    [metricsMap, emptyMetric]
  );

  // ── Cumulatives (always over ALL dates for global stats) ──
  const cumulatives = useMemo(() => {
    let totalSpend = 0, totalMeetings = 0, totalCalls = 0, totalShowUps = 0;
    let totalAdmissions = 0, totalRevenue = 0, totalOptins = 0, totalPayments = 0;

    const perDate: Record<string, {
      cumSpend: number; cumMeetings: number; cumCalls: number;
      cumShowUps: number; cumAdmissions: number; cumRevenue: number;
      cumOptins: number; cumPayments: number;
    }> = {};

    for (const date of ALL_DATES) {
      const m = getMetric(date);
      totalSpend += m.ad_spend;
      totalOptins += m.optins || 0;
      totalMeetings += m.meetings_booked;
      totalCalls += m.calls_completed;
      totalShowUps += m.show_ups;
      totalAdmissions += m.admissions;
      totalRevenue += m.revenue_collected;
      totalPayments += m.payments || 0;
      perDate[date] = {
        cumSpend: totalSpend, cumMeetings: totalMeetings, cumCalls: totalCalls,
        cumShowUps: totalShowUps, cumAdmissions: totalAdmissions, cumRevenue: totalRevenue,
        cumOptins: totalOptins, cumPayments: totalPayments,
      };
    }

    return {
      perDate, totalSpend, totalMeetings, totalCalls, totalShowUps,
      totalAdmissions, totalRevenue, totalOptins, totalPayments,
    };
  }, [getMetric]);

  // ── 7-Day Rolling Averages ──
  const rollingAvg = useMemo(() => {
    const window = 7;
    return ALL_DATES.map((date, i) => {
      const start = Math.max(0, i - window + 1);
      const slice = ALL_DATES.slice(start, i + 1);
      const n = slice.length;
      let spend = 0, meetings = 0, admissions = 0, showUps = 0, calls = 0;
      for (const d of slice) {
        const m = getMetric(d);
        spend += m.ad_spend;
        meetings += m.meetings_booked;
        admissions += m.admissions;
        showUps += m.show_ups;
        calls += m.calls_completed;
      }
      const avgSpend = spend / n;
      const showUpRate = meetings > 0 ? (showUps / meetings) * 100 : 0;
      const closeRate = calls > 0 ? (admissions / calls) * 100 : 0;
      const cpl = meetings > 0 ? spend / meetings : 0;
      return {
        date,
        dateLabel: formatDate(date),
        avgSpend: Math.round(avgSpend),
        avgMeetings: +(meetings / n).toFixed(1),
        avgAdmissions: +(admissions / n).toFixed(2),
        showUpRate: +showUpRate.toFixed(1),
        closeRate: +closeRate.toFixed(1),
        costPerLead: Math.round(cpl),
      };
    });
  }, [getMetric]);

  // ── Phase-Level Summaries ──
  const phaseSummaries = useMemo(() => {
    return PHASE_CONFIG.map((cfg) => {
      const phaseDates = ALL_DATES.filter(
        (d) => d >= cfg.start && d <= cfg.end
      );
      const today = new Date().toISOString().slice(0, 10);
      const elapsed = phaseDates.filter((d) => d <= today).length;
      let spend = 0, impressions = 0, clicks = 0, optins = 0;
      let meetings = 0, calls = 0, showUps = 0, admissions = 0, revenue = 0, payments = 0;
      for (const d of phaseDates) {
        const m = getMetric(d);
        spend += m.ad_spend;
        impressions += m.impressions;
        clicks += m.clicks;
        optins += m.optins || 0;
        meetings += m.meetings_booked;
        calls += m.calls_completed;
        showUps += m.show_ups;
        admissions += m.admissions;
        revenue += m.revenue_collected;
        payments += m.payments || 0;
      }
      const plannedBudget = cfg.dailyBudget * cfg.days;
      const budgetUsed = plannedBudget > 0 ? (spend / plannedBudget) * 100 : 0;
      const showUpRate = meetings > 0 ? (showUps / meetings) * 100 : 0;
      const closeRate = calls > 0 ? (admissions / calls) * 100 : 0;
      const cpl = meetings > 0 ? spend / meetings : 0;
      const cpa = admissions > 0 ? spend / admissions : 0;
      const roas = spend > 0 ? revenue / spend : 0;

      return {
        ...cfg,
        elapsed,
        spend, impressions, clicks, optins, meetings, calls, showUps,
        admissions, revenue, payments, plannedBudget, budgetUsed,
        showUpRate, closeRate, cpl, cpa, roas,
      };
    });
  }, [getMetric]);

  // ── Budget Pacing & Forecast ──
  const pacing = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const adsStartD = new Date(ADS_START);
    const endD = new Date(CAMPAIGN_END);
    const todayD = new Date(today);
    const totalDays = Math.ceil((endD.getTime() - adsStartD.getTime()) / 86_400_000) + 1;
    const daysElapsed = Math.max(0, Math.ceil((todayD.getTime() - adsStartD.getTime()) / 86_400_000) + 1);
    const daysRemaining = Math.max(0, totalDays - daysElapsed);

    const spent = live?.totalAdSpend ?? cumulatives.totalSpend;
    const remainingBudget = Math.max(0, TOTAL_BUDGET - spent);
    const suggestedDailySpend = daysRemaining > 0 ? remainingBudget / daysRemaining : 0;

    const allAdDates = generateDates(ADS_START, CAMPAIGN_END);
    const plannedSpendToDate = allAdDates
      .filter((d) => d <= today)
      .reduce((sum, d) => {
        if (d < CAMPAIGN_START) return sum + 3000;
        const phase = getPhase(d);
        return sum + (phase === 1 ? 4000 : phase === 2 ? 9000 : 10000);
      }, 0);
    const spendVariance = spent - plannedSpendToDate;
    const budgetUtilization = TOTAL_BUDGET > 0 ? (spent / TOTAL_BUDGET) * 100 : 0;

    const admissions = live?.totalAdmissions ?? cumulatives.totalAdmissions;
    const admissionsRemaining = Math.max(0, TOTAL_ADMISSIONS - admissions);
    const costPerAdmission = admissions > 0 ? spent / admissions : 0;

    // ── Forecast: projected end-of-campaign numbers ──
    const dailyBurnRate = daysElapsed > 0 ? spent / daysElapsed : 0;
    const projectedTotalSpend = spent + dailyBurnRate * daysRemaining;
    const dailyAdmissionRate = daysElapsed > 0 ? admissions / daysElapsed : 0;
    const projectedAdmissions = Math.round(admissions + dailyAdmissionRate * daysRemaining);
    const projectedCPA = projectedAdmissions > 0 ? projectedTotalSpend / projectedAdmissions : 0;

    let forecastStatus: "on-track" | "overspending" | "underspending" = "on-track";
    if (projectedTotalSpend > TOTAL_BUDGET * 1.05) forecastStatus = "overspending";
    else if (projectedTotalSpend < TOTAL_BUDGET * 0.85) forecastStatus = "underspending";

    return {
      totalDays, daysElapsed, daysRemaining, spent, remainingBudget,
      suggestedDailySpend, plannedSpendToDate, spendVariance, budgetUtilization,
      admissions, admissionsRemaining, costPerAdmission, dailyBurnRate,
      projectedTotalSpend, projectedAdmissions, projectedCPA, forecastStatus,
    };
  }, [live, cumulatives]);

  // ── Chart data (filtered) ──
  const spendChartData = useMemo(() => {
    return filteredDates.map((date) => {
      const m = getMetric(date);
      const phase = getPhase(date);
      const targetMid = phase === 0 ? 3000 : phase === 1 ? 4000 : phase === 2 ? 9000 : 10000;
      return { date: formatDate(date), actual: m.ad_spend, target: targetMid, phase };
    });
  }, [getMetric, filteredDates]);

  const admissionsChartData = useMemo(() => {
    const totalDays = ALL_DATES.length;
    return filteredDates.map((date) => {
      const i = ALL_DATES.indexOf(date);
      const cum = cumulatives.perDate[date];
      return {
        date: formatDate(date),
        actual: cum?.cumAdmissions ?? 0,
        target: Math.round((TOTAL_ADMISSIONS / totalDays) * (i + 1) * 10) / 10,
      };
    });
  }, [cumulatives, filteredDates]);

  const rollingChartData = useMemo(() => {
    const set = new Set(filteredDates);
    return rollingAvg.filter((r) => set.has(r.date));
  }, [rollingAvg, filteredDates]);

  // ── Funnel chart (filtered range totals) ──
  const funnelData = useMemo(() => {
    let optins = 0, meetings = 0, showUps = 0, calls = 0, admissions = 0, payments = 0;
    for (const d of filteredDates) {
      const m = getMetric(d);
      optins += m.optins || 0;
      meetings += m.meetings_booked;
      showUps += m.show_ups;
      calls += m.calls_completed;
      admissions += m.admissions;
      payments += m.payments || 0;
    }
    return [
      { stage: "Optins", value: optins, color: "#8b5cf6" },
      { stage: "Meetings Booked", value: meetings, color: "#f59e0b" },
      { stage: "Show-ups", value: showUps, color: "#06b6d4" },
      { stage: "Calls Completed", value: calls, color: "#22c55e" },
      { stage: "Admissions", value: admissions, color: "#B8860B" },
      { stage: "Payments", value: payments, color: "#ef4444" },
    ];
  }, [getMetric, filteredDates]);

  const scrollToToday = () => {
    if (todayRowRef.current && tableContainerRef.current) {
      const container = tableContainerRef.current;
      const row = todayRowRef.current;
      container.scrollTop = row.offsetTop - container.offsetTop - 48;
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  // Sync freshness indicator
  const syncFreshness = useMemo(() => {
    if (!lastSyncTime) return { color: "text-muted", label: "Never synced" };
    const hours = (Date.now() - new Date(lastSyncTime).getTime()) / 3_600_000;
    if (hours < 6) return { color: "text-green-500", label: "Fresh" };
    if (hours < 24) return { color: "text-amber-500", label: "Stale" };
    return { color: "text-red-500", label: "Outdated" };
  }, [lastSyncTime]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-muted" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* ── Header ──────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="h-1 w-12 rounded-full mb-3" style={{ background: COLORS[0] }} />
          <h1 className="text-2xl font-bold text-foreground">Cohort Tracker</h1>
          <p className="text-muted text-sm mt-1">
            Admissions Cohort — Ads Live Mar 1, Campaign Mar 8 to May 16, 2026
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={triggerSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-surface border border-border text-foreground hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-medium ${syncFreshness.color}`}>
              {syncFreshness.label}
            </span>
            {lastSyncTime && (
              <span className="text-[10px] text-muted">
                {new Date(lastSyncTime).toLocaleString("en-IN", {
                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Date Range Filter ────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter size={14} className="text-muted" />
        {[
          { key: "all" as DateRange, label: "All" },
          { key: "phase0" as DateRange, label: "Warmup" },
          { key: "phase1" as DateRange, label: "Phase 1" },
          { key: "phase2" as DateRange, label: "Phase 2" },
          { key: "phase3" as DateRange, label: "Phase 3" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => { setDateRange(f.key); setShowDatePicker(false); }}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              dateRange === f.key
                ? "bg-foreground text-background border-foreground"
                : "bg-surface border-border text-muted hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="relative">
          <button
            onClick={() => { setDateRange("custom"); setShowDatePicker(!showDatePicker); }}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              dateRange === "custom"
                ? "bg-foreground text-background border-foreground"
                : "bg-surface border-border text-muted hover:text-foreground"
            }`}
          >
            Custom <ChevronDown size={12} />
          </button>
          {showDatePicker && (
            <div className="absolute top-full mt-1 right-0 z-20 bg-surface border border-border rounded-lg p-3 shadow-lg flex gap-2 items-center">
              <input
                type="date"
                value={customStart}
                min={ADS_START}
                max={CAMPAIGN_END}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
              />
              <span className="text-muted text-xs">to</span>
              <input
                type="date"
                value={customEnd}
                min={ADS_START}
                max={CAMPAIGN_END}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
              />
            </div>
          )}
        </div>
        {dateRange !== "all" && (
          <span className="text-[10px] text-muted ml-2">
            Showing {filteredDates.length} days ({formatDate(filteredDates[0])} – {formatDate(filteredDates[filteredDates.length - 1])})
          </span>
        )}
      </div>

      {/* ── Section 1: Live Actuals ──────────────────── */}
      <section>
        <h2 className="text-foreground text-sm font-semibold mb-3 uppercase tracking-wide">
          Live Actuals
          {live && (
            <span className="ml-2 text-[10px] font-normal text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
              Live
            </span>
          )}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatCard icon={DollarSign} label="Total Ad Spend" value={currency(live?.totalAdSpend ?? cumulatives.totalSpend)} color={COLORS[3]} />
          <StatCard icon={UserPlus} label="Optins" value={(live?.totalOptins ?? cumulatives.totalOptins).toString()} color={COLORS[4]} />
          <StatCard icon={Users} label="Meetings Booked" value={(live?.totalMeetings ?? cumulatives.totalMeetings).toString()} color={COLORS[2]} />
          <StatCard icon={Target} label="Admissions" value={`${pacing.admissions} / ${TOTAL_ADMISSIONS}`} color={COLORS[0]} />
          <StatCard icon={CreditCard} label="Payments" value={(live?.totalPayments ?? cumulatives.totalPayments).toString()} color={COLORS[5]} />
          <StatCard icon={DollarSign} label="Revenue" value={currency(live?.totalRevenue ?? cumulatives.totalRevenue)} color={COLORS[1]} />
          <StatCard icon={TrendingUp} label="Today's Spend" value={currency(live?.todayAdSpend ?? 0)} color={COLORS[4]} />
          <StatCard icon={DollarSign} label="Cost / Admission" value={pacing.costPerAdmission > 0 ? currency(pacing.costPerAdmission) : "—"} color={COLORS[5]} />
        </div>
      </section>

      {/* ── Section 2: Budget Pacing + Forecast ──────── */}
      <section>
        <h2 className="text-foreground text-sm font-semibold mb-3 uppercase tracking-wide">
          Budget Pacing & Forecast
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={DollarSign} label="Total Budget" value={currency(TOTAL_BUDGET)} color={COLORS[0]} />
          <StatCard icon={DollarSign} label="Remaining" value={currency(pacing.remainingBudget)} color={pacing.remainingBudget < 50_000 ? COLORS[3] : COLORS[1]} />
          <StatCard icon={TrendingUp} label="Suggested / Day" value={pacing.daysRemaining > 0 ? currency(pacing.suggestedDailySpend) : "—"} color={COLORS[4]} />
          <StatCard icon={Calendar} label="Days" value={`${pacing.daysElapsed} / ${pacing.totalDays}`} color={COLORS[2]} />
          <StatCard icon={Target} label="Budget Used" value={`${pacing.budgetUtilization.toFixed(1)}%`} color={pacing.budgetUtilization > 90 ? COLORS[3] : COLORS[1]} />
          <StatCard
            icon={TrendingUp}
            label={pacing.spendVariance >= 0 ? "Over Plan" : "Under Plan"}
            value={currency(Math.abs(pacing.spendVariance))}
            color={pacing.spendVariance >= 0 ? COLORS[3] : COLORS[1]}
          />
        </div>

        {/* Budget progress bar */}
        <div className="card rounded-xl p-4 mt-3">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-muted">Budget Utilization</span>
            <span className="text-foreground font-medium">
              {currency(pacing.spent)} / {currency(TOTAL_BUDGET)}
            </span>
          </div>
          <div className="h-3 rounded-full bg-surface overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, pacing.budgetUtilization)}%`,
                backgroundColor:
                  pacing.budgetUtilization > 95 ? COLORS[3]
                    : pacing.budgetUtilization > 75 ? COLORS[2]
                    : COLORS[1],
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted mt-1">
            <span>{pacing.daysRemaining} days remaining</span>
            <span>{pacing.admissionsRemaining} admissions remaining</span>
          </div>
        </div>

        {/* Forecast Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <StatCard
            icon={TrendingUp}
            label="Projected Total Spend"
            value={currency(pacing.projectedTotalSpend)}
            color={pacing.forecastStatus === "overspending" ? COLORS[3] : COLORS[1]}
            sub={pacing.projectedTotalSpend > TOTAL_BUDGET ? `${currency(pacing.projectedTotalSpend - TOTAL_BUDGET)} over budget` : `${currency(TOTAL_BUDGET - pacing.projectedTotalSpend)} under budget`}
          />
          <StatCard
            icon={Target}
            label="Projected Admissions"
            value={pacing.projectedAdmissions.toString()}
            color={pacing.projectedAdmissions >= TOTAL_ADMISSIONS ? COLORS[1] : COLORS[3]}
            sub={`Target: ${TOTAL_ADMISSIONS}`}
          />
          <StatCard
            icon={DollarSign}
            label="Projected CPA"
            value={pacing.projectedCPA > 0 ? currency(pacing.projectedCPA) : "—"}
            color={COLORS[5]}
            sub={`Daily burn: ${currency(pacing.dailyBurnRate)}`}
          />
          <div className="card rounded-xl p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} style={{ color: pacing.forecastStatus === "on-track" ? COLORS[1] : pacing.forecastStatus === "overspending" ? COLORS[3] : COLORS[2] }} />
              <span className="text-muted text-xs uppercase tracking-wide">Forecast Status</span>
            </div>
            <span className={`text-xl font-bold capitalize ${
              pacing.forecastStatus === "on-track" ? "text-green-500"
                : pacing.forecastStatus === "overspending" ? "text-red-500"
                : "text-amber-500"
            }`}>
              {pacing.forecastStatus.replace("-", " ")}
            </span>
            <span className="text-muted text-[10px]">Based on current daily rate</span>
          </div>
        </div>
      </section>

      {/* ── Section 3: Full Funnel ───────────────────── */}
      <section>
        <h2 className="text-foreground text-sm font-semibold mb-3 uppercase tracking-wide">
          Full Funnel {dateRange !== "all" && `(${filteredDates.length} days)`}
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {funnelData.map((s) => (
            <div key={s.stage} className="card rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{s.value}</div>
              <div className="text-xs text-muted mt-1">{s.stage}</div>
              <div className="h-1 rounded-full mt-2" style={{ backgroundColor: s.color }} />
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 4: Phase-Level Summaries ─────────── */}
      <section>
        <h2 className="text-foreground text-sm font-semibold mb-3 uppercase tracking-wide">
          Phase Summaries
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {phaseSummaries.map((p) => {
            const admPct = p.admissions > 0 ? Math.min(100, Math.round((p.admissions / (PHASE_CONFIG[p.phase].admissions || 1)) * 100)) : 0;
            const isActive = today >= p.start && today <= p.end;
            const isFuture = today < p.start;
            return (
              <div
                key={p.phase}
                className={`card rounded-xl p-5 border-l-4 ${p.borderColor} ${isFuture ? "opacity-50" : ""}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground text-sm font-semibold">{p.name}</span>
                    {isActive && (
                      <span className="text-[10px] font-medium text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <span className="text-muted text-xs">
                    {formatDate(p.start)} – {formatDate(p.end)} ({p.elapsed}/{p.days} days)
                  </span>
                </div>
                <p className="text-muted text-xs mb-3">{p.focus}</p>

                {/* Key metrics grid */}
                <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-xs mb-3">
                  <div>
                    <span className="text-muted">Spend: </span>
                    <span className="text-foreground font-medium">{currency(p.spend)}</span>
                    <span className="text-muted text-[10px]"> / {currency(p.plannedBudget)}</span>
                  </div>
                  <div>
                    <span className="text-muted">Optins: </span>
                    <span className="text-foreground font-medium">{p.optins}</span>
                  </div>
                  <div>
                    <span className="text-muted">Meetings: </span>
                    <span className="text-foreground font-medium">{p.meetings}</span>
                  </div>
                  <div>
                    <span className="text-muted">Show-ups: </span>
                    <span className="text-foreground font-medium">{p.showUps}</span>
                    <span className="text-muted text-[10px]"> ({pct(p.showUps, p.meetings)})</span>
                  </div>
                  <div>
                    <span className="text-muted">Calls: </span>
                    <span className="text-foreground font-medium">{p.calls}</span>
                  </div>
                  <div>
                    <span className="text-muted">Admissions: </span>
                    <span className="text-foreground font-medium">{p.admissions}</span>
                    <span className="text-muted text-[10px]"> / {PHASE_CONFIG[p.phase].admissions}</span>
                  </div>
                  <div>
                    <span className="text-muted">Revenue: </span>
                    <span className="text-foreground font-medium">{currency(p.revenue)}</span>
                  </div>
                  <div>
                    <span className="text-muted">CPL: </span>
                    <span className="text-foreground font-medium">{p.cpl > 0 ? currency(p.cpl) : "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted">CPA: </span>
                    <span className="text-foreground font-medium">{p.cpa > 0 ? currency(p.cpa) : "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted">ROAS: </span>
                    <span className="text-foreground font-medium">{p.roas > 0 ? `${p.roas.toFixed(1)}x` : "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted">Close Rate: </span>
                    <span className="text-foreground font-medium">{pct(p.admissions, p.calls)}</span>
                  </div>
                  <div>
                    <span className="text-muted">Payments: </span>
                    <span className="text-foreground font-medium">{p.payments}</span>
                  </div>
                </div>

                {/* Admissions + Budget progress bars */}
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-muted mb-0.5">
                      <span>Admissions</span>
                      <span>{p.admissions}/{PHASE_CONFIG[p.phase].admissions}</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${admPct}%`, backgroundColor: p.barColor }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-muted mb-0.5">
                      <span>Budget</span>
                      <span>{p.budgetUsed.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, p.budgetUsed)}%`, backgroundColor: p.budgetUsed > 100 ? COLORS[3] : p.barColor }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Section 5: Funnel Math (Plan) ────────────── */}
      <section>
        <h2 className="text-foreground text-sm font-semibold mb-3 uppercase tracking-wide">
          Funnel Math (Plan)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={Target} label="Admissions Target" value="40" color={COLORS[0]} />
          <StatCard icon={Phone} label="Calls Required (10%)" value="400" color={COLORS[1]} />
          <StatCard icon={Users} label="Meetings (50% show)" value="800" color={COLORS[2]} />
          <StatCard icon={DollarSign} label="Ad Budget" value={currency(600_000)} color={COLORS[3]} />
          <StatCard icon={TrendingUp} label="Revenue (40 × ₹96K)" value={currency(38_40_000)} color={COLORS[4]} />
          <StatCard icon={DollarSign} label="Net Profit Target" value={currency(38_40_000 - TOTAL_BUDGET)} color={COLORS[5]} />
        </div>
      </section>

      {/* ── Section 6: Rolling Averages Charts ───────── */}
      <section>
        <h2 className="text-foreground text-sm font-semibold mb-3 uppercase tracking-wide">
          7-Day Rolling Averages
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WidgetCard title="Avg Daily Spend & CPL (7d)">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rollingChartData}>
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: "#737373" }} interval={6} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="spend" tick={{ fontSize: 10, fill: "#737373" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(Number(v) / 1000).toFixed(0)}K`} />
                  <YAxis yAxisId="cpl" orientation="right" tick={{ fontSize: 10, fill: "#737373" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`} />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(value: unknown, name: unknown) => [
                    currency(Number(value)),
                    String(name) === "avgSpend" ? "Avg Spend" : "CPL",
                  ]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => v === "avgSpend" ? "Avg Daily Spend" : "Cost Per Lead"} />
                  <Line yAxisId="spend" type="monotone" dataKey="avgSpend" stroke={COLORS[2]} strokeWidth={2} dot={false} />
                  <Line yAxisId="cpl" type="monotone" dataKey="costPerLead" stroke={COLORS[3]} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </WidgetCard>

          <WidgetCard title="Show-up Rate & Close Rate (7d)">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rollingChartData}>
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: "#737373" }} interval={6} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#737373" }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${Number(v)}%`} />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(value: unknown, name: unknown) => [
                    `${Number(value).toFixed(1)}%`,
                    String(name) === "showUpRate" ? "Show-up Rate" : "Close Rate",
                  ]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => v === "showUpRate" ? "Show-up Rate" : "Close Rate"} />
                  <ReferenceLine y={60} stroke="#737373" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="showUpRate" stroke={COLORS[5]} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="closeRate" stroke={COLORS[1]} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </WidgetCard>
        </div>
      </section>

      {/* ── Section 7: Ad Spend & Admissions Charts ──── */}
      <section>
        <h2 className="text-foreground text-sm font-semibold mb-3 uppercase tracking-wide">
          Trends
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WidgetCard title="Daily Ad Spend vs Target">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spendChartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#737373" }} interval={6} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#737373" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(Number(v) / 1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(value: unknown, name: unknown) => [
                    currency(Number(value)),
                    String(name) === "actual" ? "Actual Spend" : "Target",
                  ]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => value === "actual" ? "Actual Spend" : "Target"} />
                  <Bar dataKey="actual" fill={COLORS[2]} radius={[2, 2, 0, 0]} />
                  <ReferenceLine y={4000} stroke={COLORS[3]} strokeDasharray="4 4" />
                  <ReferenceLine y={9000} stroke={COLORS[1]} strokeDasharray="4 4" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </WidgetCard>

          <WidgetCard title="Cumulative Admissions vs Target">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={admissionsChartData}>
                  <defs>
                    <linearGradient id="admGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS[1]} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={COLORS[1]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#737373" }} interval={6} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#737373" }} axisLine={false} tickLine={false} domain={[0, 45]} />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(value: unknown, name: unknown) => [
                    String(name) === "actual" ? Number(value) : Number(value).toFixed(1),
                    String(name) === "actual" ? "Actual" : "Target Pace",
                  ]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => value === "actual" ? "Actual" : "Target Pace"} />
                  <Area type="monotone" dataKey="actual" stroke={COLORS[1]} fill="url(#admGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="target" stroke={COLORS[0]} fill="none" strokeWidth={1.5} strokeDasharray="6 3" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </WidgetCard>
        </div>
      </section>

      {/* ── Section 8: Daily Tracker ─────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-foreground text-sm font-semibold uppercase tracking-wide">
            Daily Tracker
            <span className="ml-2 text-[10px] font-normal text-muted bg-surface px-2 py-0.5 rounded-full">
              Auto-synced
            </span>
          </h2>
          <button
            onClick={scrollToToday}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface border border-border text-foreground hover:bg-surface/80 transition-colors"
          >
            <Calendar size={12} />
            Today
          </button>
        </div>
        <div
          ref={tableContainerRef}
          className="card rounded-xl overflow-auto max-h-[520px] relative"
        >
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface">
                <th className="text-left px-3 py-2.5 text-muted font-medium border-b border-border/50 w-8">&nbsp;</th>
                <th className="text-left px-3 py-2.5 text-muted font-medium border-b border-border/50 min-w-[90px]">Date</th>
                <th className="text-right px-3 py-2.5 text-muted font-medium border-b border-border/50 min-w-[90px]">Spend (₹)</th>
                <th className="text-right px-3 py-2.5 text-muted font-medium border-b border-border/50 min-w-[70px]">Impr.</th>
                <th className="text-right px-3 py-2.5 text-muted font-medium border-b border-border/50 min-w-[60px]">Optins</th>
                <th className="text-right px-3 py-2.5 text-muted font-medium border-b border-border/50 min-w-[70px]">Mtgs</th>
                <th className="text-right px-3 py-2.5 text-muted font-medium border-b border-border/50 min-w-[60px]">Calls</th>
                <th className="text-right px-3 py-2.5 text-muted font-medium border-b border-border/50 min-w-[70px]">Shows</th>
                <th className="text-right px-3 py-2.5 text-muted font-medium border-b border-border/50 min-w-[60px]">Adm.</th>
                <th className="text-right px-3 py-2.5 text-muted font-medium border-b border-border/50 min-w-[60px]">Pmts</th>
                <th className="text-right px-3 py-2.5 text-muted font-medium border-b border-border/50 min-w-[90px]">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {filteredDates.map((date, i) => {
                const phase = getPhase(date);
                const cfg = getPhaseConfig(phase);
                const m = getMetric(date);
                const isToday = date === today;
                const isFuture = date > today;
                return (
                  <tr
                    key={date}
                    ref={isToday ? todayRowRef : undefined}
                    className={`${
                      isToday
                        ? "bg-amber-500/10 border-l-2 border-l-amber-500"
                        : isFuture ? "opacity-40"
                        : i % 2 === 0 ? "bg-surface/30" : ""
                    } hover:bg-surface/60 transition-colors`}
                  >
                    <td className="px-3 py-1.5 border-b border-border/50">
                      <div className={`w-2.5 h-2.5 rounded-full ${cfg.dotColor}`} title={`Phase ${phase}`} />
                    </td>
                    <td className="px-3 py-1.5 border-b border-border/50 text-foreground font-medium whitespace-nowrap">
                      {formatDate(date)}
                      {isToday && <span className="ml-1.5 text-[10px] font-bold text-amber-500 uppercase">Today</span>}
                    </td>
                    <td className="px-3 py-1.5 border-b border-border/50 text-right text-foreground tabular-nums">
                      {m.ad_spend > 0 ? currency(m.ad_spend) : "—"}
                    </td>
                    <td className="px-3 py-1.5 border-b border-border/50 text-right text-muted tabular-nums">
                      {m.impressions > 0 ? m.impressions.toLocaleString("en-IN") : "—"}
                    </td>
                    <td className="px-3 py-1.5 border-b border-border/50 text-right text-foreground tabular-nums">
                      {(m.optins || 0) > 0 ? m.optins : "—"}
                    </td>
                    <td className="px-3 py-1.5 border-b border-border/50 text-right text-foreground tabular-nums">
                      {m.meetings_booked > 0 ? m.meetings_booked : "—"}
                    </td>
                    <td className="px-3 py-1.5 border-b border-border/50 text-right text-foreground tabular-nums">
                      {m.calls_completed > 0 ? m.calls_completed : "—"}
                    </td>
                    <td className="px-3 py-1.5 border-b border-border/50 text-right text-foreground tabular-nums">
                      {m.show_ups > 0 ? m.show_ups : "—"}
                    </td>
                    <td className="px-3 py-1.5 border-b border-border/50 text-right text-foreground font-medium tabular-nums">
                      {m.admissions > 0 ? m.admissions : "—"}
                    </td>
                    <td className="px-3 py-1.5 border-b border-border/50 text-right text-foreground tabular-nums">
                      {(m.payments || 0) > 0 ? m.payments : "—"}
                    </td>
                    <td className="px-3 py-1.5 border-b border-border/50 text-right text-foreground tabular-nums">
                      {m.revenue_collected > 0 ? currency(m.revenue_collected) : "—"}
                    </td>
                  </tr>
                );
              })}

              {/* Totals Row */}
              <tr className="bg-surface sticky bottom-0 z-10 border-t-2 border-border">
                <td className="px-3 py-2 font-bold text-foreground" colSpan={2}>
                  Totals {dateRange !== "all" && `(${filteredDates.length}d)`}
                </td>
                <td className="px-3 py-2 text-right text-foreground font-bold tabular-nums">
                  {currency(filteredDates.reduce((s, d) => s + getMetric(d).ad_spend, 0))}
                </td>
                <td className="px-3 py-2 text-right text-muted">—</td>
                <td className="px-3 py-2 text-right text-foreground font-bold tabular-nums">
                  {filteredDates.reduce((s, d) => s + (getMetric(d).optins || 0), 0)}
                </td>
                <td className="px-3 py-2 text-right text-foreground font-bold tabular-nums">
                  {filteredDates.reduce((s, d) => s + getMetric(d).meetings_booked, 0)}
                </td>
                <td className="px-3 py-2 text-right text-foreground font-bold tabular-nums">
                  {filteredDates.reduce((s, d) => s + getMetric(d).calls_completed, 0)}
                </td>
                <td className="px-3 py-2 text-right text-foreground font-bold tabular-nums">
                  {filteredDates.reduce((s, d) => s + getMetric(d).show_ups, 0)}
                </td>
                <td className="px-3 py-2 text-right text-foreground font-bold tabular-nums">
                  {filteredDates.reduce((s, d) => s + getMetric(d).admissions, 0)}
                </td>
                <td className="px-3 py-2 text-right text-foreground font-bold tabular-nums">
                  {filteredDates.reduce((s, d) => s + (getMetric(d).payments || 0), 0)}
                </td>
                <td className="px-3 py-2 text-right text-foreground font-bold tabular-nums">
                  {currency(filteredDates.reduce((s, d) => s + getMetric(d).revenue_collected, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
