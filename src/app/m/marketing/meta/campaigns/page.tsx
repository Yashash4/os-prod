"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  IndianRupee,
  Search,
  Download,
} from "lucide-react";
import { MetaTableSkeleton } from "@/components/Skeleton";
import { apiFetch } from "@/lib/api-fetch";
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
  background: "#171717",
  border: "1px solid #262626",
  borderRadius: "8px",
  color: "#F5F5F5",
};

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const res = await apiFetch("/api/meta/campaigns");
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const camps = data.campaigns || [];
        setCampaigns(camps);

        // Fetch all campaign insights in ONE call (avoids rate limits)
        const bulkRes = await apiFetch(`/api/meta/campaign-insights-bulk?date_preset=${datePreset}`);
        const bulkData = await bulkRes.json();
        const insightResults: Record<string, InsightRow[]> = {};
        (bulkData.insights || []).forEach((row: InsightRow & { campaign_id?: string }) => {
          if (row.campaign_id) {
            insightResults[row.campaign_id] = [row];
          }
        });
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
        const res = await apiFetch(
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

  // Status counts for filter pills
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: campaigns.length };
    campaigns.forEach((c) => {
      const s = c.status.toUpperCase();
      const bucket = s === "ACTIVE" ? "ACTIVE" : s === "PAUSED" ? "PAUSED" : "OTHER";
      counts[bucket] = (counts[bucket] || 0) + 1;
    });
    return counts;
  }, [campaigns]);

  const sortedCampaigns = useMemo(() => {
    let filtered = [...campaigns];
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (statusFilter !== "ALL") {
      filtered = filtered.filter((c) => {
        const s = c.status.toUpperCase();
        if (statusFilter === "OTHER") return s !== "ACTIVE" && s !== "PAUSED";
        return s === statusFilter;
      });
    }
    return filtered.sort((a, b) => {
      const spendA = num(campaignInsights[a.id]?.[0]?.spend);
      const spendB = num(campaignInsights[b.id]?.[0]?.spend);
      return spendB - spendA;
    });
  }, [campaigns, campaignInsights, search, statusFilter]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <h1 className="text-xl font-bold text-foreground tracking-tight">Campaigns</h1>
        </div>
        <MetaTableSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-accent rounded-full" />
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Campaigns</h1>
              <p className="text-muted text-xs mt-0.5">{sortedCampaigns.length} campaigns</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              const headers = ["Campaign Name", "Status", "Objective", "Budget", "Spend", "Impressions", "Clicks", "CTR", "CPC", "ROAS"];
              const csvRows = sortedCampaigns.map((camp) => {
                const ins = campaignInsights[camp.id]?.[0];
                const budget = camp.daily_budget
                  ? `${num(camp.daily_budget) / 100}/day`
                  : camp.lifetime_budget
                    ? `${num(camp.lifetime_budget) / 100} LT`
                    : "";
                return [
                  camp.name,
                  camp.status,
                  camp.objective?.replace(/_/g, " ") || "",
                  budget,
                  ins ? String(num(ins.spend)) : "",
                  ins ? String(num(ins.impressions)) : "",
                  ins ? String(num(ins.clicks)) : "",
                  ins ? `${num(ins.ctr).toFixed(2)}%` : "",
                  ins ? String(num(ins.cpc)) : "",
                  ins ? `${getRoas(ins).toFixed(2)}x` : "",
                ];
              });
              downloadCSV("campaigns.csv", headers, csvRows);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-accent/10 text-accent border border-accent/20 rounded-lg text-sm hover:bg-accent/20 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Read Only
          </span>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent w-[170px]"
            />
          </div>
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

      {/* Status filter pills */}
      <div className="flex items-center gap-1.5">
        {(["ALL", "ACTIVE", "PAUSED", "OTHER"] as const).map((s) => {
          const count = statusCounts[s] || 0;
          if (s !== "ALL" && count === 0) return null;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-accent/15 text-accent border border-accent/30"
                  : "bg-surface border border-border text-muted hover:text-foreground"
              }`}
            >
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()} ({count})
            </button>
          );
        })}
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">{error}</div>
      )}

      {/* Table */}
      <div className="card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-surface/80">
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
                  <React.Fragment key={camp.id}>
                    <tr
                      className="border-b border-border/50 hover:bg-surface-hover transition-colors cursor-pointer"
                      onClick={() => toggleExpand(camp.id)}
                    >
                      <td className="py-3 px-4 text-foreground font-medium truncate max-w-[250px]">{camp.name}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${statusBadge(camp.status)}`}>
                          {camp.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs text-muted">{camp.objective?.replace(/_/g, " ") || "-"}</td>
                      <td className="py-3 px-3 text-right text-xs text-foreground">{budget}</td>
                      <td className="py-3 px-3 text-right text-xs text-foreground">{ins ? currency(num(ins.spend)) : "-"}</td>
                      <td className="py-3 px-3 text-right text-xs text-foreground">{ins ? Number(num(ins.impressions)).toLocaleString() : "-"}</td>
                      <td className="py-3 px-3 text-right text-xs text-foreground">{ins ? Number(num(ins.clicks)).toLocaleString() : "-"}</td>
                      <td className="py-3 px-3 text-right text-xs text-foreground">{ins ? `${num(ins.ctr).toFixed(2)}%` : "-"}</td>
                      <td className="py-3 px-3 text-right text-xs text-foreground">{ins ? currency(num(ins.cpc)) : "-"}</td>
                      <td className="py-3 px-3 text-right text-xs text-foreground">{ins ? `${getRoas(ins).toFixed(2)}x` : "-"}</td>
                      <td className="py-3 px-1 w-8">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted" />
                        )}
                      </td>
                    </tr>
                    {/* Expanded detail */}
                    {isExpanded && (
                      <tr className="border-b border-border/50">
                        <td colSpan={11} className="p-0">
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
                                    <XAxis dataKey="date" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => currency(Number(v))} />
                                    <Line type="monotone" dataKey="spend" stroke="#B8860B" strokeWidth={2} dot={false} />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            ) : (
                              <div className="py-6 text-center text-muted text-xs">No daily data available</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
