"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Loader2, MapPin, Search, ExternalLink, Phone,
  Navigation, Eye, Star,
} from "lucide-react";
import DateRangeFilter, { type DateRange } from "@/components/seo/DateRangeFilter";
import { BusinessSkeleton } from "@/components/Skeleton";
import { apiFetch } from "@/lib/api-fetch";

/* ── Helpers ─────────────────────────────────────── */

const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];
const TOOLTIP_STYLE = { contentStyle: { background: "#1e1e2e", border: "1px solid #333", borderRadius: 8 }, itemStyle: { color: "#e2e8f0" }, labelStyle: { color: "#94a3b8" } };

function num(n: number) { return n.toLocaleString("en-IN"); }

const DATE_PRESETS: { label: string; days: number }[] = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 3 months", days: 90 },
];

const RATING_MAP: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
const RATING_COLORS: Record<number, string> = {
  5: "#22c55e",
  4: "#84cc16",
  3: "#f59e0b",
  2: "#f97316",
  1: "#ef4444",
};

/* ── Types ───────────────────────────────────────── */

interface GBPMetric { date: string; metric: string; value: number }
interface SearchKW { keyword: string; impressions: number }
interface Review {
  reviewId: string; reviewer: string; rating: string;
  comment: string; createTime: string; replyComment?: string; replyTime?: string;
}

/* ── Components ──────────────────────────────────── */

function StatCard({ label, value, icon: Icon, color, prevValue }: { label: string; value: string; icon: React.ElementType; color: string; prevValue?: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-muted">{label}</span>
      </div>
      <p className="text-xl font-semibold">{value}</p>
      {prevValue !== undefined && (
        <p className="text-xs text-muted mt-1">Prev: {prevValue}</p>
      )}
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

function ratingStars(rating: string) {
  const n = RATING_MAP[rating] || 0;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= n ? "text-amber-400 fill-amber-400" : "text-border"}`} />
      ))}
    </div>
  );
}

/* ── Page ────────────────────────────────────────── */

export default function GoogleBusinessPage() {
  const [range, setRange] = useState<DateRange | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [metrics, setMetrics] = useState<GBPMetric[]>([]);
  const [prevMetrics, setPrevMetrics] = useState<GBPMetric[]>([]);
  const [keywords, setKeywords] = useState<SearchKW[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);

  const fetchData = useCallback(async (r: DateRange) => {
    setLoading(true);
    setError("");
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    try {
      const fetches: Promise<Response>[] = [
        apiFetch(`/api/seo/gbp/performance?startDate=${r.startDate}&endDate=${r.endDate}`),
        apiFetch(`/api/seo/gbp/keywords?yearMonth=${yearMonth}`),
        apiFetch(`/api/seo/gbp/reviews?pageSize=20`),
      ];
      if (r.compare) {
        fetches.push(apiFetch(`/api/seo/gbp/performance?startDate=${r.prevStartDate}&endDate=${r.prevEndDate}`));
      }

      const responses = await Promise.all(fetches);
      const [perfData, kwData, revData] = await Promise.all(
        responses.slice(0, 3).map((res) => res.json())
      );
      const prevPerfData = r.compare ? await responses[3].json() : null;

      // Check if APIs are blocked (quota 0 = not approved yet)
      if (perfData.error || kwData.error || revData.error) {
        setError("GBP_PENDING");
      } else {
        setMetrics(perfData.metrics || []);
        setKeywords(kwData.keywords || []);
        setReviews(revData.reviews || []);
        setAvgRating(revData.averageRating || 0);
        setTotalReviews(revData.totalReviewCount || 0);

        if (r.compare && prevPerfData && !prevPerfData.error) {
          setPrevMetrics(prevPerfData.metrics || []);
        } else {
          setPrevMetrics([]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDateChange = useCallback((r: DateRange) => {
    setRange(r);
    fetchData(r);
  }, [fetchData]);

  /* ── Derived: Current Period ────────────────────── */

  const totals = useMemo(() => {
    const m: Record<string, number> = {};
    for (const g of metrics) m[g.metric] = (m[g.metric] || 0) + g.value;
    const searchImps = (m.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH || 0) + (m.BUSINESS_IMPRESSIONS_MOBILE_SEARCH || 0);
    const mapsImps = (m.BUSINESS_IMPRESSIONS_DESKTOP_MAPS || 0) + (m.BUSINESS_IMPRESSIONS_MOBILE_MAPS || 0);
    return {
      totalImpressions: searchImps + mapsImps,
      searchImps,
      mapsImps,
      websiteClicks: m.WEBSITE_CLICKS || 0,
      calls: m.CALL_CLICKS || 0,
      directions: m.BUSINESS_DIRECTION_REQUESTS || 0,
    };
  }, [metrics]);

  /* ── Derived: Previous Period ───────────────────── */

  const prevTotals = useMemo(() => {
    if (prevMetrics.length === 0) return null;
    const m: Record<string, number> = {};
    for (const g of prevMetrics) m[g.metric] = (m[g.metric] || 0) + g.value;
    const searchImps = (m.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH || 0) + (m.BUSINESS_IMPRESSIONS_MOBILE_SEARCH || 0);
    const mapsImps = (m.BUSINESS_IMPRESSIONS_DESKTOP_MAPS || 0) + (m.BUSINESS_IMPRESSIONS_MOBILE_MAPS || 0);
    return {
      totalImpressions: searchImps + mapsImps,
      searchImps,
      mapsImps,
      websiteClicks: m.WEBSITE_CLICKS || 0,
      calls: m.CALL_CLICKS || 0,
      directions: m.BUSINESS_DIRECTION_REQUESTS || 0,
    };
  }, [prevMetrics]);

  const impressionChart = useMemo(() => {
    const byDate: Record<string, Record<string, number>> = {};
    for (const m of metrics) {
      if (!byDate[m.date]) byDate[m.date] = {};
      if (m.metric.includes("DESKTOP_SEARCH")) byDate[m.date].desktopSearch = (byDate[m.date].desktopSearch || 0) + m.value;
      else if (m.metric.includes("MOBILE_SEARCH")) byDate[m.date].mobileSearch = (byDate[m.date].mobileSearch || 0) + m.value;
      else if (m.metric.includes("DESKTOP_MAPS")) byDate[m.date].desktopMaps = (byDate[m.date].desktopMaps || 0) + m.value;
      else if (m.metric.includes("MOBILE_MAPS")) byDate[m.date].mobileMaps = (byDate[m.date].mobileMaps || 0) + m.value;
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, ...d }));
  }, [metrics]);

  const actionsChart = useMemo(() => {
    const byDate: Record<string, Record<string, number>> = {};
    for (const m of metrics) {
      if (!["WEBSITE_CLICKS", "CALL_CLICKS", "BUSINESS_DIRECTION_REQUESTS"].includes(m.metric)) continue;
      if (!byDate[m.date]) byDate[m.date] = {};
      if (m.metric === "WEBSITE_CLICKS") byDate[m.date].websiteClicks = m.value;
      else if (m.metric === "CALL_CLICKS") byDate[m.date].calls = m.value;
      else byDate[m.date].directions = m.value;
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, ...d }));
  }, [metrics]);

  const searchVsMaps = useMemo(() =>
    [
      { name: "Search", value: totals.searchImps },
      { name: "Maps", value: totals.mapsImps },
    ].filter((d) => d.value > 0),
  [totals]);

  const desktopVsMobile = useMemo(() => {
    let desktop = 0, mobile = 0;
    for (const m of metrics) {
      if (m.metric.includes("DESKTOP")) desktop += m.value;
      else if (m.metric.includes("MOBILE")) mobile += m.value;
    }
    return [
      { name: "Desktop", value: desktop },
      { name: "Mobile", value: mobile },
    ].filter((d) => d.value > 0);
  }, [metrics]);

  /* ── Derived: Review Sentiment ──────────────────── */

  const reviewSentiment = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) {
      const n = RATING_MAP[r.rating] || 0;
      if (n >= 1 && n <= 5) counts[n]++;
    }
    const total = reviews.length;
    const responded = reviews.filter((r) => r.replyComment).length;
    const responseRate = total > 0 ? (responded / total) * 100 : 0;
    const avgFromReviews = total > 0
      ? reviews.reduce((sum, r) => sum + (RATING_MAP[r.rating] || 0), 0) / total
      : 0;
    return { counts, total, responded, responseRate, avgFromReviews };
  }, [reviews]);

  /* ── Derived: Top 5 Keywords ────────────────────── */

  const top5Keywords = useMemo(() => {
    return [...keywords].sort((a, b) => b.impressions - a.impressions).slice(0, 5);
  }, [keywords]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Google Business Profile</h1>
            {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
          </div>
          <p className="text-sm text-muted mt-1">Business listing performance and reviews</p>
        </div>
        <DateRangeFilter
          onChange={handleDateChange}
          defaultDays={30}
          showCompare
          presets={DATE_PRESETS}
        />
      </div>

      {error === "GBP_PENDING" ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center space-y-3">
          <MapPin className="w-10 h-10 text-muted mx-auto" />
          <h2 className="text-lg font-semibold">Google Business Profile API Access Pending</h2>
          <p className="text-sm text-muted max-w-lg mx-auto">
            The GBP APIs require special access approval from Google. Your request is pending.
            Once approved, this page will automatically show your business listing performance, reviews, and search keywords.
          </p>
          <a
            href="https://developers.google.com/my-business/content/prereqs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-sm text-accent hover:underline"
          >
            Check API access requirements →
          </a>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 text-red-400 px-4 py-2 rounded-lg text-sm">{error}</div>
      ) : null}

      {error === "GBP_PENDING" ? null : <>
      {loading && <BusinessSkeleton />}
      {!loading && <>
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Impressions" value={num(totals.totalImpressions)} icon={Eye} color="text-blue-400" prevValue={prevTotals ? num(prevTotals.totalImpressions) : undefined} />
        <StatCard label="Maps Views" value={num(totals.mapsImps)} icon={MapPin} color="text-cyan-400" prevValue={prevTotals ? num(prevTotals.mapsImps) : undefined} />
        <StatCard label="Search Views" value={num(totals.searchImps)} icon={Search} color="text-blue-400" prevValue={prevTotals ? num(prevTotals.searchImps) : undefined} />
        <StatCard label="Website Clicks" value={num(totals.websiteClicks)} icon={ExternalLink} color="text-green-400" prevValue={prevTotals ? num(prevTotals.websiteClicks) : undefined} />
        <StatCard label="Phone Calls" value={num(totals.calls)} icon={Phone} color="text-amber-400" prevValue={prevTotals ? num(prevTotals.calls) : undefined} />
        <StatCard label="Directions" value={num(totals.directions)} icon={Navigation} color="text-purple-400" prevValue={prevTotals ? num(prevTotals.directions) : undefined} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WidgetCard title="Impressions Over Time">
          {impressionChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={impressionChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend />
                <Line type="monotone" dataKey="desktopSearch" stroke="#6366f1" strokeWidth={2} dot={false} name="Desktop Search" />
                <Line type="monotone" dataKey="mobileSearch" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Mobile Search" />
                <Line type="monotone" dataKey="desktopMaps" stroke="#06b6d4" strokeWidth={2} dot={false} name="Desktop Maps" />
                <Line type="monotone" dataKey="mobileMaps" stroke="#10b981" strokeWidth={2} dot={false} name="Mobile Maps" />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-muted text-sm text-center py-10">No data available</p>}
        </WidgetCard>

        <WidgetCard title="Actions Over Time">
          {actionsChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={actionsChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend />
                <Line type="monotone" dataKey="websiteClicks" stroke="#10b981" strokeWidth={2} dot={false} name="Website Clicks" />
                <Line type="monotone" dataKey="calls" stroke="#f59e0b" strokeWidth={2} dot={false} name="Phone Calls" />
                <Line type="monotone" dataKey="directions" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Directions" />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-muted text-sm text-center py-10">No data available</p>}
        </WidgetCard>
      </div>

      {/* Pie Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WidgetCard title="Search vs Maps">
          {searchVsMaps.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={searchVsMaps} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => `${e.name} ${num(e.value)}`}>
                  {searchVsMaps.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-muted text-sm text-center py-10">No data</p>}
        </WidgetCard>

        <WidgetCard title="Desktop vs Mobile">
          {desktopVsMobile.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={desktopVsMobile} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => `${e.name} ${num(e.value)}`}>
                  {desktopVsMobile.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-muted text-sm text-center py-10">No data</p>}
        </WidgetCard>
      </div>

      {/* Top 5 Keywords Highlight */}
      {top5Keywords.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted mb-3">Top Keywords</h3>
          <div className="flex flex-wrap gap-2">
            {top5Keywords.map((k, i) => (
              <div
                key={i}
                className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2"
                style={{ borderLeftWidth: 3, borderLeftColor: COLORS[i % COLORS.length] }}
              >
                <span className="text-sm font-medium">{k.keyword}</span>
                <span className="text-xs text-muted bg-surface-hover rounded-full px-2 py-0.5">{num(k.impressions)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keywords Table */}
      <WidgetCard title="Top Search Keywords (This Month)">
        {keywords.length > 0 ? (
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">Keyword</th>
                  <th className="pb-2 font-medium text-right">Monthly Impressions</th>
                </tr>
              </thead>
              <tbody>
                {keywords.map((k, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-surface-hover">
                    <td className="py-2 text-muted">{i + 1}</td>
                    <td className="py-2">{k.keyword}</td>
                    <td className="py-2 text-right">{num(k.impressions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-muted text-sm text-center py-6">No keyword data available</p>}
      </WidgetCard>

      {/* Reviews */}
      <WidgetCard title={`Recent Reviews${totalReviews ? ` (${num(totalReviews)} total, ${avgRating.toFixed(1)} avg)` : ""}`}>
        {/* Review Sentiment Summary */}
        {reviews.length > 0 && (
          <div className="mb-5 space-y-3">
            {/* Stacked horizontal bar */}
            <div className="flex w-full h-8 rounded-lg overflow-hidden">
              {([5, 4, 3, 2, 1] as const).map((star) => {
                const count = reviewSentiment.counts[star];
                if (count === 0) return null;
                const pct = (count / reviewSentiment.total) * 100;
                return (
                  <div
                    key={star}
                    className="flex items-center justify-center text-xs font-medium text-white transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: RATING_COLORS[star],
                      minWidth: count > 0 ? "24px" : 0,
                    }}
                    title={`${star}-star: ${count}`}
                  >
                    {pct >= 8 ? `${star}★ ${count}` : pct >= 4 ? count : ""}
                  </div>
                );
              })}
            </div>

            {/* Summary line */}
            <p className="text-xs text-muted">
              Avg Rating: {(reviewSentiment.avgFromReviews || avgRating).toFixed(1)} | Total: {num(reviewSentiment.total)} | Response Rate: {reviewSentiment.responseRate.toFixed(0)}%
            </p>
          </div>
        )}

        {reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.reviewId} className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">{r.reviewer}</span>
                    {ratingStars(r.rating)}
                  </div>
                  <span className="text-xs text-muted">{new Date(r.createTime).toLocaleDateString()}</span>
                </div>
                {r.comment && <p className="text-sm text-foreground/80 mb-2">{r.comment}</p>}
                {r.replyComment && (
                  <div className="ml-4 pl-4 border-l-2 border-accent/30 mt-2">
                    <p className="text-xs text-muted mb-1">Owner reply {r.replyTime ? `- ${new Date(r.replyTime).toLocaleDateString()}` : ""}</p>
                    <p className="text-sm text-foreground/70">{r.replyComment}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : <p className="text-muted text-sm text-center py-6">No reviews available</p>}
      </WidgetCard>
      </>}
      </>}
    </div>
  );
}
