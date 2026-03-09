"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Loader2, Hash, TrendingUp, TrendingDown, ArrowUp, ArrowDown, Search,
  ChevronDown, ChevronRight, Sparkles, AlertTriangle, Plus, Minus, Download,
} from "lucide-react";
import DateRangeFilter, { type DateRange } from "@/components/seo/DateRangeFilter";
import { KeywordsSkeleton } from "@/components/Skeleton";
import { apiFetch } from "@/lib/api-fetch";

/* -- Helpers ------------------------------------------------- */

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

const DATE_PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 28 days", days: 28 },
  { label: "Last 3 months", days: 90 },
];

/* -- Types --------------------------------------------------- */

interface SARow { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }
interface KWRow {
  keyword: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  prevClicks: number;
  prevPosition: number;
  clickChange: number;
  posChange: number;
}

type PosFilter = "all" | "top3" | "top10" | "top20" | "11-20" | "21-50" | "50+";
type SortKey = "clicks" | "impressions" | "ctr" | "position" | "posChange" | "clickChange";

/* -- Components ---------------------------------------------- */

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

function MovementCard({ label, count, color, icon: Icon }: { label: string; count: number; color: string; icon: React.ElementType }) {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    green:  { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" },
    red:    { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
    blue:   { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
    amber:  { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-3 flex items-center gap-3`}>
      <Icon className={`w-5 h-5 ${c.text}`} />
      <div>
        <p className={`text-lg font-semibold ${c.text}`}>{num(count)}</p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

function CollapsibleSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-surface border border-border rounded-xl">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-hover rounded-xl transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronRight className="w-4 h-4 text-muted" />}
          <h3 className="text-sm font-medium">{title}</h3>
          <span className="text-xs text-muted bg-surface-hover px-2 py-0.5 rounded-full">{count}</span>
        </div>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

/* -- Page ---------------------------------------------------- */

export default function KeywordsPage() {
  const [range, setRange] = useState<DateRange | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<PosFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("clicks");
  const [sortAsc, setSortAsc] = useState(false);

  const [currentRows, setCurrentRows] = useState<SARow[]>([]);
  const [prevRows, setPrevRows] = useState<SARow[]>([]);

  const handleDateChange = useCallback((r: DateRange) => {
    setRange(r);
    setLoading(true);
    setError("");
    Promise.all([
      apiFetch(`/api/seo/search-analytics?startDate=${r.startDate}&endDate=${r.endDate}&dimensions=query&rowLimit=1000`),
      apiFetch(`/api/seo/search-analytics?startDate=${r.prevStartDate}&endDate=${r.prevEndDate}&dimensions=query&rowLimit=1000`),
    ])
      .then(async ([curRes, prevRes]) => {
        const [curData, prevData] = await Promise.all([curRes.json(), prevRes.json()]);
        setCurrentRows(curData.rows || []);
        setPrevRows(prevData.rows || []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  /* -- Merged data ------------------------------------------- */

  const prevMap = useMemo(() => {
    const m = new Map<string, SARow>();
    for (const r of prevRows) m.set(r.keys[0], r);
    return m;
  }, [prevRows]);

  const currentMap = useMemo(() => {
    const m = new Map<string, SARow>();
    for (const r of currentRows) m.set(r.keys[0], r);
    return m;
  }, [currentRows]);

  const keywords = useMemo(() => {
    return currentRows.map((r): KWRow => {
      const p = prevMap.get(r.keys[0]);
      return {
        keyword: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
        prevClicks: p?.clicks || 0,
        prevPosition: p?.position || 0,
        clickChange: r.clicks - (p?.clicks || 0),
        posChange: (p?.position || r.position) - r.position, // positive = improved
      };
    });
  }, [currentRows, prevMap]);

  const filtered = useMemo(() => {
    let rows = keywords;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.keyword.toLowerCase().includes(q));
    }
    const posFilters: Record<PosFilter, (r: KWRow) => boolean> = {
      all: () => true,
      top3: (r) => r.position <= 3,
      top10: (r) => r.position <= 10,
      top20: (r) => r.position <= 20,
      "11-20": (r) => r.position > 10 && r.position <= 20,
      "21-50": (r) => r.position > 20 && r.position <= 50,
      "50+": (r) => r.position > 50,
    };
    rows = rows.filter(posFilters[posFilter]);
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      return sortAsc ? av - bv : bv - av;
    });
    return rows;
  }, [keywords, search, posFilter, sortKey, sortAsc]);

  /* -- Movement stats ---------------------------------------- */

  const movementStats = useMemo(() => {
    const improved = keywords.filter((r) => r.posChange > 0).length;
    const declined = keywords.filter((r) => r.posChange < 0).length;

    // New keywords: in current but NOT in previous
    const newKws: KWRow[] = [];
    for (const r of currentRows) {
      if (!prevMap.has(r.keys[0])) {
        newKws.push({
          keyword: r.keys[0],
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
          position: r.position,
          prevClicks: 0,
          prevPosition: 0,
          clickChange: r.clicks,
          posChange: 0,
        });
      }
    }
    newKws.sort((a, b) => b.clicks - a.clicks);

    // Lost keywords: in previous but NOT in current
    const lostKws: { keyword: string; position: number; clicks: number; impressions: number; ctr: number }[] = [];
    for (const r of prevRows) {
      if (!currentMap.has(r.keys[0])) {
        lostKws.push({
          keyword: r.keys[0],
          position: r.position,
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
        });
      }
    }
    lostKws.sort((a, b) => b.clicks - a.clicks);

    return { improved, declined, newKws, lostKws };
  }, [keywords, currentRows, prevRows, prevMap, currentMap]);

  /* -- Stats ------------------------------------------------- */

  const stats = useMemo(() => ({
    total: keywords.length,
    top3: keywords.filter((r) => r.position <= 3).length,
    top10: keywords.filter((r) => r.position <= 10).length,
    gains: keywords.filter((r) => r.posChange > 0).length,
  }), [keywords]);

  const posBuckets = useMemo(() => {
    const buckets = [
      { name: "1-3", count: 0 },
      { name: "4-10", count: 0 },
      { name: "11-20", count: 0 },
      { name: "21-50", count: 0 },
      { name: "50+", count: 0 },
    ];
    for (const r of keywords) {
      if (r.position <= 3) buckets[0].count++;
      else if (r.position <= 10) buckets[1].count++;
      else if (r.position <= 20) buckets[2].count++;
      else if (r.position <= 50) buckets[3].count++;
      else buckets[4].count++;
    }
    return buckets;
  }, [keywords]);

  /* -- Quick Wins -------------------------------------------- */

  const quickWins = useMemo(() =>
    keywords
      .filter((r) => r.position >= 4 && r.position <= 10 && r.impressions > 50)
      .map((r) => ({
        ...r,
        estimatedImpact: Math.round(r.impressions * 0.15) - r.clicks,
      }))
      .sort((a, b) => b.estimatedImpact - a.estimatedImpact)
      .slice(0, 10),
  [keywords]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sortIcon = (key: SortKey) => sortKey === key ? (sortAsc ? " \u2191" : " \u2193") : "";

  const POS_PILLS: { key: PosFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "top3", label: "Top 3" },
    { key: "top10", label: "Top 10" },
    { key: "11-20", label: "11-20" },
    { key: "21-50", label: "21-50" },
    { key: "50+", label: "50+" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Keywords</h1>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
        </div>
        <button
          onClick={() => {
            const headers = ["Keyword", "Position", "Change", "Clicks", "Click Change", "Impressions", "CTR"];
            const rows = filtered.map((r) => [
              r.keyword, pos(r.position), pos(r.posChange), String(r.clicks), String(r.clickChange), String(r.impressions), pct(r.ctr),
            ]);
            downloadCSV("seo-keywords.csv", headers, rows);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-accent/10 text-accent border border-accent/20 rounded-lg text-sm hover:bg-accent/20 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <DateRangeFilter
        onChange={handleDateChange}
        defaultDays={28}
        showCompare={false}
        presets={DATE_PRESETS}
      />

      {error && <div className="bg-red-500/10 text-red-400 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {loading && <KeywordsSkeleton />}

      {!loading && <>
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Keywords" value={num(stats.total)} icon={Hash} color="text-blue-400" />
        <StatCard label="Keywords in Top 3" value={num(stats.top3)} icon={TrendingUp} color="text-green-400" />
        <StatCard label="Keywords in Top 10" value={num(stats.top10)} icon={TrendingUp} color="text-emerald-400" />
        <StatCard label="Position Gains" value={num(stats.gains)} icon={ArrowUp} color="text-cyan-400" />
      </div>

      {/* Keyword Movement Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MovementCard label="Improved" count={movementStats.improved} color="green" icon={ArrowUp} />
        <MovementCard label="Declined" count={movementStats.declined} color="red" icon={ArrowDown} />
        <MovementCard label="New" count={movementStats.newKws.length} color="blue" icon={Plus} />
        <MovementCard label="Lost" count={movementStats.lostKws.length} color="amber" icon={Minus} />
      </div>

      {/* Position Distribution */}
      <WidgetCard title="Position Distribution">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={posBuckets}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </WidgetCard>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {POS_PILLS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPosFilter(p.key)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                posFilter === p.key ? "bg-accent text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search keywords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 bg-surface border border-border rounded-lg text-sm w-64"
          />
        </div>
      </div>

      {/* Keywords Table */}
      <WidgetCard title={`Keywords (${num(filtered.length)})`}>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-muted">
                <th className="pb-2 font-medium">Keyword</th>
                <th className="pb-2 font-medium text-right cursor-pointer select-none" onClick={() => handleSort("position")}>Position{sortIcon("position")}</th>
                <th className="pb-2 font-medium text-right cursor-pointer select-none" onClick={() => handleSort("posChange")}>Change{sortIcon("posChange")}</th>
                <th className="pb-2 font-medium text-right cursor-pointer select-none" onClick={() => handleSort("clicks")}>Clicks{sortIcon("clicks")}</th>
                <th className="pb-2 font-medium text-right cursor-pointer select-none" onClick={() => handleSort("clickChange")}>Click &Delta;{sortIcon("clickChange")}</th>
                <th className="pb-2 font-medium text-right cursor-pointer select-none" onClick={() => handleSort("impressions")}>Impressions{sortIcon("impressions")}</th>
                <th className="pb-2 font-medium text-right cursor-pointer select-none" onClick={() => handleSort("ctr")}>CTR{sortIcon("ctr")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-surface-hover">
                  <td className="py-2 max-w-[300px] truncate">{r.keyword}</td>
                  <td className="py-2 text-right">{pos(r.position)}</td>
                  <td className="py-2 text-right">
                    {r.posChange > 0 ? (
                      <span className="text-green-400 flex items-center justify-end gap-0.5"><ArrowUp className="w-3 h-3" />{pos(r.posChange)}</span>
                    ) : r.posChange < 0 ? (
                      <span className="text-red-400 flex items-center justify-end gap-0.5"><ArrowDown className="w-3 h-3" />{pos(Math.abs(r.posChange))}</span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="py-2 text-right">{num(r.clicks)}</td>
                  <td className="py-2 text-right">
                    {r.clickChange > 0 ? (
                      <span className="text-green-400">+{num(r.clickChange)}</span>
                    ) : r.clickChange < 0 ? (
                      <span className="text-red-400">{num(r.clickChange)}</span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="py-2 text-right">{num(r.impressions)}</td>
                  <td className="py-2 text-right">{pct(r.ctr)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-muted">No keywords found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </WidgetCard>

      {/* New Keywords */}
      {movementStats.newKws.length > 0 && (
        <CollapsibleSection title="New Keywords" count={movementStats.newKws.length}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-2 font-medium">Keyword</th>
                  <th className="pb-2 font-medium text-right">Position</th>
                  <th className="pb-2 font-medium text-right">Clicks</th>
                  <th className="pb-2 font-medium text-right">Impressions</th>
                </tr>
              </thead>
              <tbody>
                {movementStats.newKws.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-surface-hover">
                    <td className="py-2 max-w-[300px] truncate">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                        {r.keyword}
                      </span>
                    </td>
                    <td className="py-2 text-right">{pos(r.position)}</td>
                    <td className="py-2 text-right">{num(r.clicks)}</td>
                    <td className="py-2 text-right">{num(r.impressions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {/* Lost Keywords */}
      {movementStats.lostKws.length > 0 && (
        <CollapsibleSection title="Lost Keywords" count={movementStats.lostKws.length}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-2 font-medium">Keyword</th>
                  <th className="pb-2 font-medium text-right">Previous Position</th>
                  <th className="pb-2 font-medium text-right">Previous Clicks</th>
                </tr>
              </thead>
              <tbody>
                {movementStats.lostKws.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-surface-hover">
                    <td className="py-2 max-w-[300px] truncate">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        {r.keyword}
                      </span>
                    </td>
                    <td className="py-2 text-right">{pos(r.position)}</td>
                    <td className="py-2 text-right">{num(r.clicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {/* Quick Wins */}
      {quickWins.length > 0 && (
        <WidgetCard title="Quick Wins — Close to Page 1">
          <div className="bg-accent/5 border border-accent/20 rounded-lg px-4 py-2.5 mb-4 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-accent mt-0.5 shrink-0" />
            <p className="text-xs text-muted">
              These keywords are on page 1 but not in the top 3. A small push could drive significant traffic.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-2 font-medium">Keyword</th>
                  <th className="pb-2 font-medium text-right">Position</th>
                  <th className="pb-2 font-medium text-right">Impressions</th>
                  <th className="pb-2 font-medium text-right">Clicks</th>
                  <th className="pb-2 font-medium text-right">CTR</th>
                  <th className="pb-2 font-medium text-right">Est. Impact</th>
                </tr>
              </thead>
              <tbody>
                {quickWins.map((r, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-surface-hover">
                    <td className="py-2 max-w-[300px] truncate">{r.keyword}</td>
                    <td className="py-2 text-right">{pos(r.position)}</td>
                    <td className="py-2 text-right">{num(r.impressions)}</td>
                    <td className="py-2 text-right">{num(r.clicks)}</td>
                    <td className="py-2 text-right">{pct(r.ctr)}</td>
                    <td className="py-2 text-right">
                      {r.estimatedImpact > 0 ? (
                        <span className="text-green-400">+{num(r.estimatedImpact)}</span>
                      ) : (
                        <span className="text-muted">{num(r.estimatedImpact)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WidgetCard>
      )}
      </>}
    </div>
  );
}
