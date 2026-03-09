"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Loader2, MousePointerClick, Eye, TrendingUp, Hash, Search,
  ArrowUp, ArrowDown, ChevronDown, ChevronUp, Table2, Download,
} from "lucide-react";
import DateRangeFilter, { type DateRange } from "@/components/seo/DateRangeFilter";
import { PerformanceSkeleton } from "@/components/Skeleton";
import { apiFetch } from "@/lib/api-fetch";

/* -- Helpers ------------------------------------------------- */

const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6"];
const TOOLTIP_STYLE = { contentStyle: { background: "#1e1e2e", border: "1px solid #333", borderRadius: 8 }, itemStyle: { color: "#e2e8f0" }, labelStyle: { color: "#94a3b8" } };

function num(n: number) { return n.toLocaleString("en-IN"); }
function pct(n: number) { return (n * 100).toFixed(2) + "%"; }
function pos(n: number) { return n.toFixed(1); }

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* -- Types ---------------------------------------------------- */

interface SARow { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }

interface MergedRow extends SARow {
  clickChange: number;
  posChange: number;
}

type Tab = "queries" | "pages" | "countries" | "devices";
type SortKey = "clicks" | "impressions" | "ctr" | "position" | "clickChange" | "posChange";

/* -- Components ----------------------------------------------- */

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-muted">{label}</span>
      </div>
      <p className="text-xl font-semibold">{value}</p>
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

/* -- Page ----------------------------------------------------- */

export default function SearchPerformancePage() {
  const [tab, setTab] = useState<Tab>("queries");
  const [searchType, setSearchType] = useState("web");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("clicks");
  const [sortAsc, setSortAsc] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDayTable, setShowDayTable] = useState(false);

  const [queryRows, setQueryRows] = useState<SARow[]>([]);
  const [pageRows, setPageRows] = useState<SARow[]>([]);
  const [countryRows, setCountryRows] = useState<SARow[]>([]);
  const [deviceRows, setDeviceRows] = useState<SARow[]>([]);
  const [dailyRows, setDailyRows] = useState<SARow[]>([]);
  const [selectedRow, setSelectedRow] = useState<SARow | null>(null);

  // Comparison data
  const [prevQueryRows, setPrevQueryRows] = useState<SARow[]>([]);
  const [prevPageRows, setPrevPageRows] = useState<SARow[]>([]);
  const [comparing, setComparing] = useState(false);

  const rangeRef = useRef<DateRange | null>(null);

  const fetchData = useCallback(async (range: DateRange) => {
    rangeRef.current = range;
    setLoading(true);
    setError("");
    setComparing(range.compare);
    try {
      const base = `/api/seo/search-analytics?startDate=${range.startDate}&endDate=${range.endDate}&type=${searchType}`;
      const fetches: Promise<Response>[] = [
        apiFetch(`${base}&dimensions=query&rowLimit=500`),
        apiFetch(`${base}&dimensions=page&rowLimit=500`),
        apiFetch(`${base}&dimensions=country&rowLimit=50`),
        apiFetch(`${base}&dimensions=device`),
        apiFetch(`/api/seo/daily?startDate=${range.startDate}&endDate=${range.endDate}`),
      ];

      // If compare mode, also fetch previous period
      if (range.compare) {
        const prevBase = `/api/seo/search-analytics?startDate=${range.prevStartDate}&endDate=${range.prevEndDate}&type=${searchType}`;
        fetches.push(
          apiFetch(`${prevBase}&dimensions=query&rowLimit=500`),
          apiFetch(`${prevBase}&dimensions=page&rowLimit=500`),
        );
      }

      const responses = await Promise.all(fetches);
      const jsons = await Promise.all(responses.map((r) => r.json()));

      setQueryRows(jsons[0].rows || []);
      setPageRows(jsons[1].rows || []);
      setCountryRows(jsons[2].rows || []);
      setDeviceRows(jsons[3].rows || []);
      setDailyRows(jsons[4].rows || []);

      if (range.compare && jsons.length >= 7) {
        setPrevQueryRows(jsons[5].rows || []);
        setPrevPageRows(jsons[6].rows || []);
      } else {
        setPrevQueryRows([]);
        setPrevPageRows([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [searchType]);

  // Re-fetch when searchType changes
  useEffect(() => {
    if (rangeRef.current) fetchData(rangeRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchType]);

  const handleDateChange = useCallback((range: DateRange) => {
    fetchData(range);
  }, [fetchData]);

  /* -- Merge with comparison data ----------------------------- */

  const mergedQueryRows = useMemo((): MergedRow[] => {
    if (!comparing || prevQueryRows.length === 0) {
      return queryRows.map((r) => ({ ...r, clickChange: 0, posChange: 0 }));
    }
    const prevMap = new Map<string, SARow>(prevQueryRows.map((r) => [r.keys[0], r]));
    return queryRows.map((r) => {
      const p = prevMap.get(r.keys[0]);
      return {
        ...r,
        clickChange: r.clicks - (p?.clicks || 0),
        posChange: (p?.position || r.position) - r.position, // positive = improved
      };
    });
  }, [queryRows, prevQueryRows, comparing]);

  const mergedPageRows = useMemo((): MergedRow[] => {
    if (!comparing || prevPageRows.length === 0) {
      return pageRows.map((r) => ({ ...r, clickChange: 0, posChange: 0 }));
    }
    const prevMap = new Map<string, SARow>(prevPageRows.map((r) => [r.keys[0], r]));
    return pageRows.map((r) => {
      const p = prevMap.get(r.keys[0]);
      return {
        ...r,
        clickChange: r.clicks - (p?.clicks || 0),
        posChange: (p?.position || r.position) - r.position,
      };
    });
  }, [pageRows, prevPageRows, comparing]);

  /* -- Derived ------------------------------------------------ */

  const totals = useMemo(() => {
    let clicks = 0, impressions = 0, ctrSum = 0, posSum = 0;
    for (const r of dailyRows) { clicks += r.clicks; impressions += r.impressions; ctrSum += r.ctr; posSum += r.position; }
    const c = dailyRows.length || 1;
    return { clicks, impressions, avgCtr: ctrSum / c, avgPos: posSum / c };
  }, [dailyRows]);

  const activeRows = useMemo(() => {
    if (tab === "queries" || tab === "pages") {
      const source: MergedRow[] = tab === "queries" ? mergedQueryRows : mergedPageRows;
      let rows = source;
      if (search) {
        const q = search.toLowerCase();
        rows = rows.filter((r) => r.keys[0]?.toLowerCase().includes(q));
      }
      rows = [...rows].sort((a, b) => {
        const av = a[sortKey as keyof MergedRow] as number;
        const bv = b[sortKey as keyof MergedRow] as number;
        return sortAsc ? av - bv : bv - av;
      });
      return rows;
    }
    const map: Record<string, SARow[]> = { countries: countryRows, devices: deviceRows };
    let rows = map[tab] || [];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.keys[0]?.toLowerCase().includes(q));
    }
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey as keyof SARow] as number;
      const bv = b[sortKey as keyof SARow] as number;
      return sortAsc ? (av ?? 0) - (bv ?? 0) : (bv ?? 0) - (av ?? 0);
    });
    return rows;
  }, [tab, mergedQueryRows, mergedPageRows, countryRows, deviceRows, search, sortKey, sortAsc]);

  const dailyChart = useMemo(() =>
    [...dailyRows].sort((a, b) => a.keys[0].localeCompare(b.keys[0])).map((r) => ({
      date: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position,
    })),
  [dailyRows]);

  const devicePie = useMemo(() =>
    deviceRows.map((r) => ({ name: r.keys[0], value: r.clicks })).filter((d) => d.value > 0),
  [deviceRows]);

  /* -- Top Movers --------------------------------------------- */

  const topGains = useMemo(() => {
    const source = tab === "pages" ? mergedPageRows : mergedQueryRows;
    return [...source]
      .filter((r) => r.posChange > 0)
      .sort((a, b) => b.posChange - a.posChange)
      .slice(0, 5);
  }, [mergedQueryRows, mergedPageRows, tab]);

  const topDrops = useMemo(() => {
    const source = tab === "pages" ? mergedPageRows : mergedQueryRows;
    return [...source]
      .filter((r) => r.posChange < 0)
      .sort((a, b) => a.posChange - b.posChange)
      .slice(0, 5);
  }, [mergedQueryRows, mergedPageRows, tab]);

  /* -- Sort helpers ------------------------------------------- */

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sortIcon = (key: SortKey) => sortKey === key ? (sortAsc ? " \u2191" : " \u2193") : "";

  const TABS: { key: Tab; label: string }[] = [
    { key: "queries", label: "Queries" },
    { key: "pages", label: "Pages" },
    { key: "countries", label: "Countries" },
    { key: "devices", label: "Devices" },
  ];

  const isMergedTab = tab === "queries" || tab === "pages";

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Search Performance</h1>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const headers = tab === "queries" || tab === "pages"
                ? ["Name", "Clicks", "Impressions", "CTR", "Position", ...(comparing ? ["Click Change", "Position Change"] : [])]
                : ["Name", "Clicks", "Impressions", "CTR", "Position"];
              const rows = (activeRows as (MergedRow | SARow)[]).map((r) => {
                const base = [r.keys[0], String(r.clicks), String(r.impressions), pct(r.ctr), pos(r.position)];
                if (comparing && "clickChange" in r) base.push(String(r.clickChange), pos(r.posChange));
                return base;
              });
              downloadCSV(`seo-performance-${tab}.csv`, headers, rows);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-accent/10 text-accent border border-accent/20 rounded-lg text-sm hover:bg-accent/20 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <select value={searchType} onChange={(e) => setSearchType(e.target.value)} className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm">
          <option value="web">Web</option>
          <option value="image">Image</option>
          <option value="video">Video</option>
        </select>
        </div>
      </div>

      {/* Date Range Filter */}
      <DateRangeFilter onChange={handleDateChange} defaultDays={28} showCompare showGranularity />

      {error && <div className="bg-red-500/10 text-red-400 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {loading && <PerformanceSkeleton />}

      {!loading && <>
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Clicks" value={num(totals.clicks)} icon={MousePointerClick} color="text-blue-400" />
        <StatCard label="Impressions" value={num(totals.impressions)} icon={Eye} color="text-purple-400" />
        <StatCard label="Avg CTR" value={pct(totals.avgCtr)} icon={TrendingUp} color="text-green-400" />
        <StatCard label="Avg Position" value={pos(totals.avgPos)} icon={Hash} color="text-amber-400" />
      </div>

      {/* Trend Chart */}
      <WidgetCard title="Daily Trend">
        <ResponsiveContainer width="100%" height={220}>
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

        {/* Day-wise Data Toggle */}
        <div className="mt-4">
          <button
            onClick={() => setShowDayTable(!showDayTable)}
            className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-muted hover:text-foreground transition-colors"
          >
            <Table2 className="w-4 h-4" />
            {showDayTable ? "Hide" : "Show"} Day-wise Data
            {showDayTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showDayTable && (
            <div className="mt-3 max-h-[400px] overflow-y-auto border border-border rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-left text-muted">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium text-right">Clicks</th>
                    <th className="px-3 py-2 font-medium text-right">Impressions</th>
                    <th className="px-3 py-2 font-medium text-right">CTR</th>
                    <th className="px-3 py-2 font-medium text-right">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyChart.map((r, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-surface-hover">
                      <td className="px-3 py-2">{r.date}</td>
                      <td className="px-3 py-2 text-right">{num(r.clicks)}</td>
                      <td className="px-3 py-2 text-right">{num(r.impressions)}</td>
                      <td className="px-3 py-2 text-right">{pct(r.ctr)}</td>
                      <td className="px-3 py-2 text-right">{pos(r.position)}</td>
                    </tr>
                  ))}
                  {dailyChart.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-muted">No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </WidgetCard>

      {/* Tabs + Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearch(""); setSelectedRow(null); }}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                tab === t.key ? "bg-accent text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {(tab === "queries" || tab === "pages") && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder={`Search ${tab}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-surface border border-border rounded-lg text-sm w-64"
            />
          </div>
        )}
      </div>

      {/* Tab Content */}
      {tab === "devices" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WidgetCard title="Device Distribution (Clicks)">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={devicePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(e) => `${e.name} ${num(e.value)}`}>
                  {devicePie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </WidgetCard>
          <WidgetCard title="Device Breakdown">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-2 font-medium">Device</th>
                  <th className="pb-2 font-medium text-right">Clicks</th>
                  <th className="pb-2 font-medium text-right">Impressions</th>
                  <th className="pb-2 font-medium text-right">CTR</th>
                  <th className="pb-2 font-medium text-right">Position</th>
                </tr>
              </thead>
              <tbody>
                {deviceRows.map((r, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 capitalize">{r.keys[0]}</td>
                    <td className="py-2 text-right">{num(r.clicks)}</td>
                    <td className="py-2 text-right">{num(r.impressions)}</td>
                    <td className="py-2 text-right">{pct(r.ctr)}</td>
                    <td className="py-2 text-right">{pos(r.position)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </WidgetCard>
        </div>
      ) : tab === "countries" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WidgetCard title="Top Countries by Clicks">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={(activeRows as SARow[]).slice(0, 15)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis dataKey={(r: SARow) => r.keys[0]} type="category" width={60} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="clicks" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </WidgetCard>
          <WidgetCard title="All Countries">
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-left text-muted">
                    <th className="pb-2 font-medium">Country</th>
                    <th className="pb-2 font-medium text-right">Clicks</th>
                    <th className="pb-2 font-medium text-right">Impressions</th>
                    <th className="pb-2 font-medium text-right">CTR</th>
                    <th className="pb-2 font-medium text-right">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeRows as SARow[]).map((r, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 uppercase">{r.keys[0]}</td>
                      <td className="py-2 text-right">{num(r.clicks)}</td>
                      <td className="py-2 text-right">{num(r.impressions)}</td>
                      <td className="py-2 text-right">{pct(r.ctr)}</td>
                      <td className="py-2 text-right">{pos(r.position)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </WidgetCard>
        </div>
      ) : (
        /* Queries / Pages table */
        <WidgetCard title={tab === "queries" ? "Search Queries" : "Pages"}>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-2 font-medium">{tab === "queries" ? "Query" : "Page"}</th>
                  <th className="pb-2 font-medium text-right cursor-pointer select-none" onClick={() => handleSort("clicks")}>Clicks{sortIcon("clicks")}</th>
                  {comparing && (
                    <th className="pb-2 font-medium text-right cursor-pointer select-none" onClick={() => handleSort("clickChange")}>Clicks &Delta;{sortIcon("clickChange")}</th>
                  )}
                  <th className="pb-2 font-medium text-right cursor-pointer select-none" onClick={() => handleSort("impressions")}>Impressions{sortIcon("impressions")}</th>
                  <th className="pb-2 font-medium text-right cursor-pointer select-none" onClick={() => handleSort("ctr")}>CTR{sortIcon("ctr")}</th>
                  <th className="pb-2 font-medium text-right cursor-pointer select-none" onClick={() => handleSort("position")}>Position{sortIcon("position")}</th>
                  {comparing && (
                    <th className="pb-2 font-medium text-right cursor-pointer select-none" onClick={() => handleSort("posChange")}>Position &Delta;{sortIcon("posChange")}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {(activeRows as MergedRow[]).map((r, i) => {
                  const label = tab === "pages" ? (r.keys[0].replace(/^https?:\/\/[^/]+/, "") || "/") : r.keys[0];
                  return (
                    <tr
                      key={i}
                      className={`border-b border-border/50 cursor-pointer transition-colors ${
                        selectedRow === r ? "bg-accent/10" : "hover:bg-surface-hover"
                      }`}
                      onClick={() => setSelectedRow(selectedRow === r ? null : r)}
                    >
                      <td className="py-2 max-w-[400px] truncate" title={r.keys[0]}>{label}</td>
                      <td className="py-2 text-right">{num(r.clicks)}</td>
                      {comparing && (
                        <td className="py-2 text-right">
                          {r.clickChange > 0 ? (
                            <span className="text-green-400">+{num(r.clickChange)}</span>
                          ) : r.clickChange < 0 ? (
                            <span className="text-red-400">{num(r.clickChange)}</span>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                      )}
                      <td className="py-2 text-right">{num(r.impressions)}</td>
                      <td className="py-2 text-right">{pct(r.ctr)}</td>
                      <td className="py-2 text-right">{pos(r.position)}</td>
                      {comparing && (
                        <td className="py-2 text-right">
                          {r.posChange > 0 ? (
                            <span className="text-green-400 flex items-center justify-end gap-0.5"><ArrowUp className="w-3 h-3" />{pos(r.posChange)}</span>
                          ) : r.posChange < 0 ? (
                            <span className="text-red-400 flex items-center justify-end gap-0.5"><ArrowDown className="w-3 h-3" />{pos(Math.abs(r.posChange))}</span>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {activeRows.length === 0 && (
                  <tr><td colSpan={comparing ? 7 : 5} className="py-8 text-center text-muted">No data</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {selectedRow && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted mb-2">
                Selected: <span className="text-foreground font-medium">{selectedRow.keys[0]}</span>
              </p>
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center"><p className="text-xs text-muted">Clicks</p><p className="font-semibold">{num(selectedRow.clicks)}</p></div>
                <div className="text-center"><p className="text-xs text-muted">Impressions</p><p className="font-semibold">{num(selectedRow.impressions)}</p></div>
                <div className="text-center"><p className="text-xs text-muted">CTR</p><p className="font-semibold">{pct(selectedRow.ctr)}</p></div>
                <div className="text-center"><p className="text-xs text-muted">Position</p><p className="font-semibold">{pos(selectedRow.position)}</p></div>
              </div>
            </div>
          )}
        </WidgetCard>
      )}

      {/* Top Movers (only when comparing and on queries/pages tab) */}
      {comparing && isMergedTab && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WidgetCard title="Biggest Gains">
            {topGains.length === 0 ? (
              <p className="text-sm text-muted text-center py-4">No position gains in this period</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="pb-2 font-medium">{tab === "queries" ? "Query" : "Page"}</th>
                    <th className="pb-2 font-medium text-right">Position Change</th>
                    <th className="pb-2 font-medium text-right">Current Position</th>
                    <th className="pb-2 font-medium text-right">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {topGains.map((r, i) => {
                    const label = tab === "pages" ? (r.keys[0].replace(/^https?:\/\/[^/]+/, "") || "/") : r.keys[0];
                    return (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 max-w-[250px] truncate" title={r.keys[0]}>{label}</td>
                        <td className="py-2 text-right">
                          <span className="text-green-400 flex items-center justify-end gap-0.5"><ArrowUp className="w-3 h-3" />{pos(r.posChange)}</span>
                        </td>
                        <td className="py-2 text-right">{pos(r.position)}</td>
                        <td className="py-2 text-right">{num(r.clicks)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </WidgetCard>

          <WidgetCard title="Biggest Drops">
            {topDrops.length === 0 ? (
              <p className="text-sm text-muted text-center py-4">No position drops in this period</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="pb-2 font-medium">{tab === "queries" ? "Query" : "Page"}</th>
                    <th className="pb-2 font-medium text-right">Position Change</th>
                    <th className="pb-2 font-medium text-right">Current Position</th>
                    <th className="pb-2 font-medium text-right">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {topDrops.map((r, i) => {
                    const label = tab === "pages" ? (r.keys[0].replace(/^https?:\/\/[^/]+/, "") || "/") : r.keys[0];
                    return (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 max-w-[250px] truncate" title={r.keys[0]}>{label}</td>
                        <td className="py-2 text-right">
                          <span className="text-red-400 flex items-center justify-end gap-0.5"><ArrowDown className="w-3 h-3" />{pos(Math.abs(r.posChange))}</span>
                        </td>
                        <td className="py-2 text-right">{pos(r.position)}</td>
                        <td className="py-2 text-right">{num(r.clicks)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </WidgetCard>
        </div>
      )}
      </>}
    </div>
  );
}
