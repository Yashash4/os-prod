"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Loader2,
  Users,
  Smartphone,
  Globe,
  Monitor,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { apiFetch } from "@/lib/api-fetch";

/* ── Types ─────────────────────────────────────────── */

interface BreakdownRow {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  reach?: string;
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
];

const CHART_COLORS = [
  "#B8860B", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#6366f1", "#14b8a6", "#f97316",
];

const TOOLTIP_STYLE = {
  background: "#171717",
  border: "1px solid #262626",
  borderRadius: "8px",
  color: "#F5F5F5",
};

const METRIC_OPTIONS = [
  { label: "Spend", key: "spend" },
  { label: "CTR", key: "ctr" },
  { label: "CPC", key: "cpc" },
  { label: "CPM", key: "cpm" },
  { label: "Clicks", key: "clicks" },
] as const;

type MetricKey = (typeof METRIC_OPTIONS)[number]["key"];

/* ── Helpers ───────────────────────────────────────── */

function num(val?: string) {
  return parseFloat(val || "0");
}

function currency(val: number) {
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function compact(val: number) {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(0);
}

function getMetricValue(row: BreakdownRow, key: MetricKey): number {
  switch (key) {
    case "spend": return num(row.spend);
    case "ctr": return num(row.ctr);
    case "cpc": return num(row.cpc);
    case "cpm": return num(row.cpm);
    case "clicks": return num(row.clicks);
    default: return 0;
  }
}

function formatMetric(val: number, key: MetricKey): string {
  switch (key) {
    case "spend": return currency(val);
    case "ctr": return `${val.toFixed(2)}%`;
    case "cpc": return currency(val);
    case "cpm": return currency(val);
    case "clicks": return compact(val);
    default: return val.toFixed(2);
  }
}

/* ── Main Component ────────────────────────────────── */

export default function AudienceInsightsPage() {
  const [ageData, setAgeData] = useState<BreakdownRow[]>([]);
  const [genderData, setGenderData] = useState<BreakdownRow[]>([]);
  const [ageGenderData, setAgeGenderData] = useState<BreakdownRow[]>([]);
  const [platformData, setPlatformData] = useState<BreakdownRow[]>([]);
  const [deviceData, setDeviceData] = useState<BreakdownRow[]>([]);
  const [countryData, setCountryData] = useState<BreakdownRow[]>([]);
  const [datePreset, setDatePreset] = useState("last_30d");
  const [metric, setMetric] = useState<MetricKey>("spend");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasAgeGenderCross, setHasAgeGenderCross] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const [ageRes, genderRes, ageGenderRes, platformRes, deviceRes, countryRes] = await Promise.all([
          apiFetch(`/api/meta/breakdowns?breakdown=age&date_preset=${datePreset}`),
          apiFetch(`/api/meta/breakdowns?breakdown=gender&date_preset=${datePreset}`),
          apiFetch(`/api/meta/breakdowns?breakdown=age,gender&date_preset=${datePreset}`).catch(() => null),
          apiFetch(`/api/meta/breakdowns?breakdown=publisher_platform&date_preset=${datePreset}`),
          apiFetch(`/api/meta/breakdowns?breakdown=impression_device&date_preset=${datePreset}`),
          apiFetch(`/api/meta/breakdowns?breakdown=country&date_preset=${datePreset}`).catch(() => null),
        ]);

        const ageJson = await ageRes.json();
        const genderJson = await genderRes.json();
        const platformJson = await platformRes.json();
        const deviceJson = await deviceRes.json();

        if (ageJson.error) throw new Error(ageJson.error);

        setAgeData(ageJson.data || []);
        setGenderData(genderJson.data || []);
        setPlatformData(platformJson.data || []);
        setDeviceData(deviceJson.data || []);

        // Try age,gender cross-breakdown
        if (ageGenderRes) {
          try {
            const agJson = await ageGenderRes.json();
            if (agJson.data && agJson.data.length > 0 && agJson.data[0].age && agJson.data[0].gender) {
              setAgeGenderData(agJson.data);
              setHasAgeGenderCross(true);
            } else {
              setHasAgeGenderCross(false);
            }
          } catch {
            setHasAgeGenderCross(false);
          }
        } else {
          setHasAgeGenderCross(false);
        }

        // Country may fail
        if (countryRes) {
          try {
            const cJson = await countryRes.json();
            setCountryData(cJson.data || []);
          } catch {
            setCountryData([]);
          }
        } else {
          setCountryData([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [datePreset]);

  /* ── Heatmap data ─── */
  const heatmapData = useMemo(() => {
    if (!hasAgeGenderCross) return null;

    const ageGroups = Array.from(new Set(ageGenderData.map((r) => r.age || "").filter(Boolean))).sort();
    const genders = ["male", "female", "unknown"];

    // Build lookup
    const lookup: Record<string, number> = {};
    let maxVal = 0;
    ageGenderData.forEach((r) => {
      const key = `${r.age}|${(r.gender || "").toLowerCase()}`;
      const val = getMetricValue(r, metric);
      lookup[key] = (lookup[key] || 0) + val;
      if (lookup[key] > maxVal) maxVal = lookup[key];
    });

    return { ageGroups, genders, lookup, maxVal };
  }, [ageGenderData, hasAgeGenderCross, metric]);

  /* ── Separate bar chart data for age & gender (fallback) ─── */
  const ageBarData = useMemo(() => {
    const map: Record<string, number> = {};
    ageData.forEach((r) => {
      const key = r.age || "Unknown";
      map[key] = (map[key] || 0) + getMetricValue(r, metric);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ageData, metric]);

  const genderBarData = useMemo(() => {
    const map: Record<string, number> = {};
    genderData.forEach((r) => {
      const key = r.gender || "Unknown";
      map[key] = (map[key] || 0) + getMetricValue(r, metric);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
      .sort((a, b) => b.value - a.value);
  }, [genderData, metric]);

  /* ── Platform pie data ─── */
  const platformPieData = useMemo(() => {
    const map: Record<string, number> = {};
    platformData.forEach((r) => {
      const key = r.publisher_platform || "Unknown";
      map[key] = (map[key] || 0) + getMetricValue(r, metric);
    });
    return Object.entries(map)
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, " "),
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [platformData, metric]);

  /* ── Device bar data ─── */
  const deviceBarData = useMemo(() => {
    const map: Record<string, number> = {};
    deviceData.forEach((r) => {
      const key = r.impression_device || "Unknown";
      map[key] = (map[key] || 0) + getMetricValue(r, metric);
    });
    return Object.entries(map)
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, " "),
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [deviceData, metric]);

  /* ── Country bar data ─── */
  const countryBarData = useMemo(() => {
    const map: Record<string, number> = {};
    countryData.forEach((r) => {
      const key = r.country || "Unknown";
      map[key] = (map[key] || 0) + getMetricValue(r, metric);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [countryData, metric]);

  /* ── Radar data ─── */
  const radarData = useMemo(() => {
    // Get top 4 age groups by spend
    const ageSpend: Record<string, number> = {};
    ageData.forEach((r) => {
      const key = r.age || "Unknown";
      ageSpend[key] = (ageSpend[key] || 0) + num(r.spend);
    });
    const topAges = Object.entries(ageSpend)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([age]) => age);

    if (topAges.length === 0) return { data: [], ages: [] };

    // Aggregate metrics per age group
    const ageMetrics: Record<string, { spend: number; ctr: number; cpc: number; cpm: number; clicks: number; count: number }> = {};
    ageData.forEach((r) => {
      const key = r.age || "Unknown";
      if (!topAges.includes(key)) return;
      if (!ageMetrics[key]) ageMetrics[key] = { spend: 0, ctr: 0, cpc: 0, cpm: 0, clicks: 0, count: 0 };
      ageMetrics[key].spend += num(r.spend);
      ageMetrics[key].ctr += num(r.ctr);
      ageMetrics[key].cpc += num(r.cpc);
      ageMetrics[key].cpm += num(r.cpm);
      ageMetrics[key].clicks += num(r.clicks);
      ageMetrics[key].count += 1;
    });

    // Average where appropriate
    topAges.forEach((age) => {
      const m = ageMetrics[age];
      if (m && m.count > 1) {
        m.ctr = m.ctr / m.count;
        m.cpc = m.cpc / m.count;
        m.cpm = m.cpm / m.count;
      }
    });

    // Find max per metric for normalization
    const maxes = { spend: 0, ctr: 0, cpc: 0, cpm: 0, clicks: 0 };
    topAges.forEach((age) => {
      const m = ageMetrics[age];
      if (!m) return;
      if (m.spend > maxes.spend) maxes.spend = m.spend;
      if (m.ctr > maxes.ctr) maxes.ctr = m.ctr;
      if (m.cpc > maxes.cpc) maxes.cpc = m.cpc;
      if (m.cpm > maxes.cpm) maxes.cpm = m.cpm;
      if (m.clicks > maxes.clicks) maxes.clicks = m.clicks;
    });

    const normalize = (val: number, max: number) => (max === 0 ? 0 : (val / max) * 100);

    const axes = ["Spend", "CTR", "CPC", "CPM", "Clicks"];
    const data = axes.map((axis) => {
      const row: Record<string, string | number> = { metric: axis };
      topAges.forEach((age) => {
        const m = ageMetrics[age];
        if (!m) { row[age] = 0; return; }
        switch (axis) {
          case "Spend": row[age] = normalize(m.spend, maxes.spend); break;
          case "CTR": row[age] = normalize(m.ctr, maxes.ctr); break;
          case "CPC": row[age] = normalize(m.cpc, maxes.cpc); break;
          case "CPM": row[age] = normalize(m.cpm, maxes.cpm); break;
          case "Clicks": row[age] = normalize(m.clicks, maxes.clicks); break;
        }
      });
      return row;
    });

    return { data, ages: topAges };
  }, [ageData]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
        <span className="ml-2 text-muted text-sm">Loading audience insights...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-accent" />
            Audience Insights
          </h1>
          <p className="text-muted text-sm mt-1">Cross-dimensional breakdown analysis</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Read Only
          </span>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as MetricKey)}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
          >
            {METRIC_OPTIONS.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
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

      {/* 1. Age x Gender Heatmap (or fallback bar charts) */}
      <div className="card rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground mb-1">Age x Gender</h2>
        <p className="text-xs text-muted mb-4">
          {hasAgeGenderCross
            ? `Heatmap showing ${METRIC_OPTIONS.find((m) => m.key === metric)?.label} by age and gender`
            : `Breakdown by age and gender (shown separately)`}
        </p>

        {hasAgeGenderCross && heatmapData ? (
          /* Cross-tab heatmap */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 text-xs text-muted font-medium">Age Group</th>
                  {heatmapData.genders.map((g) => (
                    <th key={g} className="text-center py-2 px-3 text-xs text-muted font-medium">
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapData.ageGroups.map((age) => (
                  <tr key={age} className="border-t border-border/30">
                    <td className="py-2 px-3 text-foreground font-medium text-sm">{age}</td>
                    {heatmapData.genders.map((g) => {
                      const key = `${age}|${g}`;
                      const val = heatmapData.lookup[key] || 0;
                      const opacity = heatmapData.maxVal > 0 ? Math.max(0.1, val / heatmapData.maxVal) : 0.1;
                      return (
                        <td
                          key={g}
                          className="py-2 px-3 text-center text-sm font-medium"
                          style={{
                            backgroundColor: `rgba(184, 134, 11, ${opacity})`,
                            color: opacity > 0.5 ? "#000" : "#F5F5F5",
                          }}
                        >
                          {formatMetric(val, metric)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Fallback: separate bar charts */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted mb-2">By Age</p>
              {ageBarData.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center text-muted text-sm">No age data</div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={ageBarData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                    <XAxis dataKey="name" tick={{ fill: "#a3a3a3", fontSize: 11 }} stroke="#404040" />
                    <YAxis tick={{ fill: "#a3a3a3", fontSize: 11 }} stroke="#404040" tickFormatter={(v) => compact(Number(v))} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: unknown) => [formatMetric(Number(value), metric), METRIC_OPTIONS.find((m) => m.key === metric)?.label]} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {ageBarData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div>
              <p className="text-sm text-muted mb-2">By Gender</p>
              {genderBarData.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center text-muted text-sm">No gender data</div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={genderBarData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                    <XAxis dataKey="name" tick={{ fill: "#a3a3a3", fontSize: 11 }} stroke="#404040" />
                    <YAxis tick={{ fill: "#a3a3a3", fontSize: 11 }} stroke="#404040" tickFormatter={(v) => compact(Number(v))} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: unknown) => [formatMetric(Number(value), metric), METRIC_OPTIONS.find((m) => m.key === metric)?.label]} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {genderBarData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Platform Breakdown — PieChart */}
      <div className="card rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground mb-1">Platform Breakdown</h2>
        <p className="text-xs text-muted mb-4">Facebook, Instagram, Audience Network, Messenger</p>
        {platformPieData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted text-sm">No platform data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={platformPieData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={50}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }: { name?: string; percent?: number }) => `${name || ""} ${((percent || 0) * 100).toFixed(0)}%`}
              >
                {platformPieData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value: unknown) => [formatMetric(Number(value), metric), METRIC_OPTIONS.find((m) => m.key === metric)?.label]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 3. Device Breakdown — Horizontal BarChart */}
      <div className="card rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-1">
          <Monitor className="w-5 h-5 text-accent" />
          Device Breakdown
        </h2>
        <p className="text-xs text-muted mb-4">Mobile, Desktop, Tablet</p>
        {deviceBarData.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted text-sm">No device data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, deviceBarData.length * 50)}>
            <BarChart
              data={deviceBarData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#a3a3a3", fontSize: 11 }}
                stroke="#404040"
                tickFormatter={(v) => compact(Number(v))}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fill: "#a3a3a3", fontSize: 11 }}
                stroke="#404040"
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value: unknown) => [formatMetric(Number(value), metric), METRIC_OPTIONS.find((m) => m.key === metric)?.label]}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {deviceBarData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 4. Country Breakdown — Horizontal BarChart */}
      <div className="card rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-1">
          <Globe className="w-5 h-5 text-accent" />
          Country Breakdown
        </h2>
        <p className="text-xs text-muted mb-4">Top 10 countries</p>
        {countryBarData.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted text-sm">
            <div className="text-center">
              <Globe className="w-8 h-8 text-muted/30 mx-auto mb-2" />
              No country data available
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, countryBarData.length * 45)}>
            <BarChart
              data={countryBarData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#a3a3a3", fontSize: 11 }}
                stroke="#404040"
                tickFormatter={(v) => compact(Number(v))}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={60}
                tick={{ fill: "#a3a3a3", fontSize: 11 }}
                stroke="#404040"
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value: unknown) => [formatMetric(Number(value), metric), METRIC_OPTIONS.find((m) => m.key === metric)?.label]}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {countryBarData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 5. Audience Radar */}
      <div className="card rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground mb-1">Audience Radar</h2>
        <p className="text-xs text-muted mb-4">
          Multi-metric comparison across top age groups (normalized 0-100 scale)
        </p>
        {radarData.ages.length === 0 ? (
          <div className="h-[350px] flex items-center justify-center text-muted text-sm">No data for radar chart</div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={radarData.data} cx="50%" cy="50%" outerRadius="80%">
              <PolarGrid stroke="#262626" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: "#a3a3a3", fontSize: 11 }} />
              <PolarRadiusAxis tick={{ fill: "#525252", fontSize: 10 }} domain={[0, 100]} />
              {radarData.ages.map((age, i) => (
                <Radar
                  key={age}
                  name={age}
                  dataKey={age}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  fillOpacity={0.15}
                />
              ))}
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: unknown) => [`${Number(value).toFixed(0)}`, "Score"]} />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
