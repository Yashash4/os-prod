"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell,
} from "recharts";
import {
  Loader2, Hash, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Sparkles, Target,
} from "lucide-react";
import DateRangeFilter, { type DateRange } from "@/components/seo/DateRangeFilter";
import { apiFetch } from "@/lib/api-fetch";

/* ── Constants ── */

const CHART_COLORS = ["#B8860B", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#6366f1", "#14b8a6", "#f97316"];
const TOOLTIP_STYLE = { contentStyle: { background: "#171717", border: "1px solid #262626", borderRadius: 8, color: "#F5F5F5" }, labelStyle: { color: "#F5F5F5" }, itemStyle: { color: "#F5F5F5" } };

const BUCKET_COLORS: Record<string, string> = {
  "Top 3": "#B8860B",
  "4-10": "#22c55e",
  "11-20": "#f59e0b",
  "21-50": "#ef4444",
  "50+": "#6b7280",
};

/* ── Helpers ── */

function num(n: number) { return n.toLocaleString("en-IN"); }
function pos(n: number) { return n.toFixed(1); }

/* ── Types ── */

interface SARow { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }
interface QuickWin { keyword: string; position: number; impressions: number; ctr: number; estimatedImpact: number; targetPosition: number }

interface MergedKeyword {
  keyword: string;
  currentPos: number;
  prevPos: number;
  change: number;
  clicks: number;
  impressions: number;
  isNew: boolean;
}

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

export default function RankAnalysisPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [merged, setMerged] = useState<MergedKeyword[]>([]);
  const [quickWins, setQuickWins] = useState<QuickWin[]>([]);
  const rangeRef = useRef<DateRange | null>(null);

  const fetchData = useCallback(async (range: DateRange) => {
    rangeRef.current = range;
    setLoading(true);
    setError("");
    try {
      const [curRes, prevRes, qwRes] = await Promise.all([
        apiFetch(`/api/seo/search-analytics?dimensions=query&rowLimit=500&startDate=${range.startDate}&endDate=${range.endDate}`),
        apiFetch(`/api/seo/search-analytics?dimensions=query&rowLimit=500&startDate=${range.prevStartDate}&endDate=${range.prevEndDate}`),
        apiFetch(`/api/seo/quick-wins?startDate=${range.startDate}&endDate=${range.endDate}`),
      ]);

      const [curJson, prevJson, qwJson] = await Promise.all([curRes.json(), prevRes.json(), qwRes.json()]);
      const curRows: SARow[] = curJson.rows || [];
      const prevRows: SARow[] = prevJson.rows || [];

      const prevMap = new Map<string, SARow>(prevRows.map((r) => [r.keys[0], r]));
      const curKeys = new Set(curRows.map((r) => r.keys[0]));

      const m: MergedKeyword[] = curRows.map((r) => {
        const prev = prevMap.get(r.keys[0]);
        return {
          keyword: r.keys[0],
          currentPos: r.position,
          prevPos: prev ? prev.position : r.position,
          change: prev ? prev.position - r.position : 0,
          clicks: r.clicks,
          impressions: r.impressions,
          isNew: !prev,
        };
      });

      setMerged(m);
      setQuickWins(qwJson.keywords || qwJson.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDateChange = useCallback((range: DateRange) => {
    fetchData(range);
  }, [fetchData]);

  /* ── Derived data ── */

  const stats = useMemo(() => {
    const total = merged.length;
    const improved = merged.filter((k) => k.change >= 1).length;
    const declined = merged.filter((k) => k.change <= -1).length;
    const newKw = merged.filter((k) => k.isNew).length;
    return { total, improved, declined, newKw };
  }, [merged]);

  const positionDistribution = useMemo(() => {
    const buckets = [
      { name: "Top 3", min: 0, max: 3, count: 0 },
      { name: "4-10", min: 3, max: 10, count: 0 },
      { name: "11-20", min: 10, max: 20, count: 0 },
      { name: "21-50", min: 20, max: 50, count: 0 },
      { name: "50+", min: 50, max: Infinity, count: 0 },
    ];
    for (const k of merged) {
      const p = k.currentPos;
      for (const b of buckets) {
        if (p > b.min && p <= b.max) { b.count++; break; }
      }
      // Handle position exactly 0 or <=0 edge case - put in Top 3
      if (merged.length > 0 && buckets.every((b) => {
        const p2 = k.currentPos;
        return !(p2 > b.min && p2 <= b.max);
      })) {
        buckets[0].count++;
      }
    }
    return buckets.map((b) => ({ name: b.name, count: b.count, fill: BUCKET_COLORS[b.name] }));
  }, [merged]);

  const scatterData = useMemo(() => {
    return merged
      .filter((k) => !k.isNew && k.prevPos <= 50 && k.currentPos <= 50)
      .map((k) => ({
        keyword: k.keyword,
        prevPos: k.prevPos,
        currentPos: k.currentPos,
        change: k.change,
        status: k.change >= 1 ? "improved" : k.change <= -1 ? "declined" : "stable",
      }));
  }, [merged]);

  const topMovers = useMemo(() => {
    return [...merged]
      .filter((k) => k.change > 0)
      .sort((a, b) => b.change - a.change)
      .slice(0, 20);
  }, [merged]);

  const biggestDrops = useMemo(() => {
    return [...merged]
      .filter((k) => k.change < 0)
      .sort((a, b) => a.change - b.change)
      .slice(0, 20);
  }, [merged]);

  const SCATTER_COLORS: Record<string, string> = { improved: "#22c55e", declined: "#ef4444", stable: "#6b7280" };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Rank Analysis</h1>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
        </div>
      </div>

      <DateRangeFilter onChange={handleDateChange} defaultDays={28} showCompare />

      {error && <div className="bg-red-500/10 text-red-400 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      )}

      {!loading && merged.length === 0 && !error && (
        <div className="text-center py-20 text-muted">No keyword data available for this period.</div>
      )}

      {!loading && merged.length > 0 && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Keywords" value={num(stats.total)} icon={Hash} color="text-accent" />
            <StatCard label="Improved" value={num(stats.improved)} icon={TrendingUp} color="text-green-400" />
            <StatCard label="Declined" value={num(stats.declined)} icon={TrendingDown} color="text-red-400" />
            <StatCard label="New Keywords" value={num(stats.newKw)} icon={Sparkles} color="text-purple-400" />
          </div>

          {/* Position Distribution */}
          <WidgetCard title="Position Distribution">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={positionDistribution}>
                <XAxis dataKey="name" tick={{ fill: "#a3a3a3", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#a3a3a3", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {positionDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </WidgetCard>

          {/* Position Change Scatter */}
          <WidgetCard title="Position Change Scatter">
            <p className="text-xs text-muted mb-2">
              Above diagonal = improved &bull; Below diagonal = declined &bull; Green = improved, Red = declined, Gray = stable (&plusmn;1)
            </p>
            <ResponsiveContainer width="100%" height={350}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                <XAxis
                  type="number"
                  dataKey="prevPos"
                  name="Previous Position"
                  domain={[1, 50]}
                  reversed
                  tick={{ fill: "#a3a3a3", fontSize: 11 }}
                  label={{ value: "Previous Position", position: "insideBottom", offset: -5, fill: "#a3a3a3", fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="currentPos"
                  name="Current Position"
                  domain={[1, 50]}
                  reversed
                  tick={{ fill: "#a3a3a3", fontSize: 11 }}
                  label={{ value: "Current Position", angle: -90, position: "insideLeft", fill: "#a3a3a3", fontSize: 11 }}
                />
                <ZAxis range={[30, 30]} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div style={{ background: "#171717", border: "1px solid #262626", borderRadius: 8, color: "#F5F5F5", padding: "8px 12px", fontSize: 12 }}>
                        <p className="font-medium mb-1">{d.keyword}</p>
                        <p>Previous: {pos(d.prevPos)}</p>
                        <p>Current: {pos(d.currentPos)}</p>
                        <p style={{ color: d.change >= 1 ? "#22c55e" : d.change <= -1 ? "#ef4444" : "#a3a3a3" }}>
                          Change: {d.change >= 0 ? "+" : ""}{pos(d.change)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Scatter data={scatterData}>
                  {scatterData.map((entry, i) => (
                    <Cell key={i} fill={SCATTER_COLORS[entry.status]} fillOpacity={0.7} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </WidgetCard>

          {/* Top Movers & Biggest Drops */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <WidgetCard title="Top Movers (Improved)">
              {topMovers.length === 0 ? (
                <p className="text-sm text-muted text-center py-4">No position improvements in this period</p>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-[#171717]">
                      <tr className="border-b border-border text-left text-muted">
                        <th className="pb-2 font-medium">Keyword</th>
                        <th className="pb-2 font-medium text-right">Prev Pos</th>
                        <th className="pb-2 font-medium text-right">Curr Pos</th>
                        <th className="pb-2 font-medium text-right">Change</th>
                        <th className="pb-2 font-medium text-right">Clicks</th>
                        <th className="pb-2 font-medium text-right">Impressions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topMovers.map((k, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-white/5">
                          <td className="py-2 max-w-[200px] truncate text-foreground" title={k.keyword}>{k.keyword}</td>
                          <td className="py-2 text-right text-muted">{pos(k.prevPos)}</td>
                          <td className="py-2 text-right text-foreground">{pos(k.currentPos)}</td>
                          <td className="py-2 text-right">
                            <span className="text-green-400 inline-flex items-center gap-0.5">
                              <ArrowUp className="w-3 h-3" />{pos(k.change)}
                            </span>
                          </td>
                          <td className="py-2 text-right text-foreground">{num(k.clicks)}</td>
                          <td className="py-2 text-right text-muted">{num(k.impressions)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </WidgetCard>

            <WidgetCard title="Biggest Drops (Declined)">
              {biggestDrops.length === 0 ? (
                <p className="text-sm text-muted text-center py-4">No position drops in this period</p>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-[#171717]">
                      <tr className="border-b border-border text-left text-muted">
                        <th className="pb-2 font-medium">Keyword</th>
                        <th className="pb-2 font-medium text-right">Prev Pos</th>
                        <th className="pb-2 font-medium text-right">Curr Pos</th>
                        <th className="pb-2 font-medium text-right">Change</th>
                        <th className="pb-2 font-medium text-right">Clicks</th>
                        <th className="pb-2 font-medium text-right">Impressions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {biggestDrops.map((k, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-white/5">
                          <td className="py-2 max-w-[200px] truncate text-foreground" title={k.keyword}>{k.keyword}</td>
                          <td className="py-2 text-right text-muted">{pos(k.prevPos)}</td>
                          <td className="py-2 text-right text-foreground">{pos(k.currentPos)}</td>
                          <td className="py-2 text-right">
                            <span className="text-red-400 inline-flex items-center gap-0.5">
                              <ArrowDown className="w-3 h-3" />{pos(Math.abs(k.change))}
                            </span>
                          </td>
                          <td className="py-2 text-right text-foreground">{num(k.clicks)}</td>
                          <td className="py-2 text-right text-muted">{num(k.impressions)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </WidgetCard>
          </div>

          {/* Quick Wins */}
          <WidgetCard title="Quick Wins — Keywords at Positions 4-20 with High Impressions">
            {quickWins.length === 0 ? (
              <p className="text-sm text-muted text-center py-4">No quick win opportunities found</p>
            ) : (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#171717]">
                    <tr className="border-b border-border text-left text-muted">
                      <th className="pb-2 font-medium">Keyword</th>
                      <th className="pb-2 font-medium text-right">Position</th>
                      <th className="pb-2 font-medium text-right">Impressions</th>
                      <th className="pb-2 font-medium text-right">Current CTR</th>
                      <th className="pb-2 font-medium text-right">Est. Impact</th>
                      <th className="pb-2 font-medium text-right">Target Pos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quickWins.map((qw, i) => (
                      <tr
                        key={i}
                        className={`border-b hover:bg-white/5 ${
                          i < 5 ? "border-l-2 border-l-accent border-b-border/50" : "border-border/50"
                        }`}
                      >
                        <td className="py-2 max-w-[250px] truncate text-foreground" title={qw.keyword}>
                          <div className="flex items-center gap-2">
                            {i < 5 && <Target className="w-3.5 h-3.5 text-accent flex-shrink-0" />}
                            {qw.keyword}
                          </div>
                        </td>
                        <td className="py-2 text-right text-foreground">{pos(qw.position)}</td>
                        <td className="py-2 text-right text-muted">{num(qw.impressions)}</td>
                        <td className="py-2 text-right text-muted">{(qw.ctr * 100).toFixed(2)}%</td>
                        <td className="py-2 text-right text-accent font-medium">{num(Math.round(qw.estimatedImpact))}</td>
                        <td className="py-2 text-right text-green-400">{qw.targetPosition}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </WidgetCard>
        </>
      )}
    </div>
  );
}
