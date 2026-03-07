"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Loader2,
  IndianRupee,
  Eye,
  MousePointer,
  Users,
  Repeat,
  TrendingUp,
  Target,
  BarChart3,
} from "lucide-react";
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
  LineChart,
  Line,
} from "recharts";

/* ── Types ─────────────────────────────────────────── */

interface InsightRow {
  date_start?: string;
  date_stop?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  frequency?: string;
  cpm?: string;
  ctr?: string;
  cpc?: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
  purchase_roas?: { action_type: string; value: string }[];
  // breakdown fields
  age?: string;
  gender?: string;
  publisher_platform?: string;
  impression_device?: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
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

const TOOLTIP_STYLE = {
  background: "#1a1a1a",
  border: "1px solid #262626",
  borderRadius: "8px",
  color: "#ededed",
};

const COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#6366f1", "#14b8a6", "#f97316",
];

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

function getActionValue(actions: { action_type: string; value: string }[] | undefined, type: string) {
  if (!actions) return 0;
  const a = actions.find((a) => a.action_type === type);
  return a ? parseFloat(a.value) : 0;
}

/* ── Reusable Components ──────────────────────────── */

function StatCard({
  label,
  value,
  icon: Icon,
  color = "text-accent",
}: {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  color?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon className={`w-3.5 h-3.5 ${color}`} />}
        <span className="text-xs text-muted">{label}</span>
      </div>
      <span className="text-xl font-bold text-foreground">{value}</span>
    </div>
  );
}

function WidgetCard({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

/* ── Main Dashboard ────────────────────────────────── */

export default function MetaDashboard() {
  const [datePreset, setDatePreset] = useState("last_30d");
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [campaignBulk, setCampaignBulk] = useState<(InsightRow & { campaign_id?: string; campaign_name?: string })[]>([]);
  const [ageData, setAgeData] = useState<InsightRow[]>([]);
  const [genderData, setGenderData] = useState<InsightRow[]>([]);
  const [platformData, setPlatformData] = useState<InsightRow[]>([]);
  const [deviceData, setDeviceData] = useState<InsightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ── Fetch all data ────────────────────────────── */
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setError("");
      try {
        // 6 API calls total (each = 1 Meta API call, no pagination)
        const [insRes, campBulkRes, ageRes, genderRes, platRes, devRes] = await Promise.all([
          fetch(`/api/meta/account-insights?date_preset=${datePreset}&time_increment=1`),
          fetch(`/api/meta/campaign-insights-bulk?date_preset=${datePreset}`),
          fetch(`/api/meta/breakdowns?breakdown=age&date_preset=${datePreset}`),
          fetch(`/api/meta/breakdowns?breakdown=gender&date_preset=${datePreset}`),
          fetch(`/api/meta/breakdowns?breakdown=publisher_platform&date_preset=${datePreset}`),
          fetch(`/api/meta/breakdowns?breakdown=impression_device&date_preset=${datePreset}`),
        ]);

        const [insData, campBulkData, ageD, genderD, platD, devD] = await Promise.all([
          insRes.json(),
          campBulkRes.json(),
          ageRes.json(),
          genderRes.json(),
          platRes.json(),
          devRes.json(),
        ]);

        if (insData.error) throw new Error(insData.error);

        setInsights(insData.insights || []);
        setCampaignBulk(campBulkData.insights || []);
        setAgeData(ageD.data || []);
        setGenderData(genderD.data || []);
        setPlatformData(platD.data || []);
        setDeviceData(devD.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [datePreset]);

  /* ── Aggregated KPIs ───────────────────────────── */
  const totals = useMemo(() => {
    let spend = 0, impressions = 0, clicks = 0, reach = 0;
    let purchases = 0, purchaseValue = 0;

    insights.forEach((row) => {
      spend += num(row.spend);
      impressions += num(row.impressions);
      clicks += num(row.clicks);
      reach += num(row.reach);
      purchases += getActionValue(row.actions, "purchase");
      purchaseValue += getActionValue(row.action_values, "purchase");
    });

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    const roas = spend > 0 ? purchaseValue / spend : 0;
    const frequency = reach > 0 ? impressions / reach : 0;

    return { spend, impressions, clicks, reach, ctr, cpc, cpm, roas, frequency, purchases, purchaseValue };
  }, [insights]);

  /* ── Daily trend data ──────────────────────────── */
  const dailyData = useMemo(() => {
    return insights
      .filter((r) => r.date_start)
      .sort((a, b) => (a.date_start || "").localeCompare(b.date_start || ""))
      .map((row) => ({
        date: row.date_start?.slice(5) || "",
        spend: num(row.spend),
        ctr: parseFloat(num(row.ctr).toFixed(2)),
        cpc: parseFloat(num(row.cpc).toFixed(2)),
        impressions: num(row.impressions),
        clicks: num(row.clicks),
      }));
  }, [insights]);

  /* ── Campaign bar data ─────────────────────────── */
  const campaignBarData = useMemo(() => {
    return campaignBulk
      .map((row) => {
        const name = row.campaign_name || row.campaign_id || "Unknown";
        return {
          name: name.length > 25 ? name.slice(0, 25) + "…" : name,
          spend: num(row.spend),
          clicks: num(row.clicks),
        };
      })
      .filter((c) => c.spend > 0)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10);
  }, [campaignBulk]);

  /* ── Conversion action breakdown ───────────────── */
  const conversionData = useMemo(() => {
    const actionMap: Record<string, number> = {};
    insights.forEach((row) => {
      (row.actions || []).forEach((a) => {
        const label = a.action_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        actionMap[label] = (actionMap[label] || 0) + parseFloat(a.value);
      });
    });
    return Object.entries(actionMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [insights]);

  /* ── Breakdown data formatters ─────────────────── */
  const ageChartData = useMemo(() => {
    return ageData.map((r) => ({
      name: r.age || "Unknown",
      spend: num(r.spend),
      clicks: num(r.clicks),
    }));
  }, [ageData]);

  const genderChartData = useMemo(() => {
    return genderData.map((r) => ({
      name: r.gender === "male" ? "Male" : r.gender === "female" ? "Female" : r.gender || "Unknown",
      spend: num(r.spend),
      clicks: num(r.clicks),
    }));
  }, [genderData]);

  const platformChartData = useMemo(() => {
    return platformData.map((r) => ({
      name: (r.publisher_platform || "Unknown").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      spend: num(r.spend),
      clicks: num(r.clicks),
    }));
  }, [platformData]);

  const deviceChartData = useMemo(() => {
    return deviceData.map((r) => ({
      name: (r.impression_device || "Unknown").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      spend: num(r.spend),
      clicks: num(r.clicks),
    }));
  }, [deviceData]);

  /* ── Render ────────────────────────────────────── */

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
          <h1 className="text-2xl font-semibold text-foreground">Meta Ads Dashboard</h1>
          <p className="text-muted text-sm mt-1">Facebook & Instagram advertising analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Read Only
          </span>
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">{error}</div>
      )}

      {/* ── KPI Cards ────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard label="Total Spend" value={currency(totals.spend)} icon={IndianRupee} color="text-green-400" />
        <StatCard label="Impressions" value={compact(totals.impressions)} icon={Eye} color="text-blue-400" />
        <StatCard label="Clicks" value={compact(totals.clicks)} icon={MousePointer} color="text-cyan-400" />
        <StatCard label="Reach" value={compact(totals.reach)} icon={Users} color="text-purple-400" />
        <StatCard label="CTR" value={`${totals.ctr.toFixed(2)}%`} icon={TrendingUp} color="text-amber-400" />
        <StatCard label="CPC" value={currency(totals.cpc)} icon={Target} color="text-red-400" />
        <StatCard label="CPM" value={currency(totals.cpm)} icon={BarChart3} color="text-pink-400" />
        <StatCard label="ROAS" value={`${totals.roas.toFixed(2)}x`} icon={Repeat} color="text-emerald-400" />
      </div>

      {/* ── Row 1: Spend Over Time + Performance Trend ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WidgetCard title="Spend Over Time">
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyData}>
                <XAxis dataKey="date" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                <Line type="monotone" dataKey="spend" stroke="#3b82f6" strokeWidth={2} dot={false} name="Spend" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted text-sm">No data available</div>
          )}
        </WidgetCard>

        <WidgetCard title="Performance Trend">
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyData}>
                <XAxis dataKey="date" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line yAxisId="left" type="monotone" dataKey="ctr" stroke="#22c55e" strokeWidth={2} dot={false} name="CTR %" />
                <Line yAxisId="right" type="monotone" dataKey="cpc" stroke="#f59e0b" strokeWidth={2} dot={false} name="CPC ₹" />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted text-sm">No data available</div>
          )}
        </WidgetCard>
      </div>

      {/* ── Row 2: Campaign Performance + Conversions ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WidgetCard title="Campaign Performance (Spend)">
          {campaignBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={campaignBarData} layout="vertical">
                <XAxis type="number" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} width={140} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                <Bar dataKey="spend" radius={[0, 4, 4, 0]}>
                  {campaignBarData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted text-sm">No campaign data</div>
          )}
        </WidgetCard>

        <WidgetCard title="Conversion Breakdown">
          {conversionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={conversionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {conversionData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted text-sm">No conversion data</div>
          )}
        </WidgetCard>
      </div>

      {/* ── Row 3: Age + Gender Breakdown ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WidgetCard title="Age Breakdown">
          {ageChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ageChartData}>
                <XAxis dataKey="name" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                <Bar dataKey="spend" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Spend" />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted text-sm">No age data</div>
          )}
        </WidgetCard>

        <WidgetCard title="Gender Breakdown">
          {genderChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={genderChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="spend"
                  label={({ name, value }) => `${name}: ${currency(value)}`}
                  labelLine
                >
                  {genderChartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted text-sm">No gender data</div>
          )}
        </WidgetCard>
      </div>

      {/* ── Row 4: Platform + Device Breakdown ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WidgetCard title="Platform Breakdown">
          {platformChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={platformChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="spend"
                  label={({ name, value }) => `${name}: ${currency(value)}`}
                  labelLine
                >
                  {platformChartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted text-sm">No platform data</div>
          )}
        </WidgetCard>

        <WidgetCard title="Device Breakdown">
          {deviceChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={deviceChartData}>
                <XAxis dataKey="name" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                <Bar dataKey="spend" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Spend" />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted text-sm">No device data</div>
          )}
        </WidgetCard>
      </div>
    </div>
  );
}
