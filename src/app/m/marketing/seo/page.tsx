"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  Area, AreaChart,
} from "recharts";
import {
  Loader2, MousePointerClick, Eye, TrendingUp, TrendingDown, Hash,
  FileCheck, MapPin, ExternalLink, Phone, ArrowUp, ArrowDown,
  Lightbulb, AlertTriangle, Target, Zap,
} from "lucide-react";
import DateRangeFilter, { type DateRange, aggregateByGranularity } from "@/components/seo/DateRangeFilter";
import { DashboardSkeleton } from "@/components/Skeleton";
import { apiFetch } from "@/lib/api-fetch";

/* ── Helpers ─────────────────────────────────────── */

const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6"];
const TOOLTIP_STYLE = { contentStyle: { background: "#1e1e2e", border: "1px solid #333", borderRadius: 8 }, itemStyle: { color: "#e2e8f0" }, labelStyle: { color: "#94a3b8" } };

function num(n: number) { return n.toLocaleString("en-IN"); }
function pct(n: number) { return (n * 100).toFixed(2) + "%"; }
function pos(n: number) { return n.toFixed(1); }
function delta(current: number, prev: number) {
  if (prev === 0) return current > 0 ? 100 : 0;
  return ((current - prev) / prev) * 100;
}

/* ── Types ───────────────────────────────────────── */

interface SARow { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }
interface GBPMetric { date: string; metric: string; value: number }

/* ── Components ──────────────────────────────────── */

function TrendStatCard({ label, value, icon: Icon, color, change, invertChange, sparkData }: {
  label: string; value: string; icon: React.ElementType; color: string;
  change?: number; invertChange?: boolean; sparkData?: number[];
}) {
  const isPositive = invertChange ? (change || 0) < 0 : (change || 0) > 0;
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-muted">{label}</span>
      </div>
      <p className="text-xl font-semibold">{value}</p>
      <div className="flex items-center justify-between mt-1">
        {change !== undefined ? (
          <span className={`flex items-center gap-0.5 text-xs ${isPositive ? "text-green-400" : change === 0 ? "text-muted" : "text-red-400"}`}>
            {change > 0 ? <ArrowUp className="w-3 h-3" /> : change < 0 ? <ArrowDown className="w-3 h-3" /> : null}
            {Math.abs(change).toFixed(1)}%
          </span>
        ) : <span />}
        {sparkData && sparkData.length > 1 && (
          <div className="w-16 h-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData.map((v, i) => ({ i, v }))}>
                <defs>
                  <linearGradient id={`spark-${label.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={isPositive ? "#10b981" : "#ef4444"} strokeWidth={1.5} fill={`url(#spark-${label.replace(/\s/g, "")})`} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function WidgetCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface border border-border rounded-xl p-5 ${className}`}>
      <h3 className="text-sm font-medium text-muted mb-4">{title}</h3>
      {children}
    </div>
  );
}

function InsightCard({ icon: Icon, color, title, description }: { icon: React.ElementType; color: string; title: string; description: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex gap-3">
      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted mt-0.5">{description}</p>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────── */

export default function SeoDashboard() {
  const [range, setRange] = useState<DateRange | null>(null);
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("day");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [dailyRows, setDailyRows] = useState<SARow[]>([]);
  const [prevDailyRows, setPrevDailyRows] = useState<SARow[]>([]);
  const [queryRows, setQueryRows] = useState<SARow[]>([]);
  const [prevQueryRows, setPrevQueryRows] = useState<SARow[]>([]);
  const [pageRows, setPageRows] = useState<SARow[]>([]);
  const [gbpMetrics, setGbpMetrics] = useState<GBPMetric[]>([]);

  const fetchData = useCallback(async (r: DateRange) => {
    setLoading(true);
    setError("");
    try {
      const fetches = [
        apiFetch(`/api/seo/daily?startDate=${r.startDate}&endDate=${r.endDate}`),
        apiFetch(`/api/seo/search-analytics?startDate=${r.startDate}&endDate=${r.endDate}&dimensions=query&rowLimit=10`),
        apiFetch(`/api/seo/search-analytics?startDate=${r.startDate}&endDate=${r.endDate}&dimensions=page&rowLimit=10`),
      ];
      if (r.compare) {
        fetches.push(
          apiFetch(`/api/seo/daily?startDate=${r.prevStartDate}&endDate=${r.prevEndDate}`),
          apiFetch(`/api/seo/search-analytics?startDate=${r.prevStartDate}&endDate=${r.prevEndDate}&dimensions=query&rowLimit=10`),
        );
      }

      const responses = await Promise.all(fetches);
      const data = await Promise.all(responses.map((res) => res.json()));

      setDailyRows(data[0].rows || []);
      setQueryRows(data[1].rows || []);
      setPageRows(data[2].rows || []);

      if (r.compare && data.length >= 5) {
        setPrevDailyRows(data[3].rows || []);
        setPrevQueryRows(data[4].rows || []);
      } else {
        setPrevDailyRows([]);
        setPrevQueryRows([]);
      }

      // GBP non-blocking
      try {
        const gbpRes = await apiFetch(`/api/seo/gbp/performance?startDate=${r.startDate}&endDate=${r.endDate}`);
        const gbpData = await gbpRes.json();
        if (!gbpData.error) setGbpMetrics(gbpData.metrics || []);
      } catch { /* GBP unavailable */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDateChange = useCallback((r: DateRange) => {
    setRange(r);
    fetchData(r);
  }, [fetchData]);

  /* ── Derived data ──────────────────────────────── */

  const totals = useMemo(() => {
    let clicks = 0, impressions = 0, ctrSum = 0, posSum = 0;
    for (const r of dailyRows) { clicks += r.clicks; impressions += r.impressions; ctrSum += r.ctr; posSum += r.position; }
    const count = dailyRows.length || 1;
    return { clicks, impressions, avgCtr: ctrSum / count, avgPos: posSum / count };
  }, [dailyRows]);

  const prevTotals = useMemo(() => {
    let clicks = 0, impressions = 0, ctrSum = 0, posSum = 0;
    for (const r of prevDailyRows) { clicks += r.clicks; impressions += r.impressions; ctrSum += r.ctr; posSum += r.position; }
    const count = prevDailyRows.length || 1;
    return { clicks, impressions, avgCtr: ctrSum / count, avgPos: posSum / count };
  }, [prevDailyRows]);

  const sparkClicks = useMemo(() => dailyRows.sort((a, b) => a.keys[0].localeCompare(b.keys[0])).slice(-7).map((r) => r.clicks), [dailyRows]);
  const sparkImpressions = useMemo(() => dailyRows.sort((a, b) => a.keys[0].localeCompare(b.keys[0])).slice(-7).map((r) => r.impressions), [dailyRows]);
  const sparkCtr = useMemo(() => dailyRows.sort((a, b) => a.keys[0].localeCompare(b.keys[0])).slice(-7).map((r) => r.ctr), [dailyRows]);
  const sparkPos = useMemo(() => dailyRows.sort((a, b) => a.keys[0].localeCompare(b.keys[0])).slice(-7).map((r) => r.position), [dailyRows]);

  const dailyChart = useMemo(() => {
    const sorted = [...dailyRows].sort((a, b) => a.keys[0].localeCompare(b.keys[0])).map((r) => ({
      date: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position,
    }));
    return aggregateByGranularity(sorted, granularity, ["clicks", "impressions"] as never[]);
  }, [dailyRows, granularity]);

  const gbpTotals = useMemo(() => {
    const m: Record<string, number> = {};
    for (const g of gbpMetrics) m[g.metric] = (m[g.metric] || 0) + g.value;
    return {
      views: (m.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH || 0) + (m.BUSINESS_IMPRESSIONS_MOBILE_SEARCH || 0) +
             (m.BUSINESS_IMPRESSIONS_DESKTOP_MAPS || 0) + (m.BUSINESS_IMPRESSIONS_MOBILE_MAPS || 0),
      websiteClicks: m.WEBSITE_CLICKS || 0,
      calls: m.CALL_CLICKS || 0,
      searchImpressions: (m.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH || 0) + (m.BUSINESS_IMPRESSIONS_MOBILE_SEARCH || 0),
      mapsImpressions: (m.BUSINESS_IMPRESSIONS_DESKTOP_MAPS || 0) + (m.BUSINESS_IMPRESSIONS_MOBILE_MAPS || 0),
    };
  }, [gbpMetrics]);

  const gbpPie = useMemo(() => [
    { name: "Search", value: gbpTotals.searchImpressions },
    { name: "Maps", value: gbpTotals.mapsImpressions },
  ].filter((d) => d.value > 0), [gbpTotals]);

  /* ── Insights ──────────────────────────────────── */

  const insights = useMemo(() => {
    const items: { icon: React.ElementType; color: string; title: string; description: string }[] = [];

    // Top growing query
    if (queryRows.length > 0 && prevQueryRows.length > 0) {
      const prevMap = new Map(prevQueryRows.map((r) => [r.keys[0], r.clicks]));
      let bestGrowth = { query: "", growth: 0 };
      for (const r of queryRows) {
        const prev = prevMap.get(r.keys[0]) || 0;
        const growth = r.clicks - prev;
        if (growth > bestGrowth.growth) bestGrowth = { query: r.keys[0], growth };
      }
      if (bestGrowth.growth > 0) {
        items.push({
          icon: TrendingUp, color: "bg-green-500/20 text-green-400",
          title: `Top growing query: "${bestGrowth.query}"`,
          description: `+${num(bestGrowth.growth)} clicks compared to previous period`,
        });
      }
    }

    // Biggest position drop
    if (pageRows.length > 0) {
      const worstPage = [...pageRows].sort((a, b) => b.position - a.position)[0];
      if (worstPage && worstPage.position > 20) {
        const path = worstPage.keys[0].replace(/^https?:\/\/[^/]+/, "") || "/";
        items.push({
          icon: AlertTriangle, color: "bg-amber-500/20 text-amber-400",
          title: `"${path}" ranks at position ${pos(worstPage.position)}`,
          description: `This page has ${num(worstPage.impressions)} impressions but low visibility — consider optimizing content`,
        });
      }
    }

    // Keywords in top 10
    if (queryRows.length > 0) {
      const top10 = queryRows.filter((r) => r.position <= 10).length;
      if (top10 > 0) {
        items.push({
          icon: Target, color: "bg-blue-500/20 text-blue-400",
          title: `${top10} keywords in Top 10`,
          description: `Out of ${queryRows.length} tracked queries, ${top10} are ranking on page 1`,
        });
      }
    }

    // Low CTR opportunity
    if (queryRows.length > 0) {
      const lowCtr = queryRows.filter((r) => r.position <= 5 && r.ctr < 0.03 && r.impressions > 50);
      if (lowCtr.length > 0) {
        items.push({
          icon: Zap, color: "bg-purple-500/20 text-purple-400",
          title: `${lowCtr.length} queries with low CTR despite top positions`,
          description: `These rank in top 5 but CTR is below 3% — improve titles & meta descriptions`,
        });
      }
    }

    // High impressions, low clicks
    if (queryRows.length > 0) {
      const highImpLowClick = queryRows.filter((r) => r.impressions > 100 && r.clicks < 5);
      if (highImpLowClick.length > 0) {
        items.push({
          icon: Lightbulb, color: "bg-emerald-500/20 text-emerald-400",
          title: `${highImpLowClick.length} untapped opportunities`,
          description: `Queries with 100+ impressions but fewer than 5 clicks — optimize these pages to capture traffic`,
        });
      }
    }

    return items.slice(0, 4);
  }, [queryRows, prevQueryRows, pageRows]);

  /* ── Render ────────────────────────────────────── */

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">SEO Dashboard</h1>
            <p className="text-sm text-muted mt-1">Google Search Console & Business Profile overview</p>
          </div>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
        </div>
        <DateRangeFilter
          onChange={handleDateChange}
          defaultDays={28}
          showCompare
          showGranularity
          granularity={granularity}
          onGranularityChange={setGranularity}
        />
      </div>

      {error && <div className="bg-red-500/10 text-red-400 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {loading && <DashboardSkeleton />}

      {!loading && <>
      {/* KPI Cards with trends */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <TrendStatCard label="Total Clicks" value={num(totals.clicks)} icon={MousePointerClick} color="text-blue-400"
          change={range?.compare ? delta(totals.clicks, prevTotals.clicks) : undefined} sparkData={sparkClicks} />
        <TrendStatCard label="Impressions" value={num(totals.impressions)} icon={Eye} color="text-purple-400"
          change={range?.compare ? delta(totals.impressions, prevTotals.impressions) : undefined} sparkData={sparkImpressions} />
        <TrendStatCard label="Avg CTR" value={pct(totals.avgCtr)} icon={TrendingUp} color="text-green-400"
          change={range?.compare ? delta(totals.avgCtr, prevTotals.avgCtr) : undefined} sparkData={sparkCtr} />
        <TrendStatCard label="Avg Position" value={pos(totals.avgPos)} icon={Hash} color="text-amber-400"
          change={range?.compare ? delta(totals.avgPos, prevTotals.avgPos) : undefined} invertChange sparkData={sparkPos} />
        <TrendStatCard label="Indexed Pages" value="-" icon={FileCheck} color="text-emerald-400" />
        <TrendStatCard label="GBP Views" value={num(gbpTotals.views)} icon={MapPin} color="text-cyan-400" />
        <TrendStatCard label="Website Clicks" value={num(gbpTotals.websiteClicks)} icon={ExternalLink} color="text-blue-400" />
        <TrendStatCard label="GBP Calls" value={num(gbpTotals.calls)} icon={Phone} color="text-green-400" />
      </div>

      {/* Insight Cards */}
      {insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((ins, i) => (
            <InsightCard key={i} {...ins} />
          ))}
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WidgetCard title="Clicks & Impressions Over Time">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dailyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis yAxisId="left" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#6366f1" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="impressions" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </WidgetCard>

        <WidgetCard title="CTR & Position Trend">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dailyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis yAxisId="left" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <YAxis yAxisId="right" orientation="right" reversed tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v, name) => name === "CTR" ? pct(Number(v)) : pos(Number(v))} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="ctr" stroke="#10b981" strokeWidth={2} dot={false} name="CTR" />
              <Line yAxisId="right" type="monotone" dataKey="position" stroke="#f59e0b" strokeWidth={2} dot={false} name="Avg Position" />
            </LineChart>
          </ResponsiveContainer>
        </WidgetCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <WidgetCard title="Top 10 Queries by Clicks" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={queryRows} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis dataKey={(r: SARow) => r.keys[0]} type="category" width={180} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="clicks" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </WidgetCard>

        <WidgetCard title="GBP: Search vs Maps">
          {gbpPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={gbpPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(e) => `${e.name} ${num(e.value)}`}>
                  {gbpPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted text-sm text-center py-10">No GBP data available</p>
          )}
        </WidgetCard>
      </div>

      {/* Day-wise Breakdown Table */}
      <WidgetCard title="Day-wise Breakdown">
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-muted">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium text-right">Clicks</th>
                <th className="pb-2 font-medium text-right">Impressions</th>
                <th className="pb-2 font-medium text-right">CTR</th>
                <th className="pb-2 font-medium text-right">Position</th>
              </tr>
            </thead>
            <tbody>
              {dailyChart.map((r, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-surface-hover">
                  <td className="py-2 text-xs">{r.date}</td>
                  <td className="py-2 text-right">{num(r.clicks)}</td>
                  <td className="py-2 text-right">{num(r.impressions)}</td>
                  <td className="py-2 text-right">{pct(r.ctr)}</td>
                  <td className="py-2 text-right">{pos(r.position)}</td>
                </tr>
              ))}
              {dailyChart.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-muted">No data available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </WidgetCard>

      {/* Top 10 Pages Table */}
      <WidgetCard title="Top 10 Pages">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="pb-2 font-medium">Page</th>
                <th className="pb-2 font-medium text-right">Clicks</th>
                <th className="pb-2 font-medium text-right">Impressions</th>
                <th className="pb-2 font-medium text-right">CTR</th>
                <th className="pb-2 font-medium text-right">Position</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => {
                const url = r.keys[0];
                const path = url.replace(/^https?:\/\/[^/]+/, "") || "/";
                return (
                  <tr key={i} className="border-b border-border/50 hover:bg-surface-hover">
                    <td className="py-2 max-w-[400px] truncate" title={url}>{path}</td>
                    <td className="py-2 text-right">{num(r.clicks)}</td>
                    <td className="py-2 text-right">{num(r.impressions)}</td>
                    <td className="py-2 text-right">{pct(r.ctr)}</td>
                    <td className="py-2 text-right">{pos(r.position)}</td>
                  </tr>
                );
              })}
              {pageRows.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-muted">No page data available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </WidgetCard>
      </>}
    </div>
  );
}
