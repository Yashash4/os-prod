"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2, PieChart as PieChartIcon } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/* ── Types ─────────────────────────────────────────── */

interface InsightRow {
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: { action_type: string; value: string }[];
  purchase_roas?: { action_type: string; value: string }[];
  // breakdown fields
  age?: string;
  gender?: string;
  publisher_platform?: string;
  impression_device?: string;
  country?: string;
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

const BREAKDOWNS = [
  { label: "Age", value: "age" },
  { label: "Gender", value: "gender" },
  { label: "Platform", value: "publisher_platform" },
  { label: "Device", value: "impression_device" },
  { label: "Country", value: "country" },
];

const TOOLTIP_STYLE = {
  background: "#1a1a1a",
  border: "1px solid #262626",
  borderRadius: "8px",
  color: "#ededed",
};

const COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#6366f1", "#14b8a6", "#f97316",
  "#84cc16", "#a855f7", "#f43f5e", "#0ea5e9",
];

function num(val?: string) {
  return parseFloat(val || "0");
}

function currency(val: number) {
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function getBreakdownLabel(row: InsightRow, breakdown: string) {
  const val = (row as Record<string, unknown>)[breakdown] as string | undefined;
  if (!val) return "Unknown";
  if (breakdown === "gender") {
    return val === "male" ? "Male" : val === "female" ? "Female" : val;
  }
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ── Main Component ────────────────────────────────── */

export default function AnalyticsPage() {
  const [breakdown, setBreakdown] = useState("age");
  const [datePreset, setDatePreset] = useState("last_30d");
  const [data, setData] = useState<InsightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/meta/breakdowns?breakdown=${breakdown}&date_preset=${datePreset}`
        );
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setData(json.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [breakdown, datePreset]);

  /* ── Aggregate by breakdown value ────────────── */
  const aggregated = useMemo(() => {
    const map: Record<string, { spend: number; impressions: number; clicks: number; reach: number }> = {};
    data.forEach((row) => {
      const label = getBreakdownLabel(row, breakdown);
      if (!map[label]) map[label] = { spend: 0, impressions: 0, clicks: 0, reach: 0 };
      map[label].spend += num(row.spend);
      map[label].impressions += num(row.impressions);
      map[label].clicks += num(row.clicks);
      map[label].reach += num(row.reach);
    });
    return Object.entries(map)
      .map(([name, d]) => ({
        name,
        spend: parseFloat(d.spend.toFixed(2)),
        impressions: d.impressions,
        clicks: d.clicks,
        reach: d.reach,
        ctr: d.impressions > 0 ? parseFloat(((d.clicks / d.impressions) * 100).toFixed(2)) : 0,
        cpc: d.clicks > 0 ? parseFloat((d.spend / d.clicks).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.spend - a.spend);
  }, [data, breakdown]);

  const totalSpend = useMemo(() => aggregated.reduce((s, r) => s + r.spend, 0), [aggregated]);

  const useBarChart = breakdown === "age" || breakdown === "impression_device" || breakdown === "country";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
          <p className="text-muted text-sm mt-1">Demographic & placement breakdowns</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Read Only
          </span>
          <select
            value={breakdown}
            onChange={(e) => setBreakdown(e.target.value)}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
          >
            {BREAKDOWNS.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">{error}</div>
      )}

      {/* Chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-sm font-medium text-foreground mb-4">
            Spend by {BREAKDOWNS.find((b) => b.value === breakdown)?.label}
          </h3>
          {aggregated.length > 0 ? (
            useBarChart ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={aggregated}>
                  <XAxis dataKey="name" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                  <Bar dataKey="spend" radius={[4, 4, 0, 0]} name="Spend">
                    {aggregated.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={aggregated}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={110}
                    dataKey="spend"
                    label={({ name, value }) => `${name}: ${currency(value)}`}
                    labelLine
                  >
                    {aggregated.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted text-sm">
              <PieChartIcon className="w-8 h-8 text-muted/30 mr-2" />
              No data available
            </div>
          )}
        </div>

        {/* Clicks chart */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-sm font-medium text-foreground mb-4">
            Clicks by {BREAKDOWNS.find((b) => b.value === breakdown)?.label}
          </h3>
          {aggregated.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={aggregated}>
                <XAxis dataKey="name" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="clicks" radius={[4, 4, 0, 0]} fill="#22c55e" name="Clicks" />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted text-sm">No data available</div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-xs text-muted font-medium">
                  {BREAKDOWNS.find((b) => b.value === breakdown)?.label}
                </th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Spend</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">% of Total</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Impressions</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Clicks</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">CTR</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">CPC</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Reach</th>
              </tr>
            </thead>
            <tbody>
              {aggregated.map((row, idx) => (
                <tr key={idx} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                  <td className="py-3 px-4 text-foreground font-medium">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[idx % COLORS.length] }} />
                      {row.name}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right text-foreground">{currency(row.spend)}</td>
                  <td className="py-3 px-3 text-right text-muted">
                    {totalSpend > 0 ? `${((row.spend / totalSpend) * 100).toFixed(1)}%` : "0%"}
                  </td>
                  <td className="py-3 px-3 text-right text-foreground">{row.impressions.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right text-foreground">{row.clicks.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right text-foreground">{row.ctr}%</td>
                  <td className="py-3 px-3 text-right text-foreground">{currency(row.cpc)}</td>
                  <td className="py-3 px-3 text-right text-foreground">{row.reach.toLocaleString()}</td>
                </tr>
              ))}
              {aggregated.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted text-sm">
                    No data available for this breakdown
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
