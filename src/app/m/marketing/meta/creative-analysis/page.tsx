"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Loader2,
  BarChart3,
  ImageIcon,
  Trophy,
  ArrowLeftRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
} from "recharts";
import { apiFetch } from "@/lib/api-fetch";

/* ── Types ─────────────────────────────────────────── */

interface AdAction {
  action_type: string;
  value: string;
}

interface AdCreative {
  title?: string;
  body?: string;
  image_url?: string;
  thumbnail_url?: string;
  video_id?: string;
}

interface AdMeta {
  id: string;
  name: string;
  status: string;
  creative?: AdCreative;
  campaign_id?: string;
}

interface BulkAdRow {
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
  actions?: AdAction[];
  purchase_roas?: { action_type: string; value: string }[];
}

interface BulkCampaignRow {
  campaign_id?: string;
  campaign_name?: string;
}

interface MergedAd extends BulkAdRow {
  creative?: AdCreative;
  campaignName?: string;
  roas: number;
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
  { label: "ROAS", key: "roas" },
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

function getRoas(row: BulkAdRow): number {
  if (row.purchase_roas && row.purchase_roas.length > 0) {
    return parseFloat(row.purchase_roas[0].value || "0");
  }
  const spend = num(row.spend);
  if (!spend || !row.actions) return 0;
  const purchase = row.actions.find((a) => a.action_type === "omni_purchase" || a.action_type === "purchase");
  if (purchase) {
    return parseFloat(purchase.value) / spend;
  }
  return 0;
}

function getMetricValue(ad: MergedAd, key: MetricKey): number {
  switch (key) {
    case "spend": return num(ad.spend);
    case "ctr": return num(ad.ctr);
    case "cpc": return num(ad.cpc);
    case "roas": return ad.roas;
    case "clicks": return num(ad.clicks);
    default: return 0;
  }
}

function formatMetric(val: number, key: MetricKey): string {
  switch (key) {
    case "spend": return currency(val);
    case "ctr": return `${val.toFixed(2)}%`;
    case "cpc": return currency(val);
    case "roas": return val.toFixed(2) + "x";
    case "clicks": return compact(val);
    default: return val.toFixed(2);
  }
}

function truncate(str: string, len: number) {
  return str.length > len ? str.slice(0, len) + "..." : str;
}

/* ── Custom Scatter Tooltip ───────────────────────── */

function ScatterTooltipContent({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; spend: number; ctr: number; impressions: number; campaign: string } }> }) {
  if (!active || !payload || !payload[0]) return null;
  const d = payload[0].payload;
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 text-xs space-y-1">
      <p className="font-medium text-foreground">{d.name}</p>
      <p className="text-muted">{d.campaign}</p>
      <p>Spend: {currency(d.spend)}</p>
      <p>CTR: {d.ctr.toFixed(2)}%</p>
      <p>Impressions: {compact(d.impressions)}</p>
    </div>
  );
}

/* ── Main Component ────────────────────────────────── */

export default function CreativeAnalysisPage() {
  const [ads, setAds] = useState<MergedAd[]>([]);
  const [campaignMap, setCampaignMap] = useState<Record<string, string>>({});
  const [datePreset, setDatePreset] = useState("last_30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [gridMetric, setGridMetric] = useState<MetricKey>("spend");
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const [adRes, campRes, adsMetaRes] = await Promise.all([
          apiFetch(`/api/meta/ad-insights-bulk?date_preset=${datePreset}`),
          apiFetch(`/api/meta/campaign-insights-bulk?date_preset=${datePreset}`),
          apiFetch(`/api/meta/ads`),
        ]);
        const adData = await adRes.json();
        const campData = await campRes.json();
        const adsMetaData = await adsMetaRes.json();

        if (adData.error) throw new Error(adData.error);

        // Build campaign name map
        const cMap: Record<string, string> = {};
        (campData.insights || []).forEach((r: BulkCampaignRow) => {
          if (r.campaign_id && r.campaign_name) cMap[r.campaign_id] = r.campaign_name;
        });
        setCampaignMap(cMap);

        // Build ad metadata map
        const adMetaMap: Record<string, AdMeta> = {};
        (adsMetaData.ads || []).forEach((ad: AdMeta) => {
          if (ad.id) adMetaMap[ad.id] = ad;
        });

        // Merge
        const merged: MergedAd[] = (adData.insights || []).map((row: BulkAdRow) => {
          const meta = adMetaMap[row.ad_id || ""];
          return {
            ...row,
            creative: meta?.creative,
            campaignName: cMap[row.campaign_id || ""] || row.campaign_id || "Unknown",
            roas: getRoas(row),
          };
        });
        setAds(merged);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [datePreset]);

  // Campaigns for filter
  const campaigns = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    ads.forEach((a) => {
      const cid = a.campaign_id;
      if (cid && !seen.has(cid)) {
        seen.add(cid);
        result.push({ id: cid, name: campaignMap[cid] || cid });
      }
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [ads, campaignMap]);

  // Filtered ads
  const filtered = useMemo(() => {
    if (!selectedCampaign) return ads;
    return ads.filter((a) => a.campaign_id === selectedCampaign);
  }, [ads, selectedCampaign]);

  // Campaign color map
  const campaignColors = useMemo(() => {
    const map: Record<string, string> = {};
    const uniqueCampaigns = [...new Set(ads.map((a) => a.campaign_id || ""))];
    uniqueCampaigns.forEach((cid, i) => {
      map[cid] = CHART_COLORS[i % CHART_COLORS.length];
    });
    return map;
  }, [ads]);

  // Scatter data
  const scatterData = useMemo(() => {
    const byCampaign: Record<string, Array<{ name: string; spend: number; ctr: number; impressions: number; campaign: string }>> = {};
    filtered.forEach((ad) => {
      const cid = ad.campaign_id || "Unknown";
      const cName = ad.campaignName || cid;
      if (!byCampaign[cName]) byCampaign[cName] = [];
      byCampaign[cName].push({
        name: ad.ad_name || ad.ad_id || "Unknown",
        spend: num(ad.spend),
        ctr: num(ad.ctr),
        impressions: num(ad.impressions),
        campaign: cName,
      });
    });
    return byCampaign;
  }, [filtered]);

  // Top 20 by ROAS
  const top20Roas = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => {
      if (b.roas !== a.roas) return b.roas - a.roas;
      return num(b.ctr) - num(a.ctr);
    });
    return sorted.slice(0, 20).map((ad) => ({
      name: truncate(ad.ad_name || ad.ad_id || "Unknown", 25),
      roas: ad.roas,
      ctr: num(ad.ctr),
      spend: num(ad.spend),
      hasRoas: ad.roas > 0,
    }));
  }, [filtered]);

  // Grid sorted by selected metric
  const gridAds = useMemo(() => {
    return [...filtered]
      .sort((a, b) => getMetricValue(b, gridMetric) - getMetricValue(a, gridMetric))
      .slice(0, 20);
  }, [filtered, gridMetric]);

  // Compare ads
  const adA = useMemo(() => ads.find((a) => a.ad_id === compareA), [ads, compareA]);
  const adB = useMemo(() => ads.find((a) => a.ad_id === compareB), [ads, compareB]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
        <span className="ml-2 text-muted text-sm">Loading creative analysis...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-accent" />
            Creative Analysis
          </h1>
          <p className="text-muted text-sm mt-1">{filtered.length} ads analyzed</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Read Only
          </span>
          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent max-w-[200px]"
          >
            <option value="">All Campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
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

      {/* 1. Performance Scatter */}
      <div className="card rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground mb-1">Performance Scatter</h2>
        <p className="text-xs text-muted mb-4">X = Spend, Y = CTR, Bubble size = Impressions. Each dot is an ad, colored by campaign.</p>
        {filtered.length === 0 ? (
          <div className="h-[350px] flex items-center justify-center text-muted text-sm">No ad data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <ScatterChart margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis
                type="number"
                dataKey="spend"
                name="Spend"
                tickFormatter={(v) => compact(Number(v))}
                tick={{ fill: "#a3a3a3", fontSize: 11 }}
                stroke="#404040"
              />
              <YAxis
                type="number"
                dataKey="ctr"
                name="CTR"
                unit="%"
                tick={{ fill: "#a3a3a3", fontSize: 11 }}
                stroke="#404040"
              />
              <ZAxis type="number" dataKey="impressions" range={[40, 400]} name="Impressions" />
              <Tooltip content={<ScatterTooltipContent />} />
              <Legend />
              {Object.entries(scatterData).map(([campaignName, data], i) => (
                <Scatter
                  key={campaignName}
                  name={truncate(campaignName, 30)}
                  data={data}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  fillOpacity={0.7}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 2. Top 20 Ads by ROAS */}
      <div className="card rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground mb-1">Top 20 Ads by ROAS</h2>
        <p className="text-xs text-muted mb-4">
          {top20Roas.some((a) => a.hasRoas) ? "Ranked by purchase ROAS." : "No ROAS data — showing CTR as fallback metric."}
        </p>
        {top20Roas.length === 0 ? (
          <div className="h-[500px] flex items-center justify-center text-muted text-sm">No ad data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={500}>
            <BarChart
              data={top20Roas}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#a3a3a3", fontSize: 11 }}
                stroke="#404040"
                tickFormatter={(v) => { const n = Number(v); return top20Roas.some((a) => a.hasRoas) ? `${n.toFixed(1)}x` : `${n.toFixed(1)}%`; }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={180}
                tick={{ fill: "#a3a3a3", fontSize: 11 }}
                stroke="#404040"
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value: unknown) => {
                  const v = Number(value);
                  return top20Roas.some((a) => a.hasRoas) ? [`${v.toFixed(2)}x`, "ROAS"] : [`${v.toFixed(2)}%`, "CTR"];
                }}
              />
              <Bar
                dataKey={top20Roas.some((a) => a.hasRoas) ? "roas" : "ctr"}
                radius={[0, 4, 4, 0]}
              >
                {top20Roas.map((_, i) => (
                  <Cell key={i} fill={i < 3 ? "#B8860B" : i < 10 ? "#22c55e" : "#404040"} fillOpacity={i < 3 ? 1 : 0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 3. Creative Grid */}
      <div className="card rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Creative Grid</h2>
            <p className="text-xs text-muted mt-1">Top 20 creatives ranked by selected metric</p>
          </div>
          <select
            value={gridMetric}
            onChange={(e) => setGridMetric(e.target.value as MetricKey)}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
          >
            {METRIC_OPTIONS.map((m) => (
              <option key={m.key} value={m.key}>Sort by {m.label}</option>
            ))}
          </select>
        </div>
        {gridAds.length === 0 ? (
          <div className="py-12 text-center text-muted text-sm">
            <ImageIcon className="w-8 h-8 text-muted/30 mx-auto mb-2" />
            No ads found
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {gridAds.map((ad, idx) => {
              const imgUrl = ad.creative?.thumbnail_url || ad.creative?.image_url;
              const borderClass =
                idx === 0 ? "border-yellow-500/60" :
                idx === 1 ? "border-gray-400/60" :
                idx === 2 ? "border-amber-700/60" :
                "border-border";
              return (
                <div
                  key={ad.ad_id}
                  className={`bg-surface border ${borderClass} rounded-xl overflow-hidden hover:border-accent/30 transition-colors relative`}
                >
                  {/* Rank badge */}
                  <div className={`absolute top-2 left-2 z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    idx === 0 ? "bg-yellow-500 text-black" :
                    idx === 1 ? "bg-gray-400 text-black" :
                    idx === 2 ? "bg-amber-700 text-white" :
                    "bg-surface border border-border text-muted"
                  }`}>
                    #{idx + 1}
                  </div>

                  {/* Thumbnail */}
                  <div className="h-36 bg-background/50 flex items-center justify-center overflow-hidden">
                    {imgUrl ? (
                      <img src={imgUrl} alt={ad.ad_name || "Ad"} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-10 h-10 text-muted/30" />
                    )}
                  </div>

                  <div className="p-3 space-y-2">
                    <p className="text-foreground text-sm font-medium line-clamp-1">
                      {ad.ad_name || ad.ad_id}
                    </p>
                    <p className="text-xs text-muted line-clamp-1">
                      {ad.campaignName}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50">
                      <div>
                        <span className="text-muted">Spend: </span>
                        <span className="text-foreground">{currency(num(ad.spend))}</span>
                      </div>
                      <div>
                        <span className="text-muted">CTR: </span>
                        <span className="text-foreground">{num(ad.ctr).toFixed(2)}%</span>
                      </div>
                      <div>
                        <span className="text-muted">CPC: </span>
                        <span className="text-foreground">{currency(num(ad.cpc))}</span>
                      </div>
                      <div>
                        <span className="text-muted">Clicks: </span>
                        <span className="text-foreground">{compact(num(ad.clicks))}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. A/B Comparison */}
      <div className="card rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-1">
          <ArrowLeftRight className="w-5 h-5 text-accent" />
          A/B Comparison
        </h2>
        <p className="text-xs text-muted mb-4">Select two ads to compare side by side</p>
        <div className="flex items-center gap-4 flex-wrap mb-6">
          <select
            value={compareA}
            onChange={(e) => setCompareA(e.target.value)}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent flex-1 min-w-[200px] max-w-[400px]"
          >
            <option value="">Select Ad A</option>
            {ads.map((a) => (
              <option key={a.ad_id} value={a.ad_id}>{truncate(a.ad_name || a.ad_id || "", 50)}</option>
            ))}
          </select>
          <span className="text-muted text-sm">vs</span>
          <select
            value={compareB}
            onChange={(e) => setCompareB(e.target.value)}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent flex-1 min-w-[200px] max-w-[400px]"
          >
            <option value="">Select Ad B</option>
            {ads.map((a) => (
              <option key={a.ad_id} value={a.ad_id}>{truncate(a.ad_name || a.ad_id || "", 50)}</option>
            ))}
          </select>
        </div>

        {adA && adB ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[adA, adB].map((ad, sideIdx) => {
              const other = sideIdx === 0 ? adB : adA;
              const imgUrl = ad.creative?.thumbnail_url || ad.creative?.image_url;
              const metrics = [
                { label: "Spend", val: num(ad.spend), otherVal: num(other.spend), fmt: currency, lower: true },
                { label: "Impressions", val: num(ad.impressions), otherVal: num(other.impressions), fmt: compact, lower: false },
                { label: "Clicks", val: num(ad.clicks), otherVal: num(other.clicks), fmt: compact, lower: false },
                { label: "CTR", val: num(ad.ctr), otherVal: num(other.ctr), fmt: (v: number) => `${v.toFixed(2)}%`, lower: false },
                { label: "CPC", val: num(ad.cpc), otherVal: num(other.cpc), fmt: currency, lower: true },
                { label: "CPM", val: num(ad.cpm), otherVal: num(other.cpm), fmt: currency, lower: true },
                { label: "Conversions", val: getConversions(ad.actions), otherVal: getConversions(other.actions), fmt: compact, lower: false },
              ];
              return (
                <div key={ad.ad_id} className="bg-surface border border-border rounded-xl overflow-hidden">
                  <div className="h-40 bg-background/50 flex items-center justify-center overflow-hidden">
                    {imgUrl ? (
                      <img src={imgUrl} alt={ad.ad_name || ""} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-10 h-10 text-muted/30" />
                    )}
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-foreground font-medium line-clamp-1">{ad.ad_name || ad.ad_id}</p>
                    <p className="text-xs text-muted">{ad.campaignName}</p>
                    <div className="space-y-2 pt-2 border-t border-border/50">
                      {metrics.map((m) => {
                        const isWinner = m.lower
                          ? m.val < m.otherVal
                          : m.val > m.otherVal;
                        const isTied = m.val === m.otherVal;
                        return (
                          <div key={m.label} className="flex items-center justify-between text-sm">
                            <span className="text-muted">{m.label}</span>
                            <span className={`font-medium ${isTied ? "text-foreground" : isWinner ? "text-green-400" : "text-foreground"}`}>
                              {m.fmt(m.val)}
                              {!isTied && isWinner && (
                                <Trophy className="w-3 h-3 inline ml-1 text-green-400" />
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-muted text-sm">
            <ArrowLeftRight className="w-8 h-8 text-muted/30 mx-auto mb-2" />
            Select two ads above to compare
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Helper used in A/B compare ────────────────────── */

function getConversions(actions?: AdAction[]) {
  if (!actions) return 0;
  const purchase = actions.find((a) => a.action_type === "purchase");
  if (purchase) return parseInt(purchase.value);
  const lead = actions.find((a) => a.action_type === "lead");
  if (lead) return parseInt(lead.value);
  return 0;
}
