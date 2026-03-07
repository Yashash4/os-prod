"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  IndianRupee,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ── Types ─────────────────────────────────────────── */

interface Campaign {
  id: string;
  name: string;
  status: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  created_time?: string;
}

interface InsightRow {
  date_start?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: { action_type: string; value: string }[];
  purchase_roas?: { action_type: string; value: string }[];
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

/* ── Helpers ───────────────────────────────────────── */

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

function getRoas(row: InsightRow) {
  if (!row.purchase_roas || row.purchase_roas.length === 0) return 0;
  return parseFloat(row.purchase_roas[0].value || "0");
}

/* ── Main Component ────────────────────────────────── */

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignInsights, setCampaignInsights] = useState<Record<string, InsightRow[]>>({});
  const [dailyInsights, setDailyInsights] = useState<Record<string, InsightRow[]>>({});
  const [datePreset, setDatePreset] = useState("last_30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/meta/campaigns");
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const camps = data.campaigns || [];
        setCampaigns(camps);

        // Fetch aggregate insights for all campaigns
        const insightResults: Record<string, InsightRow[]> = {};
        await Promise.all(
          camps.slice(0, 50).map(async (c: Campaign) => {
            try {
              const r = await fetch(
                `/api/meta/campaign-insights?campaignId=${c.id}&date_preset=${datePreset}&time_increment=all_days`
              );
              const d = await r.json();
              insightResults[c.id] = d.insights || [];
            } catch {
              insightResults[c.id] = [];
            }
          })
        );
        setCampaignInsights(insightResults);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [datePreset]);

  async function toggleExpand(campaignId: string) {
    if (expandedId === campaignId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(campaignId);

    if (!dailyInsights[campaignId]) {
      setExpandLoading(true);
      try {
        const res = await fetch(
          `/api/meta/campaign-insights?campaignId=${campaignId}&date_preset=${datePreset}&time_increment=1`
        );
        const data = await res.json();
        setDailyInsights((prev) => ({ ...prev, [campaignId]: data.insights || [] }));
      } catch {
        setDailyInsights((prev) => ({ ...prev, [campaignId]: [] }));
      } finally {
        setExpandLoading(false);
      }
    }
  }

  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      const spendA = num(campaignInsights[a.id]?.[0]?.spend);
      const spendB = num(campaignInsights[b.id]?.[0]?.spend);
      return spendB - spendA;
    });
  }, [campaigns, campaignInsights]);

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
          <h1 className="text-2xl font-semibold text-foreground">Campaigns</h1>
          <p className="text-muted text-sm mt-1">{campaigns.length} campaigns</p>
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
              <tr className="border-b border-border bg-surface">
                <th className="text-left py-3 px-4 text-xs text-muted font-medium">Campaign</th>
                <th className="text-center py-3 px-3 text-xs text-muted font-medium">Status</th>
                <th className="text-left py-3 px-3 text-xs text-muted font-medium">Objective</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Budget</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Spend</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Impressions</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Clicks</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">CTR</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">CPC</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">ROAS</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {sortedCampaigns.map((camp) => {
                const ins = campaignInsights[camp.id]?.[0];
                const isExpanded = expandedId === camp.id;
                const daily = dailyInsights[camp.id] || [];
                const budget = camp.daily_budget
                  ? `${currency(num(camp.daily_budget) / 100)}/day`
                  : camp.lifetime_budget
                    ? `${currency(num(camp.lifetime_budget) / 100)} LT`
                    : "-";

                return (
                  <tr key={camp.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                    <td colSpan={11} className="p-0">
                      <div
                        className="flex items-center cursor-pointer px-4 py-3"
                        onClick={() => toggleExpand(camp.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground truncate font-medium">{camp.name}</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs flex-shrink-0">
                          <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${statusBadge(camp.status)}`}>
                            {camp.status}
                          </span>
                          <span className="text-muted w-24 text-left">
                            {camp.objective?.replace(/_/g, " ") || "-"}
                          </span>
                          <span className="text-foreground w-24 text-right">{budget}</span>
                          <span className="text-foreground w-20 text-right">{ins ? currency(num(ins.spend)) : "-"}</span>
                          <span className="text-foreground w-20 text-right">{ins ? Number(num(ins.impressions)).toLocaleString() : "-"}</span>
                          <span className="text-foreground w-16 text-right">{ins ? Number(num(ins.clicks)).toLocaleString() : "-"}</span>
                          <span className="text-foreground w-16 text-right">{ins ? `${num(ins.ctr).toFixed(2)}%` : "-"}</span>
                          <span className="text-foreground w-16 text-right">{ins ? currency(num(ins.cpc)) : "-"}</span>
                          <span className="text-foreground w-16 text-right">{ins ? `${getRoas(ins).toFixed(2)}x` : "-"}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted" />
                          )}
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-border/30">
                          {expandLoading ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="w-4 h-4 animate-spin text-accent mr-2" />
                              <span className="text-xs text-muted">Loading daily data...</span>
                            </div>
                          ) : daily.length > 0 ? (
                            <div className="pt-3">
                              <p className="text-xs text-muted mb-2">Daily Spend Trend</p>
                              <ResponsiveContainer width="100%" height={180}>
                                <LineChart
                                  data={daily
                                    .filter((r) => r.date_start)
                                    .sort((a, b) => (a.date_start || "").localeCompare(b.date_start || ""))
                                    .map((r) => ({
                                      date: r.date_start?.slice(5) || "",
                                      spend: num(r.spend),
                                    }))}
                                >
                                  <XAxis dataKey="date" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                                  <YAxis tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                                  <Line type="monotone" dataKey="spend" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <div className="py-6 text-center text-muted text-xs">No daily data available</div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sortedCampaigns.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-muted text-sm">
                    <IndianRupee className="w-8 h-8 text-muted/30 mx-auto mb-2" />
                    No campaigns found
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
