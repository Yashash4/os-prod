"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2, ChevronDown, ChevronUp, Layers } from "lucide-react";

/* ── Types ─────────────────────────────────────────── */

interface Campaign {
  id: string;
  name: string;
  status: string;
}

interface AdSet {
  id: string;
  name: string;
  status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  bid_amount?: string;
  campaign_id?: string;
  targeting?: {
    age_min?: number;
    age_max?: number;
    genders?: number[];
    geo_locations?: { countries?: string[] };
    publisher_platforms?: string[];
  };
}

interface InsightRow {
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
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

/* ── Main Component ────────────────────────────────── */

export default function AdSetsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adsets, setAdsets] = useState<AdSet[]>([]);
  const [adsetInsights, setAdsetInsights] = useState<Record<string, InsightRow[]>>({});
  const [datePreset, setDatePreset] = useState("last_30d");
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const res = await fetch("/api/meta/campaigns");
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      } catch {
        // silent
      }
    }
    fetchCampaigns();
  }, []);

  useEffect(() => {
    async function fetchAdSets() {
      setLoading(true);
      setError("");
      try {
        const url = selectedCampaign
          ? `/api/meta/adsets?campaignId=${selectedCampaign}`
          : "/api/meta/adsets";
        const res = await fetch(url);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const sets = data.adsets || [];
        setAdsets(sets);

        // Fetch insights for each ad set
        const insightResults: Record<string, InsightRow[]> = {};
        await Promise.all(
          sets.slice(0, 50).map(async (a: AdSet) => {
            try {
              const r = await fetch(
                `/api/meta/adset-insights?adSetId=${a.id}&date_preset=${datePreset}&time_increment=all_days`
              );
              const d = await r.json();
              insightResults[a.id] = d.insights || [];
            } catch {
              insightResults[a.id] = [];
            }
          })
        );
        setAdsetInsights(insightResults);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchAdSets();
  }, [selectedCampaign, datePreset]);

  const campaignNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    campaigns.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [campaigns]);

  const sortedAdSets = useMemo(() => {
    return [...adsets].sort((a, b) => {
      const spendA = num(adsetInsights[a.id]?.[0]?.spend);
      const spendB = num(adsetInsights[b.id]?.[0]?.spend);
      return spendB - spendA;
    });
  }, [adsets, adsetInsights]);

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
          <h1 className="text-2xl font-semibold text-foreground">Ad Sets</h1>
          <p className="text-muted text-sm mt-1">{adsets.length} ad sets</p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-xs text-muted font-medium">Ad Set</th>
                <th className="text-left py-3 px-3 text-xs text-muted font-medium">Campaign</th>
                <th className="text-center py-3 px-3 text-xs text-muted font-medium">Status</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Budget</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Spend</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Impressions</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Clicks</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">CTR</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">CPC</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {sortedAdSets.map((adset) => {
                const ins = adsetInsights[adset.id]?.[0];
                const isExpanded = expandedId === adset.id;
                const budget = adset.daily_budget
                  ? `${currency(num(adset.daily_budget) / 100)}/day`
                  : adset.lifetime_budget
                    ? `${currency(num(adset.lifetime_budget) / 100)} LT`
                    : "-";

                return (
                  <tr key={adset.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                    <td colSpan={10} className="p-0">
                      <div
                        className="flex items-center cursor-pointer px-4 py-3"
                        onClick={() => setExpandedId(isExpanded ? null : adset.id)}
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="text-foreground truncate font-medium">{adset.name}</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs flex-shrink-0">
                          <span className="text-muted w-32 truncate text-left">
                            {campaignNameMap[adset.campaign_id || ""] || "-"}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${statusBadge(adset.status)}`}>
                            {adset.status}
                          </span>
                          <span className="text-foreground w-24 text-right">{budget}</span>
                          <span className="text-foreground w-20 text-right">{ins ? currency(num(ins.spend)) : "-"}</span>
                          <span className="text-foreground w-20 text-right">{ins ? Number(num(ins.impressions)).toLocaleString() : "-"}</span>
                          <span className="text-foreground w-16 text-right">{ins ? Number(num(ins.clicks)).toLocaleString() : "-"}</span>
                          <span className="text-foreground w-16 text-right">{ins ? `${num(ins.ctr).toFixed(2)}%` : "-"}</span>
                          <span className="text-foreground w-16 text-right">{ins ? currency(num(ins.cpc)) : "-"}</span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
                        </div>
                      </div>

                      {isExpanded && adset.targeting && (
                        <div className="px-4 pb-4 border-t border-border/30">
                          <div className="pt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-[10px] text-muted mb-0.5">Age Range</p>
                              <p className="text-xs text-foreground">
                                {adset.targeting.age_min || 18} - {adset.targeting.age_max || 65}+
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted mb-0.5">Gender</p>
                              <p className="text-xs text-foreground">
                                {!adset.targeting.genders || adset.targeting.genders.length === 0
                                  ? "All"
                                  : adset.targeting.genders.map((g) => (g === 1 ? "Male" : g === 2 ? "Female" : "All")).join(", ")}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted mb-0.5">Countries</p>
                              <p className="text-xs text-foreground">
                                {adset.targeting.geo_locations?.countries?.join(", ") || "All"}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted mb-0.5">Platforms</p>
                              <p className="text-xs text-foreground">
                                {adset.targeting.publisher_platforms?.join(", ") || "All"}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sortedAdSets.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted text-sm">
                    <Layers className="w-8 h-8 text-muted/30 mx-auto mb-2" />
                    No ad sets found
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
