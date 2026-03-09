"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Loader2, FileText, CheckCircle2, AlertTriangle, Search,
  ChevronUp, ChevronDown,
} from "lucide-react";
import DateRangeFilter, { type DateRange } from "@/components/seo/DateRangeFilter";
import { apiFetch } from "@/lib/api-fetch";

/* ── Constants ── */

const TOOLTIP_STYLE = { contentStyle: { background: "#171717", border: "1px solid #262626", borderRadius: 8, color: "#F5F5F5" }, labelStyle: { color: "#F5F5F5" }, itemStyle: { color: "#F5F5F5" } };

const HEALTH_BUCKET_COLORS: Record<string, string> = {
  "Excellent (90-100)": "#22c55e",
  "Good (70-89)": "#06b6d4",
  "Fair (50-69)": "#f59e0b",
  "Poor (<50)": "#ef4444",
};

/* ── Helpers ── */

function num(n: number) { return n.toLocaleString("en-IN"); }
function pct(n: number) { return (n * 100).toFixed(2) + "%"; }
function pos(n: number) { return n.toFixed(1); }

function healthBadge(score: number) {
  if (score >= 80) return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/15 text-green-400">{score}</span>;
  if (score >= 50) return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400">{score}</span>;
  return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-400">{score}</span>;
}

function truncateUrl(url: string): string {
  try {
    const u = new URL(url);
    const segments = u.pathname.split("/").filter(Boolean);
    return segments.length > 0 ? "/" + segments[segments.length - 1] : "/";
  } catch {
    const segments = url.split("/").filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1] : url;
  }
}

/* ── Types ── */

interface PageHealthRow {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  health_score: number;
  issues: string[];
}

type SortKey = "clicks" | "impressions" | "ctr" | "position" | "health_score";

/* ── Components ── */

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div className="card rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-muted">{label}</span>
      </div>
      <p className="text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function WidgetCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`card rounded-xl p-5 ${className}`}>
      <h3 className="text-sm font-medium text-muted mb-4">{title}</h3>
      {children}
    </div>
  );
}

/* ── Page ── */

export default function PageHealthPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pages, setPages] = useState<PageHealthRow[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("health_score");
  const [sortAsc, setSortAsc] = useState(true);
  const rangeRef = useRef<DateRange | null>(null);

  const fetchData = useCallback(async (range: DateRange) => {
    rangeRef.current = range;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/seo/page-health?startDate=${range.startDate}&endDate=${range.endDate}`);
      const json = await res.json();
      setPages(json.pages || json.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDateChange = useCallback((range: DateRange) => {
    fetchData(range);
  }, [fetchData]);

  /* ── Derived ── */

  const stats = useMemo(() => {
    const total = pages.length;
    const healthy = pages.filter((p) => p.health_score >= 80).length;
    const needsAttention = pages.filter((p) => p.health_score < 50).length;
    return { total, healthy, needsAttention };
  }, [pages]);

  const healthDistribution = useMemo(() => {
    const buckets = [
      { name: "Excellent (90-100)", count: 0 },
      { name: "Good (70-89)", count: 0 },
      { name: "Fair (50-69)", count: 0 },
      { name: "Poor (<50)", count: 0 },
    ];
    for (const p of pages) {
      const s = p.health_score;
      if (s >= 90) buckets[0].count++;
      else if (s >= 70) buckets[1].count++;
      else if (s >= 50) buckets[2].count++;
      else buckets[3].count++;
    }
    return buckets;
  }, [pages]);

  const filteredPages = useMemo(() => {
    let rows = [...pages];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((p) => p.url.toLowerCase().includes(q));
    }
    rows.sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortAsc ? av - bv : bv - av;
    });
    return rows;
  }, [pages, search, sortKey, sortAsc]);

  const issueSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of pages) {
      for (const issue of p.issues || []) {
        counts.set(issue, (counts.get(issue) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([issue, count]) => ({ issue, count }));
  }, [pages]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === "health_score"); }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortAsc
      ? <ChevronUp className="w-3 h-3 inline ml-0.5" />
      : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  };

  const ISSUE_COLORS: Record<string, string> = {
    "Low CTR": "text-amber-400",
    "No Clicks": "text-red-400",
    "Poor Position": "text-red-400",
    "High Impressions Low Clicks": "text-amber-400",
    "Declining Position": "text-red-400",
    "Low Impressions": "text-muted",
  };

  function issueColor(issue: string) {
    for (const [key, color] of Object.entries(ISSUE_COLORS)) {
      if (issue.toLowerCase().includes(key.toLowerCase())) return color;
    }
    return "text-muted";
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Page Health</h1>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
        </div>
      </div>

      <DateRangeFilter onChange={handleDateChange} defaultDays={28} />

      {error && <div className="bg-red-500/10 text-red-400 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      )}

      {!loading && pages.length === 0 && !error && (
        <div className="text-center py-20 text-muted">No page health data available for this period.</div>
      )}

      {!loading && pages.length > 0 && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Total Pages" value={num(stats.total)} icon={FileText} color="text-accent" />
            <StatCard label="Healthy (Score 80+)" value={num(stats.healthy)} icon={CheckCircle2} color="text-green-400" />
            <StatCard label="Needs Attention (<50)" value={num(stats.needsAttention)} icon={AlertTriangle} color="text-red-400" />
          </div>

          {/* Health Distribution + Issue Summary side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <WidgetCard title="Health Score Distribution">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={healthDistribution}>
                  <XAxis dataKey="name" tick={{ fill: "#a3a3a3", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#a3a3a3", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {healthDistribution.map((entry, i) => (
                      <Cell key={i} fill={HEALTH_BUCKET_COLORS[entry.name]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </WidgetCard>

            <WidgetCard title="Issue Summary">
              {issueSummary.length === 0 ? (
                <p className="text-sm text-muted text-center py-4">No issues detected</p>
              ) : (
                <div className="space-y-2">
                  {issueSummary.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-border/50">
                      <span className={`text-sm font-medium ${issueColor(item.issue)}`}>{item.issue}</span>
                      <span className="text-sm text-muted">{item.count} {item.count === 1 ? "page" : "pages"}</span>
                    </div>
                  ))}
                </div>
              )}
            </WidgetCard>
          </div>

          {/* Pages Table */}
          <WidgetCard title="All Pages">
            {/* Search */}
            <div className="mb-4">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  placeholder="Search by URL..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 bg-[#0D0D0D] border border-border rounded-lg text-sm w-full text-foreground placeholder:text-muted"
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#171717]">
                  <tr className="border-b border-border text-left text-muted">
                    <th className="pb-2 font-medium">Page URL</th>
                    <th className="pb-2 font-medium text-right cursor-pointer select-none" onClick={() => handleSort("clicks")}>
                      Clicks{sortIcon("clicks")}
                    </th>
                    <th className="pb-2 font-medium text-right cursor-pointer select-none" onClick={() => handleSort("impressions")}>
                      Impressions{sortIcon("impressions")}
                    </th>
                    <th className="pb-2 font-medium text-right cursor-pointer select-none" onClick={() => handleSort("ctr")}>
                      CTR{sortIcon("ctr")}
                    </th>
                    <th className="pb-2 font-medium text-right cursor-pointer select-none" onClick={() => handleSort("position")}>
                      Position{sortIcon("position")}
                    </th>
                    <th className="pb-2 font-medium text-center cursor-pointer select-none" onClick={() => handleSort("health_score")}>
                      Health{sortIcon("health_score")}
                    </th>
                    <th className="pb-2 font-medium">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPages.map((p, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-white/5">
                      <td className="py-2 max-w-[200px] truncate text-foreground" title={p.url}>
                        {truncateUrl(p.url)}
                      </td>
                      <td className="py-2 text-right text-foreground">{num(p.clicks)}</td>
                      <td className="py-2 text-right text-muted">{num(p.impressions)}</td>
                      <td className="py-2 text-right text-muted">{pct(p.ctr)}</td>
                      <td className="py-2 text-right text-foreground">{pos(p.position)}</td>
                      <td className="py-2 text-center">{healthBadge(p.health_score)}</td>
                      <td className="py-2 max-w-[250px]">
                        {(p.issues || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {p.issues.map((issue, j) => (
                              <span key={j} className={`text-xs ${issueColor(issue)}`}>
                                {issue}{j < p.issues.length - 1 ? "," : ""}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-green-400">None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredPages.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-muted">No pages found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </WidgetCard>
        </>
      )}
    </div>
  );
}
