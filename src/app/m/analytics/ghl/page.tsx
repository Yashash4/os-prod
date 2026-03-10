"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Target,
  IndianRupee,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Calendar,
  Users,
  Loader2,
  Zap,
  AlertTriangle,
  Activity,
  ArrowRight,
  UserPlus,
  Clock,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { apiFetch } from "@/lib/api-fetch";

/* ── Types ─────────────────────────────────────────── */

interface OpportunityContact { name: string; email: string; phone: string; }

interface Opportunity {
  id: string; name: string; monetaryValue: number; status: string;
  pipelineStageId: string; pipelineId: string; assignedTo: string;
  contact: OpportunityContact; createdAt: string; updatedAt: string;
}

interface PipelineStage { id: string; name: string; }
interface Pipeline { id: string; name: string; stages: PipelineStage[]; }
interface CalendarEvent { id: string; startTime: string; endTime: string; appointmentStatus: string; assignedUserId: string; contactId: string; }

interface Insight {
  type: "warning" | "success" | "info";
  title: string;
  detail: string;
  link?: string;
  linkLabel?: string;
}

/* ── Constants ─────────────────────────────────────── */

const COLORS = ["#B8860B", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

const TOOLTIP_STYLE = { background: "#171717", border: "1px solid #262626", borderRadius: "8px", color: "#F5F5F5" };

const STATUS_BADGE: Record<string, string> = {
  open: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  won: "bg-green-500/20 text-green-400 border-green-500/30",
  lost: "bg-red-500/20 text-red-400 border-red-500/30",
  abandoned: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const DATE_PRESETS = [
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "All Time", value: "all" },
];

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

/* ── Helpers ───────────────────────────────────────── */

function rupee(val: number) { return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`; }
function compact(val: number) { return val >= 1_000_000 ? `${(val / 1_000_000).toFixed(1)}M` : val >= 1_000 ? `${(val / 1_000).toFixed(1)}K` : val.toFixed(0); }

/* ── Reusable Components ──────────────────────────── */

function StatCard({ label, value, sub, icon: Icon, color = "text-accent", delta }: {
  label: string; value: string | number; sub?: string; icon?: React.ElementType; color?: string; delta?: number;
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
    warning: { icon: <AlertTriangle size={16} />, iconBg: "bg-amber-500/15", iconText: "text-amber-500", badge: "bg-amber-500/10 text-amber-500 border-amber-500/20", badgeLabel: "Needs Attention", glow: "shadow-amber-500/5" },
    success: { icon: <CheckCircle size={16} />, iconBg: "bg-green-500/15", iconText: "text-green-500", badge: "bg-green-500/10 text-green-500 border-green-500/20", badgeLabel: "Healthy", glow: "shadow-green-500/5" },
    info: { icon: <Activity size={16} />, iconBg: "bg-blue-500/15", iconText: "text-blue-500", badge: "bg-blue-500/10 text-blue-500 border-blue-500/20", badgeLabel: "Opportunity", glow: "shadow-blue-500/5" },
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
          {insight.link && (
            <Link href={insight.link} className="inline-flex items-center gap-1.5 text-xs font-medium text-accent mt-2 hover:underline group">
              {insight.linkLabel || "View details"} <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────── */

export default function GHLDashboardPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState("all");

  const fetchData = useCallback(async (signal?: AbortSignal, isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      setError(null);
      // Fetch pipelines and calendars in parallel
      const [pipRes, calRes] = await Promise.all([
        apiFetch("/api/ghl/pipelines", { signal }),
        apiFetch("/api/ghl/calendars", { signal }),
      ]);
      if (!pipRes.ok) throw new Error("Failed to fetch pipelines");
      const pipJson = await pipRes.json();
      const fetchedPipelines: Pipeline[] = pipJson.pipelines || [];
      setPipelines(fetchedPipelines);

      // Fetch opportunities for EACH pipeline, then combine
      const oppResults = await Promise.all(
        fetchedPipelines.map((p) =>
          apiFetch(`/api/ghl/opportunities?pipeline_id=${p.id}`, { signal }).then((r) => r.json())
        )
      );
      const allOpportunities = oppResults.flatMap((r) => r.opportunities || []);
      setOpportunities(allOpportunities);

      // Fetch calendar events: need calendarId + date range per calendar
      const calJson = calRes.ok ? await calRes.json() : { calendars: [] };
      const calendars: { id: string }[] = calJson.calendars || [];
      if (calendars.length > 0) {
        const now = new Date();
        const start = new Date(now);
        start.setMonth(start.getMonth() - 6); // fetch 6 months of events
        const allEvents: CalendarEvent[] = [];
        const evtResults = await Promise.all(
          calendars.map((cal) =>
            apiFetch(`/api/ghl/calendar-events?calendarId=${cal.id}&startTime=${start.toISOString()}&endTime=${now.toISOString()}`, { signal })
              .then((r) => r.json())
              .catch(() => ({ events: [] }))
          )
        );
        evtResults.forEach((data) => { if (data.events) allEvents.push(...data.events); });
        setEvents(allEvents);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [datePreset, fetchData]);

  const stageMap = useMemo(() => {
    const map: Record<string, string> = {};
    pipelines.forEach((p) => p.stages.forEach((s) => { map[s.id] = s.name; }));
    return map;
  }, [pipelines]);

  const filteredOpportunities = useMemo(() => {
    const range = getDateRange(datePreset);
    if (!range) return opportunities;
    return opportunities.filter((item) => {
      const d = item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : null;
      if (!d) return true;
      return d >= range.start && d <= range.end;
    });
  }, [opportunities, datePreset]);

  const filteredEvents = useMemo(() => {
    const range = getDateRange(datePreset);
    if (!range) return events;
    return events.filter((item) => {
      const d = item.startTime ? new Date(item.startTime).toISOString().slice(0, 10) : null;
      if (!d) return true;
      return d >= range.start && d <= range.end;
    });
  }, [events, datePreset]);

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    const total = filteredOpportunities.length;
    const pipelineValue = filteredOpportunities.reduce((sum, o) => sum + (o.monetaryValue || 0), 0);
    const openCount = filteredOpportunities.filter((o) => o.status === "open").length;
    const wonCount = filteredOpportunities.filter((o) => o.status === "won").length;
    const lostCount = filteredOpportunities.filter((o) => o.status === "lost").length;
    const wonValue = filteredOpportunities.filter((o) => o.status === "won").reduce((s, o) => s + (o.monetaryValue || 0), 0);
    const lostValue = filteredOpportunities.filter((o) => o.status === "lost").reduce((s, o) => s + (o.monetaryValue || 0), 0);
    const winRate = wonCount + lostCount > 0 ? (wonCount / (wonCount + lostCount)) * 100 : 0;
    const avgDealSize = wonCount > 0 ? wonValue / wonCount : 0;
    const totalEvents = filteredEvents.length;
    const now = new Date().toISOString();
    const upcomingEvents = filteredEvents.filter((e) => e.startTime > now).length;
    const showedEvents = filteredEvents.filter((e) => e.appointmentStatus === "showed").length;
    const noShowEvents = filteredEvents.filter((e) => e.appointmentStatus === "noshow").length;
    const showUpRate = showedEvents + noShowEvents > 0 ? (showedEvents / (showedEvents + noShowEvents)) * 100 : 0;

    return { total, pipelineValue, openCount, wonCount, lostCount, wonValue, lostValue, winRate, avgDealSize, totalEvents, upcomingEvents, showedEvents, noShowEvents, showUpRate };
  }, [filteredOpportunities, filteredEvents]);

  /* ── Period deltas (first-half vs second-half) ── */
  const deltas = useMemo(() => {
    const sorted = [...filteredOpportunities].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const mid = Math.floor(sorted.length / 2);
    const first = sorted.slice(0, mid);
    const second = sorted.slice(mid);

    const sortedEvents = [...filteredEvents].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    const eMid = Math.floor(sortedEvents.length / 2);
    const firstEvents = sortedEvents.slice(0, eMid);
    const secondEvents = sortedEvents.slice(eMid);

    function pctDelta(prev: number, curr: number) {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    }

    const firstWon = first.filter((o) => o.status === "won").length;
    const secondWon = second.filter((o) => o.status === "won").length;
    const firstLost = first.filter((o) => o.status === "lost").length;
    const secondLost = second.filter((o) => o.status === "lost").length;
    const firstWonVal = first.filter((o) => o.status === "won").reduce((s, o) => s + (o.monetaryValue || 0), 0);
    const secondWonVal = second.filter((o) => o.status === "won").reduce((s, o) => s + (o.monetaryValue || 0), 0);
    const firstPipeVal = first.reduce((s, o) => s + (o.monetaryValue || 0), 0);
    const secondPipeVal = second.reduce((s, o) => s + (o.monetaryValue || 0), 0);
    const firstWinRate = firstWon + firstLost > 0 ? (firstWon / (firstWon + firstLost)) * 100 : 0;
    const secondWinRate = secondWon + secondLost > 0 ? (secondWon / (secondWon + secondLost)) * 100 : 0;
    const firstAvgDeal = firstWon > 0 ? firstWonVal / firstWon : 0;
    const secondAvgDeal = secondWon > 0 ? secondWonVal / secondWon : 0;

    const firstShowed = firstEvents.filter((e) => e.appointmentStatus === "showed").length;
    const secondShowed = secondEvents.filter((e) => e.appointmentStatus === "showed").length;
    const firstNoShow = firstEvents.filter((e) => e.appointmentStatus === "noshow").length;
    const secondNoShow = secondEvents.filter((e) => e.appointmentStatus === "noshow").length;
    const firstShowRate = firstShowed + firstNoShow > 0 ? (firstShowed / (firstShowed + firstNoShow)) * 100 : 0;
    const secondShowRate = secondShowed + secondNoShow > 0 ? (secondShowed / (secondShowed + secondNoShow)) * 100 : 0;

    return {
      totalDeals: pctDelta(first.length, second.length),
      pipelineValue: pctDelta(firstPipeVal, secondPipeVal),
      openCount: pctDelta(first.filter((o) => o.status === "open").length, second.filter((o) => o.status === "open").length),
      wonCount: pctDelta(firstWon, secondWon),
      lostCount: pctDelta(firstLost, secondLost),
      winRate: secondWinRate - firstWinRate,
      avgDealSize: pctDelta(firstAvgDeal, secondAvgDeal),
      showUpRate: secondShowRate - firstShowRate,
    };
  }, [filteredOpportunities, filteredEvents]);

  /* ── Daily opportunity creation trend ── */
  const dailyCreation = useMemo(() => {
    const byDate: Record<string, { total: number; won: number; lost: number }> = {};
    filteredOpportunities.forEach((o) => {
      const d = o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10) : null;
      if (!d) return;
      if (!byDate[d]) byDate[d] = { total: 0, won: 0, lost: 0 };
      byDate[d].total++;
      if (o.status === "won") byDate[d].won++;
      if (o.status === "lost") byDate[d].lost++;
    });
    return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date: date.slice(5), ...data }));
  }, [filteredOpportunities]);

  /* ── Cumulative pipeline value ── */
  const cumulativeValue = useMemo(() => {
    let cumTotal = 0, cumWon = 0;
    return dailyCreation.map((d) => {
      cumTotal += d.total;
      cumWon += d.won;
      return { date: d.date, totalDeals: cumTotal, wonDeals: cumWon };
    });
  }, [dailyCreation]);

  /* ── Conversion funnel ── */
  const funnelData = useMemo(() => {
    const stages: Record<string, number> = {};
    filteredOpportunities.forEach((o) => {
      const name = stageMap[o.pipelineStageId] || "Unknown";
      stages[name] = (stages[name] || 0) + 1;
    });
    return Object.entries(stages).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [filteredOpportunities, stageMap]);

  /* ── Status chart ── */
  const statusChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredOpportunities.forEach((o) => { const s = o.status || "unknown"; counts[s] = (counts[s] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value })).sort((a, b) => b.value - a.value);
  }, [filteredOpportunities]);

  /* ── Event status data ── */
  const eventStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredEvents.forEach((e) => { const s = (e.appointmentStatus || "unknown").toLowerCase(); counts[s] = (counts[s] || 0) + 1; });
    const labelMap: Record<string, string> = { confirmed: "Confirmed", cancelled: "Cancelled", showed: "Showed", noshow: "No Show" };
    return Object.entries(counts).map(([key, count]) => ({ name: labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1), count }));
  }, [filteredEvents]);

  /* ── Deal value distribution ── */
  const valueDistribution = useMemo(() => {
    const buckets = [
      { label: "0-25K", min: 0, max: 25000, count: 0 },
      { label: "25K-50K", min: 25000, max: 50000, count: 0 },
      { label: "50K-1L", min: 50000, max: 100000, count: 0 },
      { label: "1L-2L", min: 100000, max: 200000, count: 0 },
      { label: "2L+", min: 200000, max: Infinity, count: 0 },
    ];
    filteredOpportunities.forEach((o) => {
      const val = o.monetaryValue || 0;
      for (const b of buckets) { if (val >= b.min && val < b.max) { b.count++; break; } }
    });
    return buckets.map((b) => ({ name: b.label, count: b.count }));
  }, [filteredOpportunities]);

  /* ── Recent opportunities ── */
  const recentOpportunities = useMemo(() => {
    return [...filteredOpportunities].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20);
  }, [filteredOpportunities]);

  /* ── Insights ── */
  const insights = useMemo(() => {
    const items: Insight[] = [];

    // Win rate
    if (kpis.wonCount + kpis.lostCount >= 5) {
      if (kpis.winRate < 20) {
        items.push({ type: "warning", title: `Low Win Rate: ${kpis.winRate.toFixed(0)}%`, detail: `Only ${kpis.wonCount} won out of ${kpis.wonCount + kpis.lostCount} decided deals. Review sales pitch, objection handling, and lead quality.`, link: "/m/sales/pipeline/settings", linkLabel: "View pipeline" });
      } else if (kpis.winRate >= 50) {
        items.push({ type: "success", title: `Strong Win Rate: ${kpis.winRate.toFixed(0)}%`, detail: `${kpis.wonCount} of ${kpis.wonCount + kpis.lostCount} decided deals won — solid sales execution.` });
      }
    }

    // Open deals aging
    if (kpis.openCount > 10) {
      items.push({ type: "info", title: `${kpis.openCount} Open Deals`, detail: `${rupee(filteredOpportunities.filter((o) => o.status === "open").reduce((s, o) => s + (o.monetaryValue || 0), 0))} in open pipeline. Follow up on stale deals to push conversions.`, link: "/m/sales/ghl/opportunities", linkLabel: "View opportunities" });
    }

    // Show-up rate
    if (kpis.showedEvents + kpis.noShowEvents >= 5) {
      if (kpis.showUpRate < 50) {
        items.push({ type: "warning", title: `Low Show-up Rate: ${kpis.showUpRate.toFixed(0)}%`, detail: `${kpis.noShowEvents} no-shows out of ${kpis.showedEvents + kpis.noShowEvents} scheduled. Send reminders and confirm appointments.`, link: "/m/sales/ghl/calendar", linkLabel: "View calendar" });
      } else if (kpis.showUpRate >= 70) {
        items.push({ type: "success", title: `Good Show-up Rate: ${kpis.showUpRate.toFixed(0)}%`, detail: "Above 70% — appointment confirmation process is working well." });
      }
    }

    // Pipeline value
    if (kpis.pipelineValue > 0 && kpis.wonValue > 0) {
      const conversionValue = kpis.pipelineValue > 0 ? (kpis.wonValue / kpis.pipelineValue) * 100 : 0;
      if (conversionValue < 15) {
        items.push({ type: "warning", title: `Low Value Conversion: ${conversionValue.toFixed(0)}%`, detail: `Only ${rupee(kpis.wonValue)} of ${rupee(kpis.pipelineValue)} pipeline value converted. High-value deals may need more attention.` });
      } else {
        items.push({ type: "success", title: `Value Conversion: ${conversionValue.toFixed(0)}%`, detail: `${rupee(kpis.wonValue)} won from ${rupee(kpis.pipelineValue)} total pipeline value.` });
      }
    }

    // Lost deal value
    if (kpis.lostValue > 100000) {
      items.push({ type: "info", title: `${rupee(kpis.lostValue)} in Lost Deals`, detail: `${kpis.lostCount} deals lost. Analyze reasons and implement win-back campaigns for recoverable leads.`, link: "/m/sales/ghl/opportunities", linkLabel: "Review lost deals" });
    }

    // Upcoming events
    if (kpis.upcomingEvents > 0) {
      items.push({ type: "info", title: `${kpis.upcomingEvents} Upcoming Appointments`, detail: "Ensure pre-call preparation and send confirmation reminders to reduce no-shows.", link: "/m/sales/ghl/calendar", linkLabel: "View calendar" });
    }

    if (items.length === 0) {
      items.push({ type: "success", title: "Pipeline Healthy", detail: "No anomalies detected in your GHL pipeline." });
    }

    return items;
  }, [kpis, filteredOpportunities]);

  /* ── Render ── */

  if (loading) return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-1 h-6 bg-accent rounded-full" />
        <div className="h-5 w-40 bg-border/50 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card rounded-xl p-4 space-y-2">
            <div className="h-3 w-20 bg-border/50 rounded animate-pulse" />
            <div className="h-6 w-16 bg-border/50 rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card rounded-xl p-4">
            <div className="h-4 w-32 bg-border/50 rounded animate-pulse mb-4" />
            <div className="h-[220px] bg-border/50 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2"><div className="w-1 h-6 bg-accent rounded-full" /><h1 className="text-lg font-bold text-foreground tracking-wide">GHL Dashboard</h1></div>
        <div className="flex items-center justify-center h-64"><p className="text-red-400 text-sm">{error}</p></div>
      </div>
    );
  }

  const sortedInsights = [...insights.filter((i) => i.type === "warning"), ...insights.filter((i) => i.type === "info"), ...insights.filter((i) => i.type === "success")];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 bg-accent rounded-full" />
            <h1 className="text-lg font-bold text-foreground tracking-wide">GHL Dashboard</h1>
          </div>
          <p className="text-xs text-muted mt-0.5 ml-3">GoHighLevel pipeline and opportunity analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchData(undefined, true)} disabled={refreshing}
            className="flex items-center gap-1.5 bg-surface border border-border text-muted hover:text-foreground text-xs rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50">
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <select value={datePreset} onChange={(e) => setDatePreset(e.target.value)} className="px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent">
            {DATE_PRESETS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
          </select>
        </div>
      </div>

      {/* Insights */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1.5"><Zap size={14} className="text-accent" /><h2 className="text-sm font-bold text-foreground">Insights</h2></div>
          <div className="h-px flex-1 bg-border/50" />
          <span className="text-[10px] text-muted">{insights.filter((i) => i.type === "warning").length} alerts</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sortedInsights.map((ins, i) => (<InsightCard key={i} insight={ins} index={i} />))}
        </div>
      </section>

      {/* KPI Cards */}
      <section>
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Pipeline Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatCard label="Total Deals" value={kpis.total} icon={Target} color="text-blue-500" delta={deltas.totalDeals} />
          <StatCard label="Pipeline Value" value={rupee(kpis.pipelineValue)} icon={IndianRupee} color="text-green-500" delta={deltas.pipelineValue} />
          <StatCard label="Open" value={kpis.openCount} icon={Clock} color="text-amber-500" sub={`${rupee(filteredOpportunities.filter((o) => o.status === "open").reduce((s, o) => s + (o.monetaryValue || 0), 0))}`} delta={deltas.openCount} />
          <StatCard label="Won" value={kpis.wonCount} icon={CheckCircle} color="text-emerald-500" sub={rupee(kpis.wonValue)} delta={deltas.wonCount} />
          <StatCard label="Lost" value={kpis.lostCount} icon={XCircle} color="text-red-500" sub={rupee(kpis.lostValue)} delta={deltas.lostCount} />
          <StatCard label="Win Rate" value={`${kpis.winRate.toFixed(1)}%`} icon={TrendingUp} color={kpis.winRate >= 40 ? "text-green-500" : kpis.winRate >= 20 ? "text-amber-500" : "text-red-500"} delta={deltas.winRate} />
          <StatCard label="Avg Deal Size" value={kpis.avgDealSize > 0 ? rupee(kpis.avgDealSize) : "—"} icon={BarChart3} color="text-purple-500" delta={deltas.avgDealSize} />
          <StatCard label="Show-up Rate" value={kpis.showUpRate > 0 ? `${kpis.showUpRate.toFixed(0)}%` : "—"} icon={Users} color={kpis.showUpRate >= 60 ? "text-green-500" : "text-amber-500"} sub={`${kpis.showedEvents} showed / ${kpis.noShowEvents} no-show`} delta={deltas.showUpRate} />
        </div>
      </section>

      {/* Conversion Funnel */}
      {funnelData.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Pipeline Funnel</h2>
          <div className="card rounded-xl p-4">
            <div className="flex items-end gap-2 overflow-x-auto pb-2">
              {funnelData.map((stage, i) => {
                const maxCount = Math.max(...funnelData.map((s) => s.count));
                const height = maxCount > 0 ? Math.max(20, (stage.count / maxCount) * 160) : 20;
                return (
                  <div key={i} className="flex flex-col items-center min-w-[80px] flex-1">
                    <span className="text-lg font-bold text-foreground mb-1">{stage.count}</span>
                    <div className="w-full rounded-t-lg transition-all" style={{ height: `${height}px`, backgroundColor: COLORS[i % COLORS.length], opacity: 0.8 }} />
                    <span className="text-[10px] text-muted mt-2 text-center leading-tight">{stage.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WidgetCard title="Daily Deal Creation">
          {dailyCreation.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyCreation}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="date" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="total" fill={COLORS[5]} radius={[4, 4, 0, 0]} name="Created" />
                <Bar dataKey="won" fill={COLORS[1]} radius={[4, 4, 0, 0]} name="Won" />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-[250px] flex items-center justify-center text-muted text-sm">No data</div>}
        </WidgetCard>

        <WidgetCard title="Cumulative Deals">
          {cumulativeValue.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={cumulativeValue}>
                <defs>
                  <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS[5]} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={COLORS[5]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="totalDeals" stroke={COLORS[5]} fill="url(#totalGrad)" strokeWidth={2} name="Total Deals" />
                <Area type="monotone" dataKey="wonDeals" stroke={COLORS[1]} fill="none" strokeWidth={2} strokeDasharray="6 3" name="Won Deals" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div className="h-[250px] flex items-center justify-center text-muted text-sm">No data</div>}
        </WidgetCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WidgetCard title="Opportunity Status">
          {statusChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {statusChartData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-[280px] flex items-center justify-center text-muted text-sm">No data</div>}
        </WidgetCard>

        <WidgetCard title="Calendar Events by Status" action={<Link href="/m/sales/ghl/calendar" className="text-[10px] text-accent hover:underline">Calendar →</Link>}>
          {eventStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={eventStatusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="name" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [String(v), "Events"]} />
                <Bar dataKey="count" fill={COLORS[5]} radius={[4, 4, 0, 0]} name="Events" />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-[280px] flex items-center justify-center text-muted text-sm">No data</div>}
        </WidgetCard>
      </div>

      {/* Deal Value Distribution */}
      <WidgetCard title="Deal Value Distribution">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={valueDistribution}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
            <XAxis dataKey="name" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [String(v), "Deals"]} />
            <Bar dataKey="count" fill={COLORS[4]} radius={[4, 4, 0, 0]} name="Deals" />
          </BarChart>
        </ResponsiveContainer>
      </WidgetCard>

      {/* Recent Opportunities */}
      <WidgetCard title="Recent Opportunities" action={<Link href="/m/sales/ghl/opportunities" className="text-[10px] text-accent hover:underline">All opportunities →</Link>}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: "800px" }}>
            <thead>
              <tr className="sticky top-0 bg-surface text-muted border-b border-border">
                <th className="text-left py-2 px-3 font-medium">Contact</th>
                <th className="text-left py-2 px-3 font-medium">Email</th>
                <th className="text-right py-2 px-3 font-medium">Value</th>
                <th className="text-center py-2 px-3 font-medium">Status</th>
                <th className="text-left py-2 px-3 font-medium">Stage</th>
                <th className="text-left py-2 px-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {recentOpportunities.map((o) => (
                <tr key={o.id} className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors">
                  <td className="py-2 px-3 text-foreground font-medium">{o.contact?.name || "—"}</td>
                  <td className="py-2 px-3 text-muted">{o.contact?.email || "—"}</td>
                  <td className="py-2 px-3 text-right text-foreground tabular-nums">{rupee(o.monetaryValue || 0)}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_BADGE[o.status] || "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>
                      {o.status ? o.status.charAt(0).toUpperCase() + o.status.slice(1) : "—"}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-foreground">{stageMap[o.pipelineStageId] || "—"}</td>
                  <td className="py-2 px-3 text-muted">{o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                </tr>
              ))}
              {recentOpportunities.length === 0 && (<tr><td colSpan={6} className="py-8 text-center text-muted text-xs">No opportunities found</td></tr>)}
            </tbody>
          </table>
        </div>
      </WidgetCard>
    </div>
  );
}
