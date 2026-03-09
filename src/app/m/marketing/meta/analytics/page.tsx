"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Loader2,
  PieChart as PieChartIcon,
  IndianRupee,
  Eye,
  MousePointer,
  Users,
  TrendingUp,
  Target,
  BarChart3,
  Search,
  ImageIcon,
  Layers,
  Megaphone,
  Download,
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
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  ZAxis,
  CartesianGrid,
} from "recharts";
import { MetaAnalyticsSkeleton } from "@/components/Skeleton";
import { apiFetch } from "@/lib/api-fetch";

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
  age?: string;
  gender?: string;
  publisher_platform?: string;
  impression_device?: string;
  country?: string;
}

interface CampaignBulkRow {
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  ctr?: string;
  cpc?: string;
  actions?: { action_type: string; value: string }[];
  purchase_roas?: { action_type: string; value: string }[];
}

interface AdSetBulkRow {
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: { action_type: string; value: string }[];
}

interface AdBulkRow {
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  campaign_id?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: { action_type: string; value: string }[];
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
    video_id?: string;
  };
  adset_id?: string;
  campaign_id?: string;
}

interface AdSetMeta {
  id: string;
  name: string;
  status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  campaign_id?: string;
}

interface AggRow {
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  convRate: number;
  costPerConv: number;
  frequency: number;
}

/* ── CSV Export ────────────────────────────────────── */

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

const TOP_TABS = [
  { label: "Overview", value: "overview", icon: BarChart3 },
  { label: "Ad Set Analysis", value: "adset", icon: Layers },
  { label: "Ad Analysis", value: "ad", icon: Megaphone },
];

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

function getBreakdownLabel(row: InsightRow, breakdown: string) {
  const val = (row as Record<string, unknown>)[breakdown] as string | undefined;
  if (!val) return "Unknown";
  if (breakdown === "gender") {
    return val === "male" ? "Male" : val === "female" ? "Female" : val;
  }
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getConversions(actions?: { action_type: string; value: string }[]) {
  if (!actions) return 0;
  const purchase = actions.find((a) => a.action_type === "purchase");
  if (purchase) return parseInt(purchase.value);
  const lead = actions.find((a) => a.action_type === "lead");
  if (lead) return parseInt(lead.value);
  return 0;
}

function getActionValue(actions: { action_type: string; value: string }[] | undefined, type: string) {
  if (!actions) return 0;
  const a = actions.find((x) => x.action_type === type);
  return a ? parseInt(a.value) : 0;
}

function statusBadge(status: string) {
  const s = status.toUpperCase();
  if (s === "ACTIVE") return "bg-green-500/15 text-green-400 border-green-500/30";
  if (s === "PAUSED") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-gray-500/15 text-gray-400 border-gray-500/30";
}

function aggregate(data: InsightRow[], breakdown: string): AggRow[] {
  const map: Record<string, { spend: number; impressions: number; clicks: number; reach: number; conversions: number }> = {};
  data.forEach((row) => {
    const label = getBreakdownLabel(row, breakdown);
    if (!map[label]) map[label] = { spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0 };
    map[label].spend += num(row.spend);
    map[label].impressions += num(row.impressions);
    map[label].clicks += num(row.clicks);
    map[label].reach += num(row.reach);
    map[label].conversions += getConversions(row.actions);
  });
  return Object.entries(map)
    .map(([name, d]) => ({
      name,
      spend: parseFloat(d.spend.toFixed(2)),
      impressions: d.impressions,
      clicks: d.clicks,
      reach: d.reach,
      conversions: d.conversions,
      ctr: d.impressions > 0 ? parseFloat(((d.clicks / d.impressions) * 100).toFixed(2)) : 0,
      cpc: d.clicks > 0 ? parseFloat((d.spend / d.clicks).toFixed(2)) : 0,
      cpm: d.impressions > 0 ? parseFloat(((d.spend / d.impressions) * 1000).toFixed(2)) : 0,
      convRate: d.clicks > 0 ? parseFloat(((d.conversions / d.clicks) * 100).toFixed(2)) : 0,
      costPerConv: d.conversions > 0 ? parseFloat((d.spend / d.conversions).toFixed(2)) : 0,
      frequency: d.reach > 0 ? parseFloat((d.impressions / d.reach).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.spend - a.spend);
}

/* ── Reusable Components ──────────────────────────── */

function StatCard({ label, value, icon: Icon, color = "text-accent" }: {
  label: string; value: string | number; icon?: React.ElementType; color?: string;
}) {
  return (
    <div className="card rounded-xl p-3 transition-all">
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon className={`w-3.5 h-3.5 ${color}`} />}
        <span className="text-[10px] text-muted uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-lg font-bold text-foreground">{value}</span>
    </div>
  );
}

/* ── Main Component ────────────────────────────────── */

export default function AnalyticsPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[80vh]"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>}>
      <AnalyticsPage />
    </Suspense>
  );
}

function AnalyticsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const topTab = searchParams.get("tab") || "overview";
  const setTopTab = (tab: string) => router.push(`/m/marketing/meta/analytics?tab=${tab}`, { scroll: false });
  const [activeBreakdown, setActiveBreakdown] = useState("age");
  const [datePreset, setDatePreset] = useState("last_30d");
  const [breakdownData, setBreakdownData] = useState<Record<string, InsightRow[]>>({});
  const [campaignData, setCampaignData] = useState<CampaignBulkRow[]>([]);
  const [adsetInsights, setAdsetInsights] = useState<AdSetBulkRow[]>([]);
  const [adsetMeta, setAdsetMeta] = useState<AdSetMeta[]>([]);
  const [adInsights, setAdInsights] = useState<AdBulkRow[]>([]);
  const [adMeta, setAdMeta] = useState<AdMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [adsetLoading, setAdsetLoading] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [adsetLoaded, setAdsetLoaded] = useState("");
  const [adLoaded, setAdLoaded] = useState("");
  const [error, setError] = useState("");

  // Filters for Ad Set Analysis
  const [adsetSearch, setAdsetSearch] = useState("");
  const [adsetStatus, setAdsetStatus] = useState("ALL");
  const [adsetCampaign, setAdsetCampaign] = useState("");

  // Filters for Ad Analysis
  const [adSearch, setAdSearch] = useState("");
  const [adStatus, setAdStatus] = useState("ALL");
  const [adCampaign, setAdCampaign] = useState("");

  // Fetch overview data (breakdowns + campaigns)
  useEffect(() => {
    async function fetchOverview() {
      setLoading(true);
      setError("");
      try {
        const [ageRes, genderRes, platRes, devRes, countryRes, campRes] = await Promise.all([
          apiFetch(`/api/meta/breakdowns?breakdown=age&date_preset=${datePreset}`),
          apiFetch(`/api/meta/breakdowns?breakdown=gender&date_preset=${datePreset}`),
          apiFetch(`/api/meta/breakdowns?breakdown=publisher_platform&date_preset=${datePreset}`),
          apiFetch(`/api/meta/breakdowns?breakdown=impression_device&date_preset=${datePreset}`),
          apiFetch(`/api/meta/breakdowns?breakdown=country&date_preset=${datePreset}`),
          apiFetch(`/api/meta/campaign-insights-bulk?date_preset=${datePreset}`),
        ]);
        const [ageD, genderD, platD, devD, countryD, campD] = await Promise.all([
          ageRes.json(), genderRes.json(), platRes.json(), devRes.json(), countryRes.json(), campRes.json(),
        ]);

        setBreakdownData({
          age: ageD.data || [],
          gender: genderD.data || [],
          publisher_platform: platD.data || [],
          impression_device: devD.data || [],
          country: countryD.data || [],
        });
        setCampaignData(campD.insights || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchOverview();
    // Reset lazy-load flags when date changes
    setAdsetLoaded("");
    setAdLoaded("");
  }, [datePreset]);

  // Lazy-load ad set data when tab is selected
  useEffect(() => {
    if (topTab !== "adset" || adsetLoaded === datePreset || adsetLoading) return;
    async function fetchAdsetData() {
      setAdsetLoading(true);
      try {
        const [insRes, metaRes] = await Promise.all([
          apiFetch(`/api/meta/adset-insights-bulk?date_preset=${datePreset}`),
          apiFetch(`/api/meta/adsets`),
        ]);
        const [insD, metaD] = await Promise.all([insRes.json(), metaRes.json()]);
        setAdsetInsights(insD.insights || []);
        setAdsetMeta(metaD.adsets || []);
        setAdsetLoaded(datePreset);
      } catch {
        // silent — table will show empty
      } finally {
        setAdsetLoading(false);
      }
    }
    fetchAdsetData();
  }, [topTab, datePreset, adsetLoaded, adsetLoading]);

  // Lazy-load ad data when tab is selected
  useEffect(() => {
    if (topTab !== "ad" || adLoaded === datePreset || adLoading) return;
    async function fetchAdData() {
      setAdLoading(true);
      try {
        const [insRes, metaRes] = await Promise.all([
          apiFetch(`/api/meta/ad-insights-bulk?date_preset=${datePreset}`),
          apiFetch(`/api/meta/ads`),
        ]);
        const [insD, metaD] = await Promise.all([insRes.json(), metaRes.json()]);
        setAdInsights(insD.insights || []);
        setAdMeta(metaD.ads || []);
        setAdLoaded(datePreset);
      } catch {
        // silent
      } finally {
        setAdLoading(false);
      }
    }
    fetchAdData();
  }, [topTab, datePreset, adLoaded, adLoading]);

  /* ── Overview aggregated data ──────────────── */
  const currentData = breakdownData[activeBreakdown] || [];
  const aggregated = useMemo(() => aggregate(currentData, activeBreakdown), [currentData, activeBreakdown]);
  const totalSpend = useMemo(() => aggregated.reduce((s, r) => s + r.spend, 0), [aggregated]);
  const totalImpressions = useMemo(() => aggregated.reduce((s, r) => s + r.impressions, 0), [aggregated]);
  const totalClicks = useMemo(() => aggregated.reduce((s, r) => s + r.clicks, 0), [aggregated]);
  const totalReach = useMemo(() => aggregated.reduce((s, r) => s + r.reach, 0), [aggregated]);
  const totalConversions = useMemo(() => aggregated.reduce((s, r) => s + r.conversions, 0), [aggregated]);

  const allSummary = useMemo(() => {
    const all: Record<string, AggRow[]> = {};
    BREAKDOWNS.forEach((b) => {
      const data = breakdownData[b.value] || [];
      if (data.length > 0) all[b.value] = aggregate(data, b.value);
    });
    return all;
  }, [breakdownData]);

  const topPerformers = useMemo(() => {
    return BREAKDOWNS.map((b) => {
      const rows = allSummary[b.value] || [];
      const best = rows.length > 0 ? rows.reduce((a, c) => c.ctr > a.ctr ? c : a, rows[0]) : null;
      return { breakdown: b.label, best };
    }).filter((t) => t.best);
  }, [allSummary]);

  const campaignAgg = useMemo(() => {
    return campaignData
      .filter((c) => num(c.spend) > 0)
      .map((c) => ({
        name: (c.campaign_name || "Unknown").length > 20 ? (c.campaign_name || "").slice(0, 20) + "…" : (c.campaign_name || "Unknown"),
        fullName: c.campaign_name || "Unknown",
        id: c.campaign_id || "",
        spend: num(c.spend),
        clicks: num(c.clicks),
        ctr: num(c.ctr),
        cpc: num(c.cpc),
        conversions: getConversions(c.actions),
        roas: c.purchase_roas?.[0] ? parseFloat(c.purchase_roas[0].value) : 0,
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10);
  }, [campaignData]);

  const radarData = useMemo(() => {
    if (aggregated.length === 0) return [];
    const maxCtr = Math.max(...aggregated.map((r) => r.ctr), 1);
    const maxConvRate = Math.max(...aggregated.map((r) => r.convRate), 1);
    const maxFreq = Math.max(...aggregated.map((r) => r.frequency), 1);
    const maxCpc = Math.max(...aggregated.map((r) => r.cpc), 1);
    const maxCpm = Math.max(...aggregated.map((r) => r.cpm), 1);
    return aggregated.slice(0, 6).map((r) => ({
      name: r.name,
      CTR: parseFloat(((r.ctr / maxCtr) * 100).toFixed(1)),
      "Conv Rate": parseFloat(((r.convRate / maxConvRate) * 100).toFixed(1)),
      Frequency: parseFloat(((r.frequency / maxFreq) * 100).toFixed(1)),
      "CPC Efficiency": parseFloat((((maxCpc - r.cpc) / maxCpc) * 100).toFixed(1)),
      "CPM Efficiency": parseFloat((((maxCpm - r.cpm) / maxCpm) * 100).toFixed(1)),
    }));
  }, [aggregated]);

  const useBarForSpend = activeBreakdown === "age" || activeBreakdown === "impression_device" || activeBreakdown === "country";

  /* ── Ad Set Analysis data ──────────────────── */
  const adsetStatusMap = useMemo(() => {
    const m: Record<string, AdSetMeta> = {};
    adsetMeta.forEach((a) => { if (a.id) m[a.id] = a; });
    return m;
  }, [adsetMeta]);

  const campaignNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    campaignData.forEach((c) => { if (c.campaign_id) m[c.campaign_id] = c.campaign_name || c.campaign_id; });
    return m;
  }, [campaignData]);

  const adsetCampaigns = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    adsetInsights.forEach((r) => {
      const cid = r.campaign_id;
      if (cid && !seen.has(cid)) {
        seen.add(cid);
        result.push({ id: cid, name: campaignNameMap[cid] || cid });
      }
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [adsetInsights, campaignNameMap]);

  const mergedAdsets = useMemo(() => {
    return adsetInsights.map((row) => {
      const meta = adsetStatusMap[row.adset_id || ""];
      return {
        ...row,
        status: meta?.status || "UNKNOWN",
        daily_budget: meta?.daily_budget,
        lifetime_budget: meta?.lifetime_budget,
      };
    });
  }, [adsetInsights, adsetStatusMap]);

  const filteredAdsets = useMemo(() => {
    let rows = mergedAdsets;
    if (adsetCampaign) rows = rows.filter((r) => r.campaign_id === adsetCampaign);
    if (adsetStatus !== "ALL") rows = rows.filter((r) => (r.status || "").toUpperCase() === adsetStatus);
    if (adsetSearch.trim()) {
      const q = adsetSearch.toLowerCase();
      rows = rows.filter((r) => (r.adset_name || "").toLowerCase().includes(q));
    }
    return [...rows].sort((a, b) => num(b.spend) - num(a.spend));
  }, [mergedAdsets, adsetCampaign, adsetStatus, adsetSearch]);

  const adsetTotals = useMemo(() => {
    const t = { spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0 };
    filteredAdsets.forEach((r) => {
      t.spend += num(r.spend);
      t.impressions += num(r.impressions);
      t.clicks += num(r.clicks);
      t.reach += num(r.reach);
      t.conversions += getConversions(r.actions);
    });
    return t;
  }, [filteredAdsets]);

  const adsetStatusCounts = useMemo(() => {
    const c: Record<string, number> = { ALL: mergedAdsets.length, ACTIVE: 0, PAUSED: 0 };
    mergedAdsets.forEach((r) => {
      const s = (r.status || "").toUpperCase();
      if (s === "ACTIVE") c.ACTIVE++;
      else if (s === "PAUSED") c.PAUSED++;
    });
    return c;
  }, [mergedAdsets]);

  /* ── Ad Analysis data ──────────────────────── */
  const adMetaMap = useMemo(() => {
    const m: Record<string, AdMeta> = {};
    adMeta.forEach((a) => { if (a.id) m[a.id] = a; });
    return m;
  }, [adMeta]);

  const adsetNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    adsetInsights.forEach((r) => { if (r.adset_id) m[r.adset_id] = r.adset_name || r.adset_id; });
    return m;
  }, [adsetInsights]);

  const adCampaigns = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    adInsights.forEach((r) => {
      const cid = r.campaign_id;
      if (cid && !seen.has(cid)) {
        seen.add(cid);
        result.push({ id: cid, name: campaignNameMap[cid] || cid });
      }
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [adInsights, campaignNameMap]);

  const mergedAds = useMemo(() => {
    return adInsights.map((row) => {
      const meta = adMetaMap[row.ad_id || ""];
      return {
        ...row,
        status: meta?.status || "UNKNOWN",
        creative: meta?.creative,
      };
    });
  }, [adInsights, adMetaMap]);

  const filteredAds = useMemo(() => {
    let rows = mergedAds;
    if (adCampaign) rows = rows.filter((r) => r.campaign_id === adCampaign);
    if (adStatus !== "ALL") rows = rows.filter((r) => (r.status || "").toUpperCase() === adStatus);
    if (adSearch.trim()) {
      const q = adSearch.toLowerCase();
      rows = rows.filter((r) =>
        (r.ad_name || "").toLowerCase().includes(q) ||
        (r.creative?.title || "").toLowerCase().includes(q) ||
        (r.creative?.body || "").toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => num(b.spend) - num(a.spend));
  }, [mergedAds, adCampaign, adStatus, adSearch]);

  const adTotals = useMemo(() => {
    const t = { spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0 };
    filteredAds.forEach((r) => {
      t.spend += num(r.spend);
      t.impressions += num(r.impressions);
      t.clicks += num(r.clicks);
      t.reach += num(r.reach);
      t.conversions += getConversions(r.actions);
    });
    return t;
  }, [filteredAds]);

  const adStatusCounts = useMemo(() => {
    const c: Record<string, number> = { ALL: mergedAds.length, ACTIVE: 0, PAUSED: 0 };
    mergedAds.forEach((r) => {
      const s = (r.status || "").toUpperCase();
      if (s === "ACTIVE") c.ACTIVE++;
      else if (s === "PAUSED") c.PAUSED++;
    });
    return c;
  }, [mergedAds]);

  // Top ad sets for charts (top 10 by spend)
  const topAdsets = useMemo(() => filteredAdsets.slice(0, 10).map((r) => ({
    name: (r.adset_name || "").length > 18 ? (r.adset_name || "").slice(0, 18) + "…" : (r.adset_name || "Unknown"),
    spend: num(r.spend),
    ctr: num(r.ctr),
    cpc: num(r.cpc),
    impressions: num(r.impressions),
    clicks: num(r.clicks),
    conversions: getConversions(r.actions),
  })), [filteredAdsets]);

  // Top ads for charts (top 10 by spend)
  const topAds = useMemo(() => filteredAds.slice(0, 10).map((r) => ({
    name: (r.ad_name || "").length > 18 ? (r.ad_name || "").slice(0, 18) + "…" : (r.ad_name || "Unknown"),
    spend: num(r.spend),
    ctr: num(r.ctr),
    cpc: num(r.cpc),
    impressions: num(r.impressions),
    clicks: num(r.clicks),
    conversions: getConversions(r.actions),
  })), [filteredAds]);

  // Scatter data for ad set efficiency (spend vs CTR, bubble = clicks)
  const adsetScatter = useMemo(() => filteredAdsets.filter((r) => num(r.spend) > 0).map((r) => ({
    name: r.adset_name || "Unknown",
    spend: num(r.spend),
    ctr: num(r.ctr),
    clicks: num(r.clicks),
  })), [filteredAdsets]);

  const adScatter = useMemo(() => filteredAds.filter((r) => num(r.spend) > 0).map((r) => ({
    name: r.ad_name || "Unknown",
    spend: num(r.spend),
    ctr: num(r.ctr),
    clicks: num(r.clicks),
  })), [filteredAds]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-bold text-foreground tracking-tight">Analytics</h1>
        <MetaAnalyticsSkeleton />
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
            <h1 className="text-xl font-bold text-foreground tracking-tight">Analytics</h1>
            <p className="text-muted text-xs mt-0.5">Deep demographic, placement & performance analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (topTab === "adset") {
                const headers = ["Ad Set", "Status", "Campaign", "Spend", "Impressions", "Reach", "Clicks", "CTR", "CPC", "CPM", "Conversions"];
                const csvRows = filteredAdsets.map((r) => [
                  r.adset_name || r.adset_id || "",
                  r.status || "",
                  campaignNameMap[r.campaign_id || ""] || "",
                  String(num(r.spend)),
                  String(num(r.impressions)),
                  String(num(r.reach)),
                  String(num(r.clicks)),
                  `${num(r.ctr).toFixed(2)}%`,
                  String(num(r.cpc)),
                  String(num(r.cpm)),
                  String(getConversions(r.actions)),
                ]);
                downloadCSV("analytics-adsets.csv", headers, csvRows);
              } else if (topTab === "ad") {
                const headers = ["Ad Name", "Status", "Campaign", "Spend", "Impressions", "Reach", "Clicks", "CTR", "CPC", "CPM", "Conversions"];
                const csvRows = filteredAds.map((r) => [
                  r.ad_name || r.ad_id || "",
                  r.status || "",
                  campaignNameMap[r.campaign_id || ""] || "",
                  String(num(r.spend)),
                  String(num(r.impressions)),
                  String(num(r.reach)),
                  String(num(r.clicks)),
                  `${num(r.ctr).toFixed(2)}%`,
                  String(num(r.cpc)),
                  String(num(r.cpm)),
                  String(getConversions(r.actions)),
                ]);
                downloadCSV("analytics-ads.csv", headers, csvRows);
              } else {
                const headers = ["Segment", "Spend", "Impressions", "Clicks", "Reach", "Conversions", "CTR", "CPC", "CPM", "Conv Rate", "Cost/Conv", "Frequency"];
                const csvRows = aggregated.map((r) => [
                  r.name,
                  String(r.spend),
                  String(r.impressions),
                  String(r.clicks),
                  String(r.reach),
                  String(r.conversions),
                  `${r.ctr}%`,
                  String(r.cpc),
                  String(r.cpm),
                  `${r.convRate}%`,
                  String(r.costPerConv),
                  String(r.frequency),
                ]);
                downloadCSV("analytics-overview.csv", headers, csvRows);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-accent/10 text-accent border border-accent/20 rounded-lg text-sm hover:bg-accent/20 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Read Only
          </span>
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

      {/* ── Top-Level Sub Tabs ──────────────────── */}
      <div className="flex items-center gap-1 border-b border-border">
        {TOP_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              onClick={() => setTopTab(t.value)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                topTab === t.value
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════
          TAB 1: OVERVIEW
          ═══════════════════════════════════════════ */}
      {topTab === "overview" && (
        <div className="space-y-4">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <StatCard label="Total Spend" value={currency(totalSpend)} icon={IndianRupee} color="text-green-400" />
            <StatCard label="Impressions" value={compact(totalImpressions)} icon={Eye} color="text-blue-400" />
            <StatCard label="Clicks" value={compact(totalClicks)} icon={MousePointer} color="text-blue-400" />
            <StatCard label="Reach" value={compact(totalReach)} icon={Users} color="text-purple-400" />
            <StatCard label="Avg CTR" value={`${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0"}%`} icon={TrendingUp} color="text-amber-400" />
            <StatCard label="Avg CPC" value={currency(totalClicks > 0 ? totalSpend / totalClicks : 0)} icon={Target} color="text-red-400" />
            <StatCard label="Conversions" value={compact(totalConversions)} icon={BarChart3} color="text-emerald-400" />
          </div>

          {/* Top Performers */}
          {topPerformers.length > 0 && (
            <div className="card rounded-xl p-4">
              <h3 className="text-sm font-bold text-foreground mb-3">Best CTR by Segment</h3>
              <div className="flex flex-wrap gap-3">
                {topPerformers.map((t) => (
                  <div key={t.breakdown} className="bg-background/50 rounded-lg px-3 py-2 border border-border/50">
                    <p className="text-[10px] text-muted uppercase tracking-wider">{t.breakdown}</p>
                    <p className="text-sm font-medium text-accent">{t.best!.name}</p>
                    <p className="text-xs text-muted">CTR: {t.best!.ctr}% · CPC: {currency(t.best!.cpc)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Breakdown Tabs */}
          <div className="flex items-center gap-1.5 border-b border-border pb-0">
            {BREAKDOWNS.map((b) => (
              <button
                key={b.value}
                onClick={() => setActiveBreakdown(b.value)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeBreakdown === b.value
                    ? "border-accent text-accent"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* Row 1: Spend + CTR/CPC */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-4">
                Spend Distribution by {BREAKDOWNS.find((b) => b.value === activeBreakdown)?.label}
              </h3>
              {aggregated.length > 0 ? (
                useBarForSpend ? (
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
                      <Pie data={aggregated} cx="50%" cy="50%" innerRadius={60} outerRadius={110} dataKey="spend" label={({ name, value }) => `${name}: ${currency(value)}`} labelLine>
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
                  No data
                </div>
              )}
            </div>

            <div className="card rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-4">
                CTR & CPC by {BREAKDOWNS.find((b) => b.value === activeBreakdown)?.label}
              </h3>
              {aggregated.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={aggregated}>
                    <XAxis dataKey="name" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar yAxisId="left" dataKey="ctr" fill="#22c55e" radius={[4, 4, 0, 0]} name="CTR %" />
                    <Bar yAxisId="right" dataKey="cpc" fill="#f59e0b" radius={[4, 4, 0, 0]} name="CPC ₹" />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted text-sm">No data</div>
              )}
            </div>
          </div>

          {/* Row 2: Radar + Cost per Conv */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-4">Efficiency Radar (Top 6)</h3>
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={[
                    { metric: "CTR", ...Object.fromEntries(radarData.map((r) => [r.name, r.CTR])) },
                    { metric: "Conv Rate", ...Object.fromEntries(radarData.map((r) => [r.name, r["Conv Rate"]])) },
                    { metric: "Frequency", ...Object.fromEntries(radarData.map((r) => [r.name, r.Frequency])) },
                    { metric: "CPC Eff.", ...Object.fromEntries(radarData.map((r) => [r.name, r["CPC Efficiency"]])) },
                    { metric: "CPM Eff.", ...Object.fromEntries(radarData.map((r) => [r.name, r["CPM Efficiency"]])) },
                  ]}>
                    <PolarGrid stroke="#333" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: "#A3A3A3", fontSize: 10 }} />
                    <PolarRadiusAxis tick={false} axisLine={false} />
                    {radarData.map((r, i) => (
                      <Radar key={r.name} name={r.name} dataKey={r.name} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.1} />
                    ))}
                    <Legend />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted text-sm">No data</div>
              )}
            </div>

            <div className="card rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-4">
                Cost per Conversion by {BREAKDOWNS.find((b) => b.value === activeBreakdown)?.label}
              </h3>
              {aggregated.filter((r) => r.costPerConv > 0).length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={aggregated.filter((r) => r.costPerConv > 0)} layout="vertical">
                    <XAxis type="number" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                    <Bar dataKey="costPerConv" radius={[0, 4, 4, 0]} name="Cost/Conv">
                      {aggregated.filter((r) => r.costPerConv > 0).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted text-sm">No conversion data</div>
              )}
            </div>
          </div>

          {/* Row 3: Reach & Freq + Impressions Share */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-4">Reach & Frequency</h3>
              {aggregated.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={aggregated}>
                    <XAxis dataKey="name" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar yAxisId="left" dataKey="reach" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Reach" />
                    <Bar yAxisId="right" dataKey="frequency" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Frequency" />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted text-sm">No data</div>
              )}
            </div>

            <div className="card rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-4">Impressions Share</h3>
              {aggregated.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={aggregated} cx="50%" cy="50%" outerRadius={100} dataKey="impressions" label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`} labelLine>
                      {aggregated.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => Number(v).toLocaleString()} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted text-sm">No data</div>
              )}
            </div>
          </div>

          {/* Campaign Performance */}
          {campaignAgg.length > 0 && (
            <div className="card rounded-xl p-4">
              <h3 className="text-sm font-bold text-foreground mb-4">Campaign Performance Comparison</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted mb-2">Spend by Campaign</p>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={campaignAgg} layout="vertical">
                      <XAxis type="number" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} width={120} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                      <Bar dataKey="spend" radius={[0, 4, 4, 0]}>
                        {campaignAgg.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-xs text-muted mb-2">CTR by Campaign</p>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={campaignAgg} layout="vertical">
                      <XAxis type="number" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} width={120} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${Number(v).toFixed(2)}%`} />
                      <Bar dataKey="ctr" radius={[0, 4, 4, 0]}>
                        {campaignAgg.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Breakdown Table */}
          <div className="card rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50">
              <h3 className="text-sm font-bold text-foreground">
                Detailed {BREAKDOWNS.find((b) => b.value === activeBreakdown)?.label} Breakdown
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface/50">
                    <th className="text-left py-3 px-4 text-xs text-muted font-medium">
                      {BREAKDOWNS.find((b) => b.value === activeBreakdown)?.label}
                    </th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">Spend</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">% Share</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">Impr.</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">Clicks</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">Reach</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">Freq.</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">CTR</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">CPC</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">CPM</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">Conv.</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">Conv. Rate</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">Cost/Conv</th>
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
                      <td className="py-3 px-3 text-right text-foreground">{row.reach.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-foreground">{row.frequency}x</td>
                      <td className="py-3 px-3 text-right text-foreground">{row.ctr}%</td>
                      <td className="py-3 px-3 text-right text-foreground">{currency(row.cpc)}</td>
                      <td className="py-3 px-3 text-right text-foreground">{currency(row.cpm)}</td>
                      <td className="py-3 px-3 text-right text-foreground">{row.conversions}</td>
                      <td className="py-3 px-3 text-right text-foreground">{row.convRate}%</td>
                      <td className="py-3 px-3 text-right text-foreground">{row.costPerConv > 0 ? currency(row.costPerConv) : "-"}</td>
                    </tr>
                  ))}
                  {aggregated.length === 0 && (
                    <tr>
                      <td colSpan={13} className="py-12 text-center text-muted text-sm">
                        No data available for this breakdown
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          TAB 2: AD SET ANALYSIS
          ═══════════════════════════════════════════ */}
      {topTab === "adset" && (
        adsetLoading ? (
          <div className="flex items-center justify-center h-[40vh]">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : <div className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <StatCard label="Ad Sets" value={filteredAdsets.length} icon={Layers} color="text-blue-400" />
            <StatCard label="Total Spend" value={currency(adsetTotals.spend)} icon={IndianRupee} color="text-green-400" />
            <StatCard label="Impressions" value={compact(adsetTotals.impressions)} icon={Eye} color="text-blue-400" />
            <StatCard label="Clicks" value={compact(adsetTotals.clicks)} icon={MousePointer} color="text-cyan-400" />
            <StatCard label="Reach" value={compact(adsetTotals.reach)} icon={Users} color="text-purple-400" />
            <StatCard label="Avg CTR" value={`${adsetTotals.impressions > 0 ? ((adsetTotals.clicks / adsetTotals.impressions) * 100).toFixed(2) : "0"}%`} icon={TrendingUp} color="text-amber-400" />
            <StatCard label="Conversions" value={compact(adsetTotals.conversions)} icon={Target} color="text-emerald-400" />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search ad sets..."
                value={adsetSearch}
                onChange={(e) => setAdsetSearch(e.target.value)}
                className="pl-8 pr-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent w-[180px]"
              />
            </div>
            <select
              value={adsetCampaign}
              onChange={(e) => setAdsetCampaign(e.target.value)}
              className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent max-w-[200px]"
            >
              <option value="">All Campaigns</option>
              {adsetCampaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="flex items-center gap-1.5">
              {(["ALL", "ACTIVE", "PAUSED"] as const).map((s) => {
                const count = adsetStatusCounts[s] || 0;
                if (s !== "ALL" && count === 0) return null;
                return (
                  <button
                    key={s}
                    onClick={() => setAdsetStatus(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      adsetStatus === s
                        ? "bg-accent/15 text-accent border border-accent/30"
                        : "bg-surface border border-border text-muted hover:text-foreground"
                    }`}
                  >
                    {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Charts Row 1: Spend + CTR Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-4">Spend by Ad Set (Top 10)</h3>
              {topAdsets.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topAdsets} layout="vertical">
                    <XAxis type="number" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                    <Bar dataKey="spend" radius={[0, 4, 4, 0]} name="Spend">
                      {topAdsets.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted text-sm">No data</div>
              )}
            </div>

            <div className="card rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-4">CTR & CPC by Ad Set (Top 10)</h3>
              {topAdsets.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topAdsets}>
                    <XAxis dataKey="name" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} angle={-25} textAnchor="end" height={50} />
                    <YAxis yAxisId="left" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar yAxisId="left" dataKey="ctr" fill="#22c55e" radius={[4, 4, 0, 0]} name="CTR %" />
                    <Bar yAxisId="right" dataKey="cpc" fill="#f59e0b" radius={[4, 4, 0, 0]} name="CPC ₹" />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted text-sm">No data</div>
              )}
            </div>
          </div>

          {/* Charts Row 2: Scatter + Spend Pie */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-1">Efficiency Map</h3>
              <p className="text-[10px] text-muted mb-4">Spend vs CTR — bubble size = clicks</p>
              {adsetScatter.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                    <XAxis type="number" dataKey="spend" name="Spend" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="number" dataKey="ctr" name="CTR %" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <ZAxis type="number" dataKey="clicks" range={[40, 400]} name="Clicks" />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => name === "Spend" ? currency(Number(v)) : name === "CTR %" ? `${Number(v).toFixed(2)}%` : Number(v).toLocaleString()} />
                    <Scatter data={adsetScatter} fill="#3b82f6" fillOpacity={0.7} />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted text-sm">No data</div>
              )}
            </div>

            <div className="card rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-4">Spend Distribution</h3>
              {topAdsets.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={topAdsets} cx="50%" cy="50%" innerRadius={55} outerRadius={100} dataKey="spend" label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`} labelLine>
                      {topAdsets.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted text-sm">No data</div>
              )}
            </div>
          </div>

          {/* Charts Row 3: Impressions + Conversions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-4">Impressions & Clicks (Top 10)</h3>
              {topAdsets.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={topAdsets}>
                    <XAxis dataKey="name" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} angle={-25} textAnchor="end" height={50} />
                    <YAxis tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => Number(v).toLocaleString()} />
                    <Bar dataKey="impressions" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Impressions" />
                    <Bar dataKey="clicks" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Clicks" />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted text-sm">No data</div>
              )}
            </div>

            <div className="card rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-4">Conversions by Ad Set</h3>
              {topAdsets.filter((r) => r.conversions > 0).length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={topAdsets.filter((r) => r.conversions > 0)} layout="vertical">
                    <XAxis type="number" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="conversions" radius={[0, 4, 4, 0]} fill="#22c55e" name="Conversions" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted text-sm">No conversion data</div>
              )}
            </div>
          </div>

          {/* Detailed Table */}
          <div className="card rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50">
              <h3 className="text-sm font-bold text-foreground">Ad Set Performance Detail</h3>
              <p className="text-[10px] text-muted mt-0.5">{filteredAdsets.length} ad sets</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface/50">
                    <th className="text-left py-3 px-4 text-xs text-muted font-medium">Ad Set</th>
                    <th className="text-left py-3 px-3 text-xs text-muted font-medium">Campaign</th>
                    <th className="text-center py-3 px-3 text-xs text-muted font-medium">Status</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">Budget</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">Spend</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">% Share</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">Impr.</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">Clicks</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">Reach</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">CTR</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">CPC</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">CPM</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">Conv.</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">Cost/Conv</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdsets.map((row, idx) => {
                    const spend = num(row.spend);
                    const clicks = num(row.clicks);
                    const conv = getConversions(row.actions);
                    const budget = row.daily_budget
                      ? `${currency(num(row.daily_budget) / 100)}/day`
                      : row.lifetime_budget
                        ? `${currency(num(row.lifetime_budget) / 100)} LT`
                        : "-";
                    return (
                      <tr key={idx} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                        <td className="py-3 px-4 text-foreground font-medium max-w-[200px] truncate">{row.adset_name || row.adset_id}</td>
                        <td className="py-3 px-3 text-xs text-muted max-w-[150px] truncate">{campaignNameMap[row.campaign_id || ""] || "-"}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${statusBadge(row.status)}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-xs text-foreground">{budget}</td>
                        <td className="py-3 px-3 text-right text-foreground">{currency(spend)}</td>
                        <td className="py-3 px-3 text-right text-muted">{adsetTotals.spend > 0 ? `${((spend / adsetTotals.spend) * 100).toFixed(1)}%` : "-"}</td>
                        <td className="py-3 px-3 text-right text-foreground">{Number(num(row.impressions)).toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-foreground">{Number(clicks).toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-foreground">{Number(num(row.reach)).toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-foreground">{num(row.ctr).toFixed(2)}%</td>
                        <td className="py-3 px-3 text-right text-foreground">{currency(num(row.cpc))}</td>
                        <td className="py-3 px-3 text-right text-foreground">{currency(num(row.cpm))}</td>
                        <td className="py-3 px-3 text-right text-foreground">{conv}</td>
                        <td className="py-3 px-3 text-right text-foreground">{conv > 0 ? currency(spend / conv) : "-"}</td>
                      </tr>
                    );
                  })}
                  {filteredAdsets.length === 0 && (
                    <tr>
                      <td colSpan={14} className="py-12 text-center text-muted text-sm">No ad sets found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          TAB 3: AD ANALYSIS
          ═══════════════════════════════════════════ */}
      {topTab === "ad" && (
        adLoading ? (
          <div className="flex items-center justify-center h-[40vh]">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : <div className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <StatCard label="Ads" value={filteredAds.length} icon={Megaphone} color="text-blue-400" />
            <StatCard label="Total Spend" value={currency(adTotals.spend)} icon={IndianRupee} color="text-green-400" />
            <StatCard label="Impressions" value={compact(adTotals.impressions)} icon={Eye} color="text-blue-400" />
            <StatCard label="Clicks" value={compact(adTotals.clicks)} icon={MousePointer} color="text-cyan-400" />
            <StatCard label="Reach" value={compact(adTotals.reach)} icon={Users} color="text-purple-400" />
            <StatCard label="Avg CTR" value={`${adTotals.impressions > 0 ? ((adTotals.clicks / adTotals.impressions) * 100).toFixed(2) : "0"}%`} icon={TrendingUp} color="text-amber-400" />
            <StatCard label="Conversions" value={compact(adTotals.conversions)} icon={Target} color="text-emerald-400" />
          </div>

          {/* Top Creatives */}
          {filteredAds.length > 0 && (
            <div className="card rounded-xl p-4">
              <h3 className="text-sm font-bold text-foreground mb-3">Top Performing Creatives</h3>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {filteredAds.slice(0, 8).map((ad, i) => {
                  const imgUrl = ad.creative?.thumbnail_url || ad.creative?.image_url;
                  const spend = num(ad.spend);
                  const conv = getConversions(ad.actions);
                  return (
                    <div key={ad.ad_id || i} className="min-w-[160px] max-w-[160px] bg-background/50 rounded-lg border border-border/50 overflow-hidden flex-shrink-0">
                      <div className="h-20 bg-surface flex items-center justify-center overflow-hidden">
                        {imgUrl ? (
                          <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-muted/30" />
                        )}
                      </div>
                      <div className="p-2 space-y-1">
                        <p className="text-[11px] text-foreground font-medium line-clamp-1">{ad.ad_name || ad.ad_id}</p>
                        {ad.creative?.title && (
                          <p className="text-[10px] text-accent line-clamp-1">{ad.creative.title}</p>
                        )}
                        <div className="flex justify-between text-[10px] text-muted">
                          <span>{currency(spend)}</span>
                          <span>{num(ad.ctr).toFixed(2)}% CTR</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-muted">
                          <span>{Number(num(ad.clicks)).toLocaleString()} clicks</span>
                          <span>{conv} conv</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search ads..."
                value={adSearch}
                onChange={(e) => setAdSearch(e.target.value)}
                className="pl-8 pr-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent w-[180px]"
              />
            </div>
            <select
              value={adCampaign}
              onChange={(e) => setAdCampaign(e.target.value)}
              className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent max-w-[200px]"
            >
              <option value="">All Campaigns</option>
              {adCampaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="flex items-center gap-1.5">
              {(["ALL", "ACTIVE", "PAUSED"] as const).map((s) => {
                const count = adStatusCounts[s] || 0;
                if (s !== "ALL" && count === 0) return null;
                return (
                  <button
                    key={s}
                    onClick={() => setAdStatus(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      adStatus === s
                        ? "bg-accent/15 text-accent border border-accent/30"
                        : "bg-surface border border-border text-muted hover:text-foreground"
                    }`}
                  >
                    {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Charts Row 1: Spend + CTR */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-4">Spend by Ad (Top 10)</h3>
              {topAds.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topAds} layout="vertical">
                    <XAxis type="number" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                    <Bar dataKey="spend" radius={[0, 4, 4, 0]} name="Spend">
                      {topAds.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted text-sm">No data</div>
              )}
            </div>

            <div className="card rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-4">CTR & CPC by Ad (Top 10)</h3>
              {topAds.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topAds}>
                    <XAxis dataKey="name" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} angle={-25} textAnchor="end" height={50} />
                    <YAxis yAxisId="left" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar yAxisId="left" dataKey="ctr" fill="#22c55e" radius={[4, 4, 0, 0]} name="CTR %" />
                    <Bar yAxisId="right" dataKey="cpc" fill="#f59e0b" radius={[4, 4, 0, 0]} name="CPC ₹" />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted text-sm">No data</div>
              )}
            </div>
          </div>

          {/* Charts Row 2: Scatter + Spend Pie */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-1">Ad Efficiency Map</h3>
              <p className="text-[10px] text-muted mb-4">Spend vs CTR — bubble size = clicks</p>
              {adScatter.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                    <XAxis type="number" dataKey="spend" name="Spend" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="number" dataKey="ctr" name="CTR %" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <ZAxis type="number" dataKey="clicks" range={[40, 400]} name="Clicks" />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => name === "Spend" ? currency(Number(v)) : name === "CTR %" ? `${Number(v).toFixed(2)}%` : Number(v).toLocaleString()} />
                    <Scatter data={adScatter} fill="#8b5cf6" fillOpacity={0.7} />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted text-sm">No data</div>
              )}
            </div>

            <div className="card rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-4">Spend Distribution</h3>
              {topAds.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={topAds} cx="50%" cy="50%" innerRadius={55} outerRadius={100} dataKey="spend" label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`} labelLine>
                      {topAds.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted text-sm">No data</div>
              )}
            </div>
          </div>

          {/* Charts Row 3: Impressions + Conversions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-4">Impressions & Clicks (Top 10)</h3>
              {topAds.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={topAds}>
                    <XAxis dataKey="name" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} angle={-25} textAnchor="end" height={50} />
                    <YAxis tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => Number(v).toLocaleString()} />
                    <Bar dataKey="impressions" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Impressions" />
                    <Bar dataKey="clicks" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Clicks" />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted text-sm">No data</div>
              )}
            </div>

            <div className="card rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-4">Conversions by Ad</h3>
              {topAds.filter((r) => r.conversions > 0).length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={topAds.filter((r) => r.conversions > 0)} layout="vertical">
                    <XAxis type="number" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="conversions" radius={[0, 4, 4, 0]} fill="#22c55e" name="Conversions" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted text-sm">No conversion data</div>
              )}
            </div>
          </div>

          {/* Detailed Table */}
          <div className="card rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50">
              <h3 className="text-sm font-bold text-foreground">Ad Performance Detail</h3>
              <p className="text-[10px] text-muted mt-0.5">{filteredAds.length} ads</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface/50">
                    <th className="text-left py-3 px-4 text-xs text-muted font-medium">Ad</th>
                    <th className="text-left py-3 px-3 text-xs text-muted font-medium">Creative</th>
                    <th className="text-left py-3 px-3 text-xs text-muted font-medium">Ad Set</th>
                    <th className="text-center py-3 px-3 text-xs text-muted font-medium">Status</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">Spend</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">% Share</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">Impr.</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">Clicks</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">Reach</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">CTR</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">CPC</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">CPM</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">Conv.</th>
                    <th className="text-right py-3 px-3 text-xs text-muted font-medium">Cost/Conv</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAds.map((row, idx) => {
                    const spend = num(row.spend);
                    const conv = getConversions(row.actions);
                    const imgUrl = row.creative?.thumbnail_url || row.creative?.image_url;
                    return (
                      <tr key={idx} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                        <td className="py-3 px-4 text-foreground font-medium max-w-[180px] truncate">{row.ad_name || row.ad_id}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            {imgUrl ? (
                              <img src={imgUrl} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-7 h-7 rounded bg-background/50 flex items-center justify-center flex-shrink-0">
                                <ImageIcon className="w-3.5 h-3.5 text-muted/40" />
                              </div>
                            )}
                            <span className="text-[11px] text-muted truncate max-w-[100px]">{row.creative?.title || "-"}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs text-muted max-w-[120px] truncate">{adsetNameMap[row.adset_id || ""] || "-"}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${statusBadge(row.status)}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-foreground">{currency(spend)}</td>
                        <td className="py-3 px-3 text-right text-muted">{adTotals.spend > 0 ? `${((spend / adTotals.spend) * 100).toFixed(1)}%` : "-"}</td>
                        <td className="py-3 px-3 text-right text-foreground">{Number(num(row.impressions)).toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-foreground">{Number(num(row.clicks)).toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-foreground">{Number(num(row.reach)).toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-foreground">{num(row.ctr).toFixed(2)}%</td>
                        <td className="py-3 px-3 text-right text-foreground">{currency(num(row.cpc))}</td>
                        <td className="py-3 px-3 text-right text-foreground">{currency(num(row.cpm))}</td>
                        <td className="py-3 px-3 text-right text-foreground">{conv}</td>
                        <td className="py-3 px-3 text-right text-foreground">{conv > 0 ? currency(spend / conv) : "-"}</td>
                      </tr>
                    );
                  })}
                  {filteredAds.length === 0 && (
                    <tr>
                      <td colSpan={14} className="py-12 text-center text-muted text-sm">No ads found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
