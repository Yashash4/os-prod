"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Phone,
  MessageSquare,
  ListChecks,
  AlertTriangle,
  TrendingUp,
  Clock,
  IndianRupee,
  Zap,
  Globe,
  MousePointer,
  Eye,
  Map,
  MessageCircle,
  CalendarCheck,
  ExternalLink,
  PhoneCall,
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

/* ── Types ─────────────────────────────────────────────── */

interface Pipeline {
  id: string;
  name: string;
  stages: { id: string; name: string }[];
}

interface Opportunity {
  id: string;
  name: string;
  status: string;
  monetaryValue: number;
  pipelineStageId: string;
  pipelineId: string;
  source?: string;
  createdAt?: string;
  lastStatusChangeAt?: string;
}

/* ── Constants ─────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  open: "#3b82f6",
  won: "#22c55e",
  lost: "#ef4444",
  abandoned: "#6b7280",
};

const STAGE_COLORS = [
  "#3b82f6", "#06b6d4", "#8b5cf6", "#ec4899",
  "#f59e0b", "#22c55e", "#ef4444", "#6366f1",
];

const TOOLTIP_STYLE = {
  background: "#1a1a1a",
  border: "1px solid #262626",
  borderRadius: "8px",
  color: "#ededed",
};

/* ── Stat Card ─────────────────────────────────────────── */

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
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className={`w-3.5 h-3.5 ${color}`} />}
        <span className="text-xs text-muted">{label}</span>
      </div>
      <span className="text-xl font-bold text-foreground">{value}</span>
    </div>
  );
}

/* ── Widget Card wrapper ───────────────────────────────── */

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

/* ── Main Dashboard ────────────────────────────────────── */

export default function GHLDashboard() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* Fetch pipelines */
  useEffect(() => {
    async function fetchPipelines() {
      try {
        const res = await fetch("/api/ghl/pipelines");
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setPipelines(data.pipelines || []);
        if (data.pipelines?.length > 0) {
          setSelectedPipeline(data.pipelines[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchPipelines();
  }, []);

  /* Fetch opportunities for selected pipeline */
  useEffect(() => {
    if (!selectedPipeline) return;
    async function fetchOpps() {
      try {
        const res = await fetch(
          `/api/ghl/opportunities?pipeline_id=${selectedPipeline}`
        );
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setOpportunities(data.opportunities || []);
      } catch (err) {
        console.error("Failed to fetch opportunities:", err);
      }
    }
    fetchOpps();
  }, [selectedPipeline]);

  /* ── Computed data ─────────────────────────────────── */

  const statusCounts = opportunities.reduce(
    (acc, opp) => {
      const s = opp.status || "open";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const statusData = Object.entries(statusCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: STATUS_COLORS[name] || "#6b7280",
  }));

  const totalValue = opportunities.reduce(
    (sum, o) => sum + (o.monetaryValue || 0), 0
  );
  const wonOpps = opportunities.filter((o) => o.status === "won");
  const lostOpps = opportunities.filter((o) => o.status === "lost");
  const openOpps = opportunities.filter((o) => o.status === "open");
  const abandonedOpps = opportunities.filter((o) => o.status === "abandoned");
  const wonValue = wonOpps.reduce((sum, o) => sum + (o.monetaryValue || 0), 0);
  const conversionRate =
    opportunities.length > 0
      ? Math.round((wonOpps.length / opportunities.length) * 100)
      : 0;

  const currentPipeline = pipelines.find((p) => p.id === selectedPipeline);
  const stageData = (currentPipeline?.stages || []).map((stage) => {
    const stageOpps = opportunities.filter(
      (o) => o.pipelineStageId === stage.id
    );
    const stageValue = stageOpps.reduce(
      (sum, o) => sum + (o.monetaryValue || 0), 0
    );
    return { name: stage.name, count: stageOpps.length, value: stageValue };
  });

  /* Lead source data derived from opportunities */
  const leadSourceMap: Record<string, {
    total: number; value: number; open: number; won: number; lost: number; abandoned: number;
  }> = {};
  opportunities.forEach((opp) => {
    const source = opp.source || "Direct";
    if (!leadSourceMap[source]) {
      leadSourceMap[source] = { total: 0, value: 0, open: 0, won: 0, lost: 0, abandoned: 0 };
    }
    const existing = leadSourceMap[source];
    existing.total++;
    existing.value += opp.monetaryValue || 0;
    if (opp.status === "open") existing.open++;
    if (opp.status === "won") existing.won++;
    if (opp.status === "lost") existing.lost++;
    if (opp.status === "abandoned") existing.abandoned++;
  });
  const leadSourceData = Object.entries(leadSourceMap).map(
    ([source, d]) => ({
      source,
      ...d,
      winRate: d.total > 0 ? Math.round((d.won / d.total) * 100) : 0,
    })
  );

  /* Sales efficiency */
  const totalSaleValue = wonValue;
  let avgSalesDuration = "0s";
  if (wonOpps.length > 0) {
    const totalDays = wonOpps.reduce((sum, o) => {
      if (o.createdAt && o.lastStatusChangeAt) {
        const diff = new Date(o.lastStatusChangeAt).getTime() - new Date(o.createdAt).getTime();
        return sum + diff / (1000 * 60 * 60 * 24);
      }
      return sum;
    }, 0);
    const avg = totalDays / wonOpps.length;
    if (avg >= 1) avgSalesDuration = `${Math.round(avg)}d`;
    else if (avg * 24 >= 1) avgSalesDuration = `${Math.round(avg * 24)}h`;
    else avgSalesDuration = `${Math.round(avg * 24 * 60)}m`;
  }
  const salesVelocity =
    totalSaleValue > 0
      ? `₹${Math.round(totalSaleValue / 30).toLocaleString("en-IN")}/M`
      : "₹0/M";

  /* Placeholder Google Analytics monthly data */
  const gaMonthlyData = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ].map((m) => ({ month: m, visitors: 0, pageViews: 0 }));

  /* ── Render ────────────────────────────────────────── */

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
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-muted text-sm mt-1">GoHighLevel overview</p>
        </div>

        {pipelines.length > 0 && (
          <select
            value={selectedPipeline}
            onChange={(e) => setSelectedPipeline(e.target.value)}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* ── Row 1: Tasks + Manual Actions ──────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tasks */}
        <WidgetCard title="Tasks">
          <div className="grid grid-cols-2 gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <ListChecks className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted">Pending</p>
                <p className="text-2xl font-bold text-foreground">0</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted">Overdue</p>
                <p className="text-2xl font-bold text-foreground">0</p>
              </div>
            </div>
          </div>
        </WidgetCard>

        {/* Manual Actions */}
        <WidgetCard title="Manual Actions">
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted">Phone</p>
                <p className="text-2xl font-bold text-foreground">0</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted">SMS</p>
                <p className="text-2xl font-bold text-foreground">0</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <ListChecks className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted">Total Pending</p>
                <p className="text-2xl font-bold text-foreground">0</p>
              </div>
            </div>
          </div>
        </WidgetCard>
      </div>

      {/* ── Row 2: Lead Source Report ──────────────── */}
      <WidgetCard title="Lead Source Report">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-xs text-muted font-medium">Source</th>
                <th className="text-right py-2 px-3 text-xs text-muted font-medium">Total Leads</th>
                <th className="text-right py-2 px-3 text-xs text-muted font-medium">Total Values</th>
                <th className="text-right py-2 px-3 text-xs text-muted font-medium">Open</th>
                <th className="text-right py-2 px-3 text-xs text-muted font-medium">Won</th>
                <th className="text-right py-2 px-3 text-xs text-muted font-medium">Lost</th>
                <th className="text-right py-2 px-3 text-xs text-muted font-medium">Abandoned</th>
                <th className="text-right py-2 px-3 text-xs text-muted font-medium">Win %</th>
              </tr>
            </thead>
            <tbody>
              {leadSourceData.length > 0 ? (
                leadSourceData.map((row) => (
                  <tr key={row.source} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                    <td className="py-2.5 px-3 text-foreground">{row.source}</td>
                    <td className="py-2.5 px-3 text-right text-foreground">{row.total}</td>
                    <td className="py-2.5 px-3 text-right text-foreground">
                      ₹{row.value.toLocaleString("en-IN")}
                    </td>
                    <td className="py-2.5 px-3 text-right text-blue-400">{row.open}</td>
                    <td className="py-2.5 px-3 text-right text-green-400">{row.won}</td>
                    <td className="py-2.5 px-3 text-right text-red-400">{row.lost}</td>
                    <td className="py-2.5 px-3 text-right text-gray-400">{row.abandoned}</td>
                    <td className="py-2.5 px-3 text-right text-foreground">{row.winRate}%</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted text-sm">
                    No lead source data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </WidgetCard>

      {/* ── Row 3: Google Analytics Report ─────────── */}
      <WidgetCard
        title="Google Analytics Report"
        right={<span className="text-xs text-muted">Last 12 months</span>}
      >
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
          <StatCard label="Total Visitors" value={0} icon={Eye} />
          <StatCard label="Page Views" value={0} icon={Eye} />
          <StatCard label="Direct Views" value={0} icon={Globe} />
          <StatCard label="Paid Views" value={0} icon={MousePointer} />
          <StatCard label="Social Views" value={0} icon={MessageCircle} />
          <StatCard label="Organic Views" value={0} icon={TrendingUp} />
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={gaMonthlyData}>
            <XAxis
              dataKey="month"
              tick={{ fill: "#737373", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#737373", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Line
              type="monotone"
              dataKey="visitors"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="Visitors"
            />
            <Line
              type="monotone"
              dataKey="pageViews"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
              name="Page Views"
            />
            <Legend />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted mt-2 text-center">
          Connect Google Analytics to see real data
        </p>
      </WidgetCard>

      {/* ── Row 4: Google Business Profile ─────────── */}
      <WidgetCard
        title="Google Business Profile"
        right={<span className="text-xs text-muted">Last 30 Days</span>}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <StatCard label="Total views" value={0} icon={Eye} />
          <StatCard label="Search (Desktop & Mobile)" value={0} icon={Globe} />
          <StatCard label="Conversations" value={0} icon={MessageCircle} />
          <StatCard label="Website visits" value={0} icon={ExternalLink} />
          <div /> {/* spacer */}
          <StatCard label="Maps (Desktop & Mobile)" value={0} icon={Map} />
          <StatCard label="Bookings" value={0} icon={CalendarCheck} />
          <StatCard label="Calls" value={0} icon={PhoneCall} />
        </div>
        <p className="text-xs text-muted mt-4 text-center">
          Connect Google Business Profile to see real data
        </p>
      </WidgetCard>

      {/* ── Row 5: Opportunity Status / Value / Conversion ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Opportunity Status */}
        <WidgetCard title="Opportunity Status">
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name} - ${value}`}
                  labelLine={false}
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted text-sm">
              No opportunities yet
            </div>
          )}
        </WidgetCard>

        {/* Opportunity Value */}
        <WidgetCard title="Opportunity Value">
          <div className="text-2xl font-bold text-foreground mb-1">
            ₹{totalValue.toLocaleString("en-IN")}
          </div>
          <p className="text-xs text-muted mb-4">Total revenue</p>
          {stageData.length > 0 ? (
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={stageData}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#737373", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#737373", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) =>
                    `₹${Number(value).toLocaleString("en-IN")}`
                  }
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[150px] flex items-center justify-center text-muted text-sm">
              No data
            </div>
          )}
        </WidgetCard>

        {/* Conversion */}
        <WidgetCard title="Conversion">
          <div className="flex flex-col items-center">
            <div className="relative">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={[
                      { value: conversionRate || 1, color: "#3b82f6" },
                      { value: 100 - (conversionRate || 1), color: "#262626" },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                  >
                    <Cell fill="#3b82f6" />
                    <Cell fill="#262626" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-foreground">
                  {conversionRate}%
                </span>
              </div>
            </div>
            <p className="text-xs text-muted mt-2">
              Won revenue: ₹{wonValue.toLocaleString("en-IN")}
            </p>
          </div>
        </WidgetCard>
      </div>

      {/* ── Row 6: Funnel + Stage Distribution ────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Funnel */}
        <WidgetCard
          title="Funnel"
          right={
            <span className="text-xs text-muted">
              {currentPipeline?.name}
            </span>
          }
        >
          {stageData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stageData} layout="vertical">
                <XAxis
                  type="number"
                  tick={{ fill: "#737373", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "#737373", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={120}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {stageData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={STAGE_COLORS[i % STAGE_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted text-sm">
              No funnel data
            </div>
          )}
        </WidgetCard>

        {/* Stage Distribution */}
        <WidgetCard
          title="Stage Distribution"
          right={
            <span className="text-xs text-muted">
              {currentPipeline?.name}
            </span>
          }
        >
          {stageData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={stageData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="count"
                  label={({ name, value }) => `${name} - ${value}`}
                  labelLine={true}
                >
                  {stageData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={STAGE_COLORS[i % STAGE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted text-sm">
              No stage data
            </div>
          )}
        </WidgetCard>
      </div>

      {/* ── Row 7: Facebook Ads + Google Ads ──────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Facebook Ads Report */}
        <WidgetCard title="Facebook Ads Report">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-muted mb-1">Total Clicks</p>
              <p className="text-2xl font-bold text-foreground">0</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">Total Spent</p>
              <p className="text-2xl font-bold text-foreground">₹0</p>
            </div>
            <div>
              <p className="text-xs text-blue-400 mb-1">CPC</p>
              <p className="text-2xl font-bold text-foreground">₹0</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">CTR</p>
              <p className="text-2xl font-bold text-foreground">0%</p>
            </div>
          </div>
          <p className="text-xs text-muted mt-4 text-center">
            Connect Facebook Ads to see real data
          </p>
        </WidgetCard>

        {/* Google Ads Report */}
        <WidgetCard title="Google Ads Report">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-muted mb-1">Total Clicks</p>
              <p className="text-2xl font-bold text-foreground">0</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">Total Spent</p>
              <p className="text-2xl font-bold text-foreground">₹0</p>
            </div>
            <div>
              <p className="text-xs text-blue-400 mb-1">CPC</p>
              <p className="text-2xl font-bold text-foreground">₹0</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">CTR</p>
              <p className="text-2xl font-bold text-foreground">0%</p>
            </div>
          </div>
          <p className="text-xs text-muted mt-4 text-center">
            Connect Google Ads to see real data
          </p>
        </WidgetCard>
      </div>

      {/* ── Row 8: Sales Efficiency ───────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WidgetCard
          title="Sales Efficiency"
          right={
            <div className="flex gap-2">
              <select className="px-2 py-1 bg-surface border border-border rounded text-xs text-foreground focus:outline-none">
                <option>All Pipelines</option>
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          }
        >
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-accent" />
                <p className="text-xs text-muted">Average Sales Duration</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{avgSalesDuration}</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <IndianRupee className="w-3.5 h-3.5 text-green-400" />
                <p className="text-xs text-muted">Total Sale Value</p>
              </div>
              <p className="text-2xl font-bold text-foreground">
                ₹{totalSaleValue.toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <p className="text-xs text-muted">Sales Velocity</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{salesVelocity}</p>
            </div>
          </div>
        </WidgetCard>
      </div>
    </div>
  );
}
