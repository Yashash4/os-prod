"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import {
  MousePointer,
  Eye,
  Percent,
  Hash,
  Loader2,
  Search,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Activity,
  ArrowRight,
  Zap,
  Globe,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

/* -- Constants ------------------------------------------------ */

const DATE_PRESETS = [
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 28 Days", value: "28d" },
  { label: "Last 3 Months", value: "3m" },
  { label: "Last 6 Months", value: "6m" },
];

const COLORS = ["#B8860B", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const TOOLTIP_STYLE = {
  background: "#171717",
  border: "1px solid #262626",
  borderRadius: "8px",
  color: "#F5F5F5",
};

/* -- Types ---------------------------------------------------- */

interface SARow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface Insight {
  type: "warning" | "success" | "info";
  title: string;
  detail: string;
  link?: string;
  linkLabel?: string;
}

/* -- Reusable Components -------------------------------------- */

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

/* -- Helpers -------------------------------------------------- */

function getDateRange(preset: string) {
  const end = new Date();
  end.setDate(end.getDate() - 2);
  const start = new Date(end);
  switch (preset) {
    case "7d": start.setDate(start.getDate() - 7); break;
    case "28d": start.setDate(start.getDate() - 28); break;
    case "3m": start.setMonth(start.getMonth() - 3); break;
    case "6m": start.setMonth(start.getMonth() - 6); break;
  }
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

function num(n: number) { return n.toLocaleString("en-IN"); }
function compact(n: number) { return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : n.toFixed(0); }
function pctFmt(n: number) { return (n * 100).toFixed(2) + "%"; }
function pos(n: number) { return n.toFixed(1); }

/* -- Page ----------------------------------------------------- */

export default function SEOAnalyticsPage() {
  const [dailyRows, setDailyRows] = useState<SARow[]>([]);
  const [queryRows, setQueryRows] = useState<SARow[]>([]);
  const [pageRows, setPageRows] = useState<SARow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [datePreset, setDatePreset] = useState("28d");

  useEffect(() => {
    const controller = new AbortController();

    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const { startDate, endDate } = getDateRange(datePreset);
        const [dailyRes, queryRes, pageRes] = await Promise.all([
          apiFetch(`/api/seo/daily?startDate=${startDate}&endDate=${endDate}`, { signal: controller.signal }),
          apiFetch(`/api/seo/search-analytics?dimensions=query&rowLimit=20&startDate=${startDate}&endDate=${endDate}`, { signal: controller.signal }),
          apiFetch(`/api/seo/search-analytics?dimensions=page&rowLimit=20&startDate=${startDate}&endDate=${endDate}`, { signal: controller.signal }),
        ]);
        const [dailyData, queryData, pageData] = await Promise.all([dailyRes.json(), queryRes.json(), pageRes.json()]);
        if (!dailyRes.ok) throw new Error(dailyData.error || "Failed to load daily data");
        setDailyRows(dailyData.rows || []);
        setQueryRows(queryData.rows || []);
        setPageRows(pageData.rows || []);
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

  /* -- Derived data ------------------------------------------- */

  const totals = useMemo(() => {
    let clicks = 0, impressions = 0, ctrSum = 0, posSum = 0;
    for (const r of dailyRows) { clicks += r.clicks; impressions += r.impressions; ctrSum += r.ctr; posSum += r.position; }
    const c = dailyRows.length || 1;
    return { clicks, impressions, avgCtr: ctrSum / c, avgPos: posSum / c };
  }, [dailyRows]);

  const dailyChart = useMemo(
    () => [...dailyRows].sort((a, b) => a.keys[0].localeCompare(b.keys[0])).map((r) => ({
      date: r.keys[0].slice(5), rawDate: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position,
    })),
    [dailyRows]
  );

  /* -- Period comparison (first vs second half) -- */
  const periodDelta = useMemo(() => {
    const mid = Math.floor(dailyChart.length / 2);
    if (mid === 0) return { clicksDelta: 0, impressionsDelta: 0, ctrDelta: 0, posDelta: 0 };
    const first = dailyChart.slice(0, mid);
    const second = dailyChart.slice(mid);
    const avg = (arr: typeof dailyChart, key: "clicks" | "impressions" | "ctr" | "position") =>
      arr.reduce((s, r) => s + r[key], 0) / arr.length;
    const delta = (key: "clicks" | "impressions" | "ctr" | "position") => {
      const f = avg(first, key); const s = avg(second, key);
      return f > 0 ? ((s - f) / f) * 100 : 0;
    };
    return { clicksDelta: delta("clicks"), impressionsDelta: delta("impressions"), ctrDelta: delta("ctr"), posDelta: -delta("position") };
  }, [dailyChart]);

  /* -- 7-day rolling averages -- */
  const rollingData = useMemo(() => {
    return dailyChart.map((_, i, arr) => {
      const start = Math.max(0, i - 6);
      const slice = arr.slice(start, i + 1);
      const n = slice.length;
      const avgClicks = slice.reduce((s, r) => s + r.clicks, 0) / n;
      const avgCtr = slice.reduce((s, r) => s + r.ctr, 0) / n;
      const avgPos = slice.reduce((s, r) => s + r.position, 0) / n;
      return { date: arr[i].date, avgClicks: +avgClicks.toFixed(1), avgCtr: +(avgCtr * 100).toFixed(2), avgPos: +avgPos.toFixed(1) };
    });
  }, [dailyChart]);

  /* -- Cumulative clicks -- */
  const cumulativeData = useMemo(() => {
    let cumClicks = 0, cumImpressions = 0;
    return dailyChart.map((d) => {
      cumClicks += d.clicks;
      cumImpressions += d.impressions;
      return { date: d.date, clicks: cumClicks, impressions: cumImpressions };
    });
  }, [dailyChart]);

  /* -- Query opportunity analysis -- */
  const queryOpportunities = useMemo(() => {
    return queryRows
      .filter((q) => q.impressions > 100 && q.position > 3 && q.position <= 20)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10)
      .map((q) => ({
        query: q.keys[0],
        clicks: q.clicks,
        impressions: q.impressions,
        ctr: q.ctr,
        position: q.position,
        potential: Math.round(q.impressions * 0.1), // if we got to position 1-3
      }));
  }, [queryRows]);

  /* -- Page performance scoring -- */
  const pageHealth = useMemo(() => {
    return pageRows.map((p) => {
      const ctrPct = p.ctr * 100;
      let score = 0;
      if (ctrPct >= 5) score += 30; else if (ctrPct >= 2) score += 20; else if (ctrPct > 0) score += 5;
      if (p.position <= 3) score += 35; else if (p.position <= 10) score += 20; else if (p.position <= 20) score += 10;
      if (p.clicks >= 50) score += 35; else if (p.clicks >= 10) score += 20; else if (p.clicks > 0) score += 5;
      const health = score >= 70 ? "excellent" : score >= 45 ? "good" : score >= 20 ? "average" : "poor";
      return { url: p.keys[0], clicks: p.clicks, impressions: p.impressions, ctr: ctrPct, position: p.position, score, health };
    }).sort((a, b) => b.score - a.score);
  }, [pageRows]);

  /* -- Insights -- */
  const insights = useMemo(() => {
    const items: Insight[] = [];

    // CTR health
    const avgCtrPct = totals.avgCtr * 100;
    if (avgCtrPct < 1 && totals.impressions > 1000) {
      items.push({ type: "warning", title: `Low Avg CTR: ${avgCtrPct.toFixed(2)}%`, detail: "Below 1% — meta titles and descriptions may need improvement. Focus on high-impression low-CTR queries.", link: "/m/marketing/seo/keywords", linkLabel: "View keywords" });
    } else if (avgCtrPct >= 3) {
      items.push({ type: "success", title: `Strong CTR: ${avgCtrPct.toFixed(2)}%`, detail: "Above 3% average — titles and descriptions are engaging well." });
    }

    // Position trend
    if (periodDelta.posDelta > 10) {
      items.push({ type: "success", title: "Rankings Improving", detail: `Average position improved ${periodDelta.posDelta.toFixed(0)}% in recent period. Content and backlink efforts are paying off.` });
    } else if (periodDelta.posDelta < -10) {
      items.push({ type: "warning", title: "Rankings Declining", detail: `Average position dropped ${Math.abs(periodDelta.posDelta).toFixed(0)}% recently. Check for algorithm updates or lost backlinks.`, link: "/m/marketing/seo/performance", linkLabel: "Check performance" });
    }

    // Click trend
    if (periodDelta.clicksDelta > 15) {
      items.push({ type: "success", title: "Clicks Growing", detail: `Clicks up ${periodDelta.clicksDelta.toFixed(0)}% vs previous period. Organic traffic momentum is building.` });
    } else if (periodDelta.clicksDelta < -15) {
      items.push({ type: "warning", title: "Clicks Declining", detail: `Clicks down ${Math.abs(periodDelta.clicksDelta).toFixed(0)}% vs previous period. Review content freshness and technical SEO.`, link: "/m/marketing/seo/indexing", linkLabel: "Check indexing" });
    }

    // Quick-win opportunities
    const quickWins = queryOpportunities.filter((q) => q.position >= 4 && q.position <= 10);
    if (quickWins.length > 0) {
      items.push({ type: "info", title: `${quickWins.length} Quick-Win Keywords`, detail: `${quickWins.map((q) => `"${q.query}"`).slice(0, 3).join(", ")} — ranking 4-10. Small optimization could push to top 3 for ${compact(quickWins.reduce((s, q) => s + q.potential, 0))} more clicks.` });
    }

    // Striking distance keywords
    const strikingDist = queryOpportunities.filter((q) => q.position > 10 && q.position <= 20);
    if (strikingDist.length > 0) {
      items.push({ type: "info", title: `${strikingDist.length} Striking-Distance Keywords`, detail: `Keywords ranking 11-20 with high impressions. Create targeted content to push them to page 1.` });
    }

    // Poor pages
    const poorPages = pageHealth.filter((p) => p.health === "poor" && p.impressions > 100);
    if (poorPages.length > 0) {
      items.push({ type: "warning", title: `${poorPages.length} Underperforming Pages`, detail: `High impressions but low clicks — needs better titles, descriptions, or content quality.`, link: "/m/marketing/seo/performance", linkLabel: "View pages" });
    }

    if (items.length === 0) {
      items.push({ type: "success", title: "SEO Health Good", detail: "No major issues detected. Continue monitoring and building content." });
    }

    return items;
  }, [totals, periodDelta, queryOpportunities, pageHealth]);

  /* -- Render ------------------------------------------------- */

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <h1 className="text-xl font-bold text-foreground tracking-tight">SEO Analytics</h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  const sortedInsights = [...insights.filter((i) => i.type === "warning"), ...insights.filter((i) => i.type === "info"), ...insights.filter((i) => i.type === "success")];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="h-1 w-10 rounded bg-accent mb-3" />
          <h1 className="text-xl font-bold text-foreground tracking-tight">SEO Analytics</h1>
          <p className="text-muted text-xs mt-0.5">Search Console performance overview (2-day data lag)</p>
        </div>
        <select value={datePreset} onChange={(e) => setDatePreset(e.target.value)} className="px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent">
          {DATE_PRESETS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
        </select>
      </div>

      {error && <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">{error}</div>}

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
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Key Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatCard label="Total Clicks" value={num(totals.clicks)} icon={MousePointer} color="text-green-400" delta={periodDelta.clicksDelta} />
          <StatCard label="Impressions" value={compact(totals.impressions)} icon={Eye} color="text-blue-400" delta={periodDelta.impressionsDelta} />
          <StatCard label="Avg CTR" value={pctFmt(totals.avgCtr)} icon={Percent} color={totals.avgCtr * 100 >= 3 ? "text-green-400" : totals.avgCtr * 100 >= 1 ? "text-amber-400" : "text-red-400"} delta={periodDelta.ctrDelta} />
          <StatCard label="Avg Position" value={pos(totals.avgPos)} icon={Hash} color={totals.avgPos <= 10 ? "text-green-400" : "text-amber-400"} delta={periodDelta.posDelta} sub={periodDelta.posDelta > 0 ? "Improving" : periodDelta.posDelta < 0 ? "Declining" : ""} />
          <StatCard label="Top Queries" value={queryRows.length.toString()} icon={Search} color="text-purple-400" />
          <StatCard label="Pages Tracked" value={pageRows.length.toString()} icon={Globe} color="text-cyan-400" />
          <StatCard label="Click/Impr Ratio" value={totals.impressions > 0 ? `1:${Math.round(totals.impressions / Math.max(1, totals.clicks))}` : "—"} icon={Activity} color="text-amber-400" />
          <StatCard label="Quick Wins" value={queryOpportunities.filter((q) => q.position <= 10).length.toString()} icon={TrendingUp} color="text-green-400" sub="Pos 4-10" />
        </div>
      </section>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WidgetCard title="Clicks & Impressions Over Time">
          {dailyChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dailyChart}>
                <XAxis dataKey="date" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="left" type="monotone" dataKey="clicks" stroke={COLORS[1]} strokeWidth={2} dot={false} name="Clicks" />
                <Line yAxisId="right" type="monotone" dataKey="impressions" stroke={COLORS[5]} strokeWidth={2} dot={false} name="Impressions" />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="h-[250px] flex items-center justify-center text-muted text-sm">No data available</div>}
        </WidgetCard>

        <WidgetCard title="CTR & Position Over Time">
          {dailyChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dailyChart}>
                <XAxis dataKey="date" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(Number(v) * 100).toFixed(1)}%`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} reversed />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => name === "CTR" ? pctFmt(Number(value)) : pos(Number(value))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="left" type="monotone" dataKey="ctr" stroke={COLORS[2]} strokeWidth={2} dot={false} name="CTR" />
                <Line yAxisId="right" type="monotone" dataKey="position" stroke={COLORS[4]} strokeWidth={2} dot={false} name="Position" />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="h-[250px] flex items-center justify-center text-muted text-sm">No data available</div>}
        </WidgetCard>
      </div>

      {/* Rolling Averages + Cumulative */}
      {rollingData.length > 3 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <WidgetCard title="7-Day Rolling: Clicks & CTR">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={rollingData}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#737373" }} interval={Math.max(1, Math.floor(rollingData.length / 10))} axisLine={false} tickLine={false} />
                <YAxis yAxisId="clicks" tick={{ fontSize: 10, fill: "#737373" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="ctr" orientation="right" tick={{ fontSize: 10, fill: "#737373" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Number(v)}%`} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown, n: unknown) => [String(n) === "avgCtr" ? `${Number(v).toFixed(2)}%` : Number(v).toFixed(1), String(n) === "avgCtr" ? "Avg CTR" : "Avg Clicks"]} />
                <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => v === "avgClicks" ? "Avg Clicks" : "Avg CTR %"} />
                <Line yAxisId="clicks" type="monotone" dataKey="avgClicks" stroke={COLORS[1]} strokeWidth={2} dot={false} />
                <Line yAxisId="ctr" type="monotone" dataKey="avgCtr" stroke={COLORS[2]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </WidgetCard>

          <WidgetCard title="Cumulative Clicks & Impressions">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={cumulativeData}>
                <defs>
                  <linearGradient id="clicksGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS[1]} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={COLORS[1]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#737373" }} interval={Math.max(1, Math.floor(cumulativeData.length / 10))} axisLine={false} tickLine={false} />
                <YAxis yAxisId="clicks" tick={{ fontSize: 10, fill: "#737373" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="impr" orientation="right" tick={{ fontSize: 10, fill: "#737373" }} axisLine={false} tickLine={false} tickFormatter={(v) => compact(Number(v))} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown, n: unknown) => [num(Number(v)), String(n) === "clicks" ? "Cum. Clicks" : "Cum. Impressions"]} />
                <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => v === "clicks" ? "Cum. Clicks" : "Cum. Impressions"} />
                <Area yAxisId="clicks" type="monotone" dataKey="clicks" stroke={COLORS[1]} fill="url(#clicksGrad)" strokeWidth={2} />
                <Area yAxisId="impr" type="monotone" dataKey="impressions" stroke={COLORS[5]} fill="none" strokeWidth={1.5} strokeDasharray="6 3" />
              </AreaChart>
            </ResponsiveContainer>
          </WidgetCard>
        </div>
      )}

      {/* Quick-Win Keywords */}
      {queryOpportunities.length > 0 && (
        <WidgetCard title="Quick-Win Keywords (Position 4-20, High Impressions)" action={<span className="text-[10px] text-muted">Est. click potential if top 3</span>}>
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border/50 text-left text-muted">
                  <th className="pb-2 px-2 font-medium">Query</th>
                  <th className="pb-2 px-2 font-medium text-right">Clicks</th>
                  <th className="pb-2 px-2 font-medium text-right">Impressions</th>
                  <th className="pb-2 px-2 font-medium text-right">CTR</th>
                  <th className="pb-2 px-2 font-medium text-right">Position</th>
                  <th className="pb-2 px-2 font-medium text-right">Potential</th>
                </tr>
              </thead>
              <tbody>
                {queryOpportunities.map((q, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors">
                    <td className="py-2 px-2 text-foreground font-medium max-w-[250px] truncate">{q.query}</td>
                    <td className="py-2 px-2 text-right text-foreground tabular-nums">{num(q.clicks)}</td>
                    <td className="py-2 px-2 text-right text-muted tabular-nums">{num(q.impressions)}</td>
                    <td className="py-2 px-2 text-right text-foreground tabular-nums">{(q.ctr * 100).toFixed(2)}%</td>
                    <td className={`py-2 px-2 text-right font-medium tabular-nums ${q.position <= 10 ? "text-amber-500" : "text-muted"}`}>{pos(q.position)}</td>
                    <td className="py-2 px-2 text-right text-green-500 font-medium tabular-nums">+{num(q.potential)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WidgetCard>
      )}

      {/* Top Queries Table */}
      <WidgetCard title="Top Queries">
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border/50 text-left text-muted">
                <th className="pb-2 px-2 font-medium">Query</th>
                <th className="pb-2 px-2 font-medium text-right">Clicks</th>
                <th className="pb-2 px-2 font-medium text-right">Impressions</th>
                <th className="pb-2 px-2 font-medium text-right">CTR (%)</th>
                <th className="pb-2 px-2 font-medium text-right">Position</th>
              </tr>
            </thead>
            <tbody>
              {queryRows.map((r, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors">
                  <td className="py-2 px-2 text-foreground max-w-[300px] truncate" title={r.keys[0]}>{r.keys[0]}</td>
                  <td className="py-2 px-2 text-right text-foreground tabular-nums">{num(r.clicks)}</td>
                  <td className="py-2 px-2 text-right text-muted tabular-nums">{num(r.impressions)}</td>
                  <td className="py-2 px-2 text-right text-foreground tabular-nums">{(r.ctr * 100).toFixed(2)}</td>
                  <td className={`py-2 px-2 text-right tabular-nums ${r.position <= 3 ? "text-green-500 font-medium" : r.position <= 10 ? "text-foreground" : "text-muted"}`}>{pos(r.position)}</td>
                </tr>
              ))}
              {queryRows.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted">No query data</td></tr>}
            </tbody>
          </table>
        </div>
      </WidgetCard>

      {/* Page Health Table */}
      <WidgetCard title="Page Performance">
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border/50 text-left text-muted">
                <th className="pb-2 px-2 font-medium">Page URL</th>
                <th className="pb-2 px-2 font-medium text-center">Health</th>
                <th className="pb-2 px-2 font-medium text-right">Clicks</th>
                <th className="pb-2 px-2 font-medium text-right">Impressions</th>
                <th className="pb-2 px-2 font-medium text-right">CTR</th>
                <th className="pb-2 px-2 font-medium text-right">Position</th>
                <th className="pb-2 px-2 font-medium text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {pageHealth.map((p, i) => {
                const healthColor = { excellent: "bg-green-500/15 text-green-500 border-green-500/30", good: "bg-blue-500/15 text-blue-500 border-blue-500/30", average: "bg-amber-500/15 text-amber-500 border-amber-500/30", poor: "bg-red-500/15 text-red-500 border-red-500/30" }[p.health];
                const url = p.url.length > 55 ? p.url.slice(0, 55) + "..." : p.url;
                return (
                  <tr key={i} className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors">
                    <td className="py-2 px-2 text-foreground max-w-[350px] truncate" title={p.url}>{url}</td>
                    <td className="py-2 px-2 text-center"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${healthColor}`}>{p.health}</span></td>
                    <td className="py-2 px-2 text-right text-foreground tabular-nums">{num(p.clicks)}</td>
                    <td className="py-2 px-2 text-right text-muted tabular-nums">{num(p.impressions)}</td>
                    <td className={`py-2 px-2 text-right tabular-nums ${p.ctr >= 5 ? "text-green-500" : p.ctr >= 2 ? "text-foreground" : "text-red-400"}`}>{p.ctr.toFixed(2)}%</td>
                    <td className={`py-2 px-2 text-right tabular-nums ${p.position <= 3 ? "text-green-500" : p.position <= 10 ? "text-foreground" : "text-muted"}`}>{pos(p.position)}</td>
                    <td className="py-2 px-2 text-right"><span className="text-foreground font-bold">{p.score}</span><span className="text-muted">/100</span></td>
                  </tr>
                );
              })}
              {pageHealth.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted">No page data</td></tr>}
            </tbody>
          </table>
        </div>
      </WidgetCard>
    </div>
  );
}
