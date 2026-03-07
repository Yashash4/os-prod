"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2, ImageIcon } from "lucide-react";

/* ── Types ─────────────────────────────────────────── */

interface Campaign {
  id: string;
  name: string;
}

interface AdSet {
  id: string;
  name: string;
  campaign_id?: string;
}

interface Ad {
  id: string;
  name: string;
  status: string;
  adset_id?: string;
  campaign_id?: string;
  creative?: {
    title?: string;
    body?: string;
    image_url?: string;
    thumbnail_url?: string;
  };
}

interface InsightRow {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
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

function num(val?: string) {
  return parseFloat(val || "0");
}

function currency(val: number) {
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function statusBadge(status: string) {
  const s = status.toUpperCase();
  if (s === "ACTIVE") return "bg-green-500/15 text-green-400 border-green-500/30";
  if (s === "PAUSED") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-gray-500/15 text-gray-400 border-gray-500/30";
}

function getConversions(actions?: { action_type: string; value: string }[]) {
  if (!actions) return 0;
  const purchase = actions.find((a) => a.action_type === "purchase");
  if (purchase) return parseInt(purchase.value);
  const lead = actions.find((a) => a.action_type === "lead");
  if (lead) return parseInt(lead.value);
  return 0;
}

/* ── Main Component ────────────────────────────────── */

export default function AdsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adsets, setAdsets] = useState<AdSet[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [adInsights, setAdInsights] = useState<Record<string, InsightRow[]>>({});
  const [datePreset, setDatePreset] = useState("last_30d");
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [selectedAdSet, setSelectedAdSet] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchFilters() {
      try {
        const [campRes, adsetRes] = await Promise.all([
          fetch("/api/meta/campaigns"),
          fetch("/api/meta/adsets"),
        ]);
        const campData = await campRes.json();
        const adsetData = await adsetRes.json();
        setCampaigns(campData.campaigns || []);
        setAdsets(adsetData.adsets || []);
      } catch {
        // silent
      }
    }
    fetchFilters();
  }, []);

  useEffect(() => {
    async function fetchAds() {
      setLoading(true);
      setError("");
      try {
        const url = selectedAdSet
          ? `/api/meta/ads?adSetId=${selectedAdSet}`
          : "/api/meta/ads";
        const res = await fetch(url);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        let adsList = data.ads || [];

        // Client-side campaign filter
        if (selectedCampaign) {
          adsList = adsList.filter((a: Ad) => a.campaign_id === selectedCampaign);
        }

        setAds(adsList);

        // Fetch insights
        const insightResults: Record<string, InsightRow[]> = {};
        await Promise.all(
          adsList.slice(0, 50).map(async (a: Ad) => {
            try {
              const r = await fetch(
                `/api/meta/ad-insights?adId=${a.id}&date_preset=${datePreset}&time_increment=all_days`
              );
              const d = await r.json();
              insightResults[a.id] = d.insights || [];
            } catch {
              insightResults[a.id] = [];
            }
          })
        );
        setAdInsights(insightResults);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchAds();
  }, [selectedAdSet, selectedCampaign, datePreset]);

  const adsetNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    adsets.forEach((a) => { map[a.id] = a.name; });
    return map;
  }, [adsets]);

  const filteredAdSets = useMemo(() => {
    if (!selectedCampaign) return adsets;
    return adsets.filter((a) => a.campaign_id === selectedCampaign);
  }, [adsets, selectedCampaign]);

  const sortedAds = useMemo(() => {
    return [...ads].sort((a, b) => {
      const spendA = num(adInsights[a.id]?.[0]?.spend);
      const spendB = num(adInsights[b.id]?.[0]?.spend);
      return spendB - spendA;
    });
  }, [ads, adInsights]);

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
          <h1 className="text-2xl font-semibold text-foreground">Ads</h1>
          <p className="text-muted text-sm mt-1">{ads.length} ads</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Read Only
          </span>
          <select
            value={selectedCampaign}
            onChange={(e) => {
              setSelectedCampaign(e.target.value);
              setSelectedAdSet("");
            }}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent max-w-[180px]"
          >
            <option value="">All Campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={selectedAdSet}
            onChange={(e) => setSelectedAdSet(e.target.value)}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent max-w-[180px]"
          >
            <option value="">All Ad Sets</option>
            {filteredAdSets.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
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

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-xs text-muted font-medium">Ad</th>
                <th className="text-left py-3 px-3 text-xs text-muted font-medium">Ad Set</th>
                <th className="text-center py-3 px-3 text-xs text-muted font-medium">Status</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Spend</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Impressions</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Clicks</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">CTR</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">CPC</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Conversions</th>
              </tr>
            </thead>
            <tbody>
              {sortedAds.map((ad) => {
                const ins = adInsights[ad.id]?.[0];
                return (
                  <tr key={ad.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                    <td className="py-3 px-4">
                      <p className="text-foreground truncate font-medium max-w-[250px]">{ad.name}</p>
                    </td>
                    <td className="py-3 px-3 text-muted text-xs truncate max-w-[150px]">
                      {adsetNameMap[ad.adset_id || ""] || "-"}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${statusBadge(ad.status)}`}>
                        {ad.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-foreground">{ins ? currency(num(ins.spend)) : "-"}</td>
                    <td className="py-3 px-3 text-right text-foreground">{ins ? Number(num(ins.impressions)).toLocaleString() : "-"}</td>
                    <td className="py-3 px-3 text-right text-foreground">{ins ? Number(num(ins.clicks)).toLocaleString() : "-"}</td>
                    <td className="py-3 px-3 text-right text-foreground">{ins ? `${num(ins.ctr).toFixed(2)}%` : "-"}</td>
                    <td className="py-3 px-3 text-right text-foreground">{ins ? currency(num(ins.cpc)) : "-"}</td>
                    <td className="py-3 px-3 text-right text-foreground">{ins ? getConversions(ins.actions) : "-"}</td>
                  </tr>
                );
              })}
              {sortedAds.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted text-sm">
                    <ImageIcon className="w-8 h-8 text-muted/30 mx-auto mb-2" />
                    No ads found
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
