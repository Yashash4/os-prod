"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
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
  ImageIcon,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Trophy,
  Wallet,
} from "lucide-react";
import { MetaDashboardSkeleton } from "@/components/Skeleton";
import { apiFetch } from "@/lib/api-fetch";
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
  // campaign-level fields
  campaign_id?: string;
  campaign_name?: string;
}

interface AdMeta {
  id: string;
  name: string;
  status: string;
  creative?: {
    title?: string;
    body?: string;
    image_url?: string;
    thumbnail_url?: string;
  };
}

interface BulkAdInsight {
  ad_id?: string;
  ad_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  actions?: { action_type: string; value: string }[];
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
  background: "#171717",
  border: "1px solid #262626",
  borderRadius: "8px",
  color: "#F5F5F5",
};

const COLORS = [
  "#B8860B", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
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

function getConversions(actions?: { action_type: string; value: string }[]) {
  if (!actions) return 0;
  const purchase = actions.find((a) => a.action_type === "purchase");
  if (purchase) return parseInt(purchase.value);
  const lead = actions.find((a) => a.action_type === "lead");
  if (lead) return parseInt(lead.value);
  return 0;
}

/* ── Reusable Components ──────────────────────────── */

function DeltaIndicator({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  if (!previous || previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const isPositive = invert ? pct < 0 : pct > 0;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-medium ${isPositive ? "text-green-400" : "text-red-400"}`}>
      {pct > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color = "text-accent",
  prevValue,
  invert,
}: {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  color?: string;
  prevValue?: number;
  currentNum?: number;
  invert?: boolean;
}) {
  return (
    <div className="card rounded-xl p-4 transition-all">
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon className={`w-3.5 h-3.5 ${color}`} />}
        <span className="text-[10px] text-muted uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-xl font-bold text-foreground">{value}</span>
      {prevValue !== undefined && typeof value === "string" && (
        <DeltaIndicator current={parseFloat(value.replace(/[₹,%x]/g, "").replace(/,/g, ""))} previous={prevValue} invert={invert} />
      )}
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
    <div className="card rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-foreground tracking-wide">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

/* ── Main Dashboard ────────────────────────────────── */

export default function MetaDashboard() {
  const [datePreset, setDatePreset] = useState("last_30d");
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [campaignBulk, setCampaignBulk] = useState<InsightRow[]>([]);
  const [ageData, setAgeData] = useState<InsightRow[]>([]);
  const [genderData, setGenderData] = useState<InsightRow[]>([]);
  const [platformData, setPlatformData] = useState<InsightRow[]>([]);
  const [deviceData, setDeviceData] = useState<InsightRow[]>([]);
  const [adsMeta, setAdsMeta] = useState<AdMeta[]>([]);
  const [adInsightsBulk, setAdInsightsBulk] = useState<BulkAdInsight[]>([]);
  const [compareData, setCompareData] = useState<{ current: InsightRow[]; previous: InsightRow[] }>({ current: [], previous: [] });
  const [anomalies, setAnomalies] = useState<{ campaign_name: string; metric: string; value: number; mean: number; direction: string }[]>([]);
  const [topBottom, setTopBottom] = useState<{ top: InsightRow[]; bottom: InsightRow[]; metric: string }>({ top: [], bottom: [], metric: "spend" });
  const [forecast, setForecast] = useState<{ avg_daily_spend: number; projected_monthly_spend: number; days_remaining: number } | null>(null);
  const [budgetPlans, setBudgetPlans] = useState<{ planned_budget: number; actual_spend: number }[]>([]);
  const [tbMetric, setTbMetric] = useState("spend");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ── Fetch all data ────────────────────────────── */
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setError("");
      try {
        const [insRes, campBulkRes, ageRes, genderRes, platRes, devRes, adsMetaRes, adBulkRes] = await Promise.all([
          apiFetch(`/api/meta/account-insights?date_preset=${datePreset}&time_increment=1`),
          apiFetch(`/api/meta/campaign-insights-bulk?date_preset=${datePreset}`),
          apiFetch(`/api/meta/breakdowns?breakdown=age&date_preset=${datePreset}`),
          apiFetch(`/api/meta/breakdowns?breakdown=gender&date_preset=${datePreset}`),
          apiFetch(`/api/meta/breakdowns?breakdown=publisher_platform&date_preset=${datePreset}`),
          apiFetch(`/api/meta/breakdowns?breakdown=impression_device&date_preset=${datePreset}`),
          apiFetch(`/api/meta/ads`),
          apiFetch(`/api/meta/ad-insights-bulk?date_preset=${datePreset}`),
        ]);

        const [insData, campBulkData, ageD, genderD, platD, devD, adsMetaData, adBulkData] = await Promise.all([
          insRes.json(),
          campBulkRes.json(),
          ageRes.json(),
          genderRes.json(),
          platRes.json(),
          devRes.json(),
          adsMetaRes.json(),
          adBulkRes.json(),
        ]);

        if (insData.error) throw new Error(insData.error);

        setInsights(insData.insights || []);
        setCampaignBulk(campBulkData.insights || []);
        setAgeData(ageD.data || []);
        setGenderData(genderD.data || []);
        setPlatformData(platD.data || []);
        setDeviceData(devD.data || []);
        setAdsMeta(adsMetaData.ads || []);
        setAdInsightsBulk(adBulkData.insights || []);

        // Fetch enhanced widgets (non-blocking)
        Promise.all([
          apiFetch(`/api/meta/account-insights-compare?date_preset=${datePreset}&compare_preset=yesterday`).then(r => r.json()).catch(() => null),
          apiFetch(`/api/meta/anomaly-detection`).then(r => r.json()).catch(() => null),
          apiFetch(`/api/meta/top-bottom?metric=${tbMetric}&date_preset=${datePreset}`).then(r => r.json()).catch(() => null),
          apiFetch(`/api/meta/spend-forecast`).then(r => r.json()).catch(() => null),
          apiFetch(`/api/meta/budget-plans`).then(r => r.json()).catch(() => null),
        ]).then(([cmp, anom, tb, fc, bp]) => {
          if (cmp) setCompareData({ current: cmp.current || [], previous: cmp.previous || [] });
          if (anom) setAnomalies(anom.anomalies || []);
          if (tb) setTopBottom({ top: tb.top || [], bottom: tb.bottom || [], metric: tb.metric || "spend" });
          if (fc) setForecast(fc);
          if (bp) setBudgetPlans(bp.plans || []);
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [datePreset]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Re-fetch top/bottom when metric changes ── */
  useEffect(() => {
    apiFetch(`/api/meta/top-bottom?metric=${tbMetric}&date_preset=${datePreset}`)
      .then(r => r.json())
      .then(data => {
        if (data) setTopBottom({ top: data.top || [], bottom: data.bottom || [], metric: data.metric || tbMetric });
      })
      .catch(() => {});
  }, [tbMetric, datePreset]);

  /* ── Campaign list for filter ────────────────── */
  const campaignList = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    campaignBulk.forEach((r) => {
      const cid = r.campaign_id;
      const name = r.campaign_name;
      if (cid && name && !seen.has(cid)) {
        seen.add(cid);
        result.push({ id: cid, name });
      }
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [campaignBulk]);

  /* ── Filter campaign bulk data ────────────────── */
  const filteredCampaignBulk = useMemo(() => {
    if (!selectedCampaign) return campaignBulk;
    return campaignBulk.filter((r) => r.campaign_id === selectedCampaign);
  }, [campaignBulk, selectedCampaign]);

  /* ── Aggregated KPIs ───────────────────────────── */
  const totals = useMemo(() => {
    const source = selectedCampaign ? filteredCampaignBulk : insights;
    let spend = 0, impressions = 0, clicks = 0, reach = 0;
    let purchases = 0, purchaseValue = 0, leads = 0;

    source.forEach((row) => {
      spend += num(row.spend);
      impressions += num(row.impressions);
      clicks += num(row.clicks);
      reach += num(row.reach);
      purchases += getActionValue(row.actions, "purchase");
      purchaseValue += getActionValue(row.action_values, "purchase");
      leads += getActionValue(row.actions, "lead");
    });

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    const roas = spend > 0 ? purchaseValue / spend : 0;
    const frequency = reach > 0 ? impressions / reach : 0;

    return { spend, impressions, clicks, reach, ctr, cpc, cpm, roas, frequency, purchases, purchaseValue, leads };
  }, [insights, filteredCampaignBulk, selectedCampaign]);

  /* ── Previous period totals for comparison ──── */
  const prevTotals = useMemo(() => {
    const source = compareData.previous;
    if (!source.length) return null;
    let spend = 0, impressions = 0, clicks = 0, reach = 0;
    source.forEach((row) => {
      spend += num(row.spend);
      impressions += num(row.impressions);
      clicks += num(row.clicks);
      reach += num(row.reach);
    });
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    return { spend, impressions, clicks, reach, ctr, cpc, cpm };
  }, [compareData.previous]);

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
    return filteredCampaignBulk
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
  }, [filteredCampaignBulk]);

  /* ── Top performing creatives ──────────────────── */
  const topCreatives = useMemo(() => {
    const adMetaMap: Record<string, AdMeta> = {};
    adsMeta.forEach((ad) => { if (ad.id) adMetaMap[ad.id] = ad; });

    return adInsightsBulk
      .filter((row) => row.ad_id && adMetaMap[row.ad_id]?.creative)
      .map((row) => {
        const meta = adMetaMap[row.ad_id!];
        return {
          id: row.ad_id!,
          name: row.ad_name || meta.name || row.ad_id!,
          creative: meta.creative!,
          spend: num(row.spend),
          clicks: num(row.clicks),
          ctr: num(row.ctr),
          conversions: getConversions(row.actions),
        };
      })
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);
  }, [adsMeta, adInsightsBulk]);

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

  /* ── Acquisition Funnel ─────────────────────────── */
  const funnelSteps = useMemo(() => {
    const steps = [
      { label: "Impressions", value: totals.impressions, cost: totals.spend },
      { label: "Clicks", value: totals.clicks, cost: totals.clicks > 0 ? totals.spend / totals.clicks : 0 },
      { label: "Leads", value: totals.leads, cost: totals.leads > 0 ? totals.spend / totals.leads : 0 },
      { label: "Purchases", value: totals.purchases, cost: totals.purchases > 0 ? totals.spend / totals.purchases : 0 },
    ];
    return steps.map((step, i) => ({
      ...step,
      convRate: i === 0 ? 100 : steps[i - 1].value > 0 ? (step.value / steps[i - 1].value) * 100 : 0,
    }));
  }, [totals]);

  /* ── Render ────────────────────────────────────── */

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <h1 className="text-xl font-bold text-foreground tracking-tight">Meta Ads Dashboard</h1>
        </div>
        <MetaDashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Meta Ads Dashboard</h1>
            <p className="text-muted text-xs mt-0.5">Facebook & Instagram Analytics</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Read Only
          </span>
          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent max-w-[200px]"
          >
            <option value="">All Campaigns</option>
            {campaignList.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
            className="px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
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

      {/* ── KPI Cards with comparison ────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard label="Total Spend" value={currency(totals.spend)} icon={IndianRupee} color="text-green-400" prevValue={prevTotals?.spend} invert />
        <StatCard label="Impressions" value={compact(totals.impressions)} icon={Eye} color="text-blue-400" prevValue={prevTotals?.impressions} />
        <StatCard label="Clicks" value={compact(totals.clicks)} icon={MousePointer} color="text-blue-400" prevValue={prevTotals?.clicks} />
        <StatCard label="Reach" value={compact(totals.reach)} icon={Users} color="text-purple-400" prevValue={prevTotals?.reach} />
        <StatCard label="CTR" value={`${totals.ctr.toFixed(2)}%`} icon={TrendingUp} color="text-amber-400" prevValue={prevTotals?.ctr} />
        <StatCard label="CPC" value={currency(totals.cpc)} icon={Target} color="text-red-400" prevValue={prevTotals?.cpc} invert />
        <StatCard label="CPM" value={currency(totals.cpm)} icon={BarChart3} color="text-pink-400" prevValue={prevTotals?.cpm} invert />
        <StatCard label="ROAS" value={`${totals.roas.toFixed(2)}x`} icon={Repeat} color="text-emerald-400" />
      </div>

      {/* ── Budget Burn + Anomalies + Top/Bottom ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Budget Burn Tracker */}
        <WidgetCard title="Monthly Budget" right={<Wallet className="w-4 h-4 text-accent" />}>
          {(() => {
            const totalPlanned = budgetPlans.reduce((s, p) => s + Number(p.planned_budget || 0), 0);
            const totalSpent = budgetPlans.reduce((s, p) => s + Number(p.actual_spend || 0), 0) || totals.spend;
            const projected = forecast?.projected_monthly_spend || 0;
            const pct = totalPlanned > 0 ? (totalSpent / totalPlanned) * 100 : 0;
            const barColor = pct > 120 ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-green-500";
            return (
              <div className="space-y-3">
                <div className="flex justify-between text-xs text-muted">
                  <span>Spent: {currency(totalSpent)}</span>
                  <span>Planned: {totalPlanned > 0 ? currency(totalPlanned) : "Not set"}</span>
                </div>
                {totalPlanned > 0 && (
                  <div className="h-2 bg-background/50 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                )}
                {projected > 0 && (
                  <p className="text-[10px] text-muted">
                    Projected: {currency(projected)} ({forecast?.days_remaining} days left)
                  </p>
                )}
              </div>
            );
          })()}
        </WidgetCard>

        {/* Anomaly Alerts */}
        <WidgetCard title="Anomaly Alerts" right={<AlertTriangle className="w-4 h-4 text-amber-400" />}>
          {anomalies.length === 0 ? (
            <p className="text-xs text-muted">No anomalies detected</p>
          ) : (
            <div className="space-y-2 max-h-[180px] overflow-y-auto">
              {anomalies.slice(0, 5).map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.direction === "above" ? "bg-red-400" : "bg-amber-400"}`} />
                  <div>
                    <p className="text-foreground font-medium">{a.campaign_name}</p>
                    <p className="text-muted">
                      {a.metric.toUpperCase()}: {typeof a.value === "number" ? a.value.toFixed(2) : a.value} (avg: {a.mean.toFixed(2)})
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </WidgetCard>

        {/* Top/Bottom Performers */}
        <WidgetCard
          title="Top & Bottom"
          right={
            <select
              value={tbMetric}
              onChange={(e) => setTbMetric(e.target.value)}
              className="text-xs bg-background/50 border border-border rounded px-2 py-1 text-foreground"
            >
              <option value="spend">Spend</option>
              <option value="ctr">CTR</option>
              <option value="cpc">CPC</option>
              <option value="roas">ROAS</option>
            </select>
          }
        >
          <div className="space-y-1 max-h-[180px] overflow-y-auto">
            {topBottom.top.slice(0, 3).map((item, i) => (
              <div key={`t-${i}`} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-3 h-3 text-green-400" />
                  <span className="text-foreground truncate max-w-[120px]">{(item as Record<string, string>).campaign_name || (item as Record<string, string>).ad_name || "Unknown"}</span>
                </div>
                <span className="text-green-400 font-medium">
                  {tbMetric === "spend" ? currency(num((item as Record<string, string>).spend)) : num((item as Record<string, string>)[tbMetric]).toFixed(2)}
                </span>
              </div>
            ))}
            {topBottom.bottom.slice(0, 3).map((item, i) => (
              <div key={`b-${i}`} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <ArrowDownRight className="w-3 h-3 text-red-400" />
                  <span className="text-foreground truncate max-w-[120px]">{(item as Record<string, string>).campaign_name || (item as Record<string, string>).ad_name || "Unknown"}</span>
                </div>
                <span className="text-red-400 font-medium">
                  {tbMetric === "spend" ? currency(num((item as Record<string, string>).spend)) : num((item as Record<string, string>)[tbMetric]).toFixed(2)}
                </span>
              </div>
            ))}
            {topBottom.top.length === 0 && <p className="text-xs text-muted">No data</p>}
          </div>
        </WidgetCard>
      </div>

      {/* ── Top Performing Creatives ─────────────── */}
      {topCreatives.length > 0 && (
        <WidgetCard
          title="Top Performing Creatives"
          right={
            <Link href="/m/marketing/meta/ads" className="text-xs text-accent hover:underline">
              View All Ads →
            </Link>
          }
        >
          <div className="flex gap-3 overflow-x-auto pb-1">
            {topCreatives.map((ad) => {
              const imgUrl = ad.creative.thumbnail_url || ad.creative.image_url;
              return (
                <div key={ad.id} className="flex-shrink-0 w-[200px] bg-background/50 rounded-lg border border-border/50 overflow-hidden">
                  <div className="h-20 bg-background flex items-center justify-center overflow-hidden">
                    {imgUrl ? (
                      <img src={imgUrl} alt={ad.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-muted/30" />
                    )}
                  </div>
                  <div className="p-2 space-y-1">
                    <p className="text-xs text-foreground font-medium truncate">{ad.name}</p>
                    {ad.creative.title && (
                      <p className="text-[10px] text-muted truncate">{ad.creative.title}</p>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-muted pt-1 border-t border-border/30">
                      <span>{currency(ad.spend)}</span>
                      <span>{ad.clicks} clicks</span>
                      <span>{ad.ctr.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </WidgetCard>
      )}

      {/* ── Customer Acquisition Funnel ──────────── */}
      <WidgetCard title="Customer Acquisition Funnel">
        <div className="flex items-end justify-center gap-1 h-[180px]">
          {funnelSteps.map((step, i) => {
            const maxVal = funnelSteps[0].value || 1;
            const widthPct = Math.max(((funnelSteps.length - i) / funnelSteps.length) * 100, 30);
            return (
              <div key={step.label} className="flex flex-col items-center flex-1">
                <div className="text-center mb-2">
                  <p className="text-lg font-bold text-foreground">{compact(step.value)}</p>
                  <p className="text-[10px] text-muted">{step.label}</p>
                  {i > 0 && (
                    <p className="text-[10px] text-accent">{step.convRate.toFixed(1)}% conv.</p>
                  )}
                  {i > 0 && step.cost > 0 && (
                    <p className="text-[10px] text-muted">Cost: {currency(step.cost)}</p>
                  )}
                </div>
                <div
                  className="rounded-t-lg transition-all"
                  style={{
                    width: `${widthPct}%`,
                    height: `${Math.max((step.value / maxVal) * 100, 8)}px`,
                    background: COLORS[i],
                    minHeight: "8px",
                    maxHeight: "80px",
                  }}
                />
              </div>
            );
          })}
        </div>
      </WidgetCard>

      {/* ── Row 1: Spend Over Time + Performance Trend ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WidgetCard title="Spend Over Time">
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyData}>
                <XAxis dataKey="date" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                <Line type="monotone" dataKey="spend" stroke="#B8860B" strokeWidth={2} dot={false} name="Spend" />
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
                <XAxis dataKey="date" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
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
                <XAxis type="number" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} width={140} />
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
                <XAxis dataKey="name" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
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
                <XAxis dataKey="name" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
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
