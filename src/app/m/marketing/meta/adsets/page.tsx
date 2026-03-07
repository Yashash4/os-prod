"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2, Layers } from "lucide-react";

/* ── Types ─────────────────────────────────────────── */

interface BulkAdSetRow {
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
}

interface BulkCampaignRow {
  campaign_id?: string;
  campaign_name?: string;
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

/* ── Main Component ────────────────────────────────── */

export default function AdSetsPage() {
  const [rows, setRows] = useState<BulkAdSetRow[]>([]);
  const [campaignMap, setCampaignMap] = useState<Record<string, string>>({});
  const [datePreset, setDatePreset] = useState("last_30d");
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        // Only 2 Meta API calls total (bulk endpoints)
        const [adsetRes, campRes] = await Promise.all([
          fetch(`/api/meta/adset-insights-bulk?date_preset=${datePreset}`),
          fetch(`/api/meta/campaign-insights-bulk?date_preset=${datePreset}`),
        ]);
        const adsetData = await adsetRes.json();
        const campData = await campRes.json();

        if (adsetData.error) throw new Error(adsetData.error);

        setRows(adsetData.insights || []);

        const map: Record<string, string> = {};
        (campData.insights || []).forEach((r: BulkCampaignRow) => {
          if (r.campaign_id && r.campaign_name) {
            map[r.campaign_id] = r.campaign_name;
          }
        });
        setCampaignMap(map);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [datePreset]);

  const campaigns = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    rows.forEach((r) => {
      if (r.campaign_id && !seen.has(r.campaign_id)) {
        seen.add(r.campaign_id);
        result.push({
          id: r.campaign_id,
          name: campaignMap[r.campaign_id] || r.campaign_id,
        });
      }
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, campaignMap]);

  const filteredRows = useMemo(() => {
    let filtered = rows;
    if (selectedCampaign) {
      filtered = rows.filter((r) => r.campaign_id === selectedCampaign);
    }
    return [...filtered].sort((a, b) => num(b.spend) - num(a.spend));
  }, [rows, selectedCampaign]);

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
          <p className="text-muted text-sm mt-1">{filteredRows.length} ad sets</p>
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
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Spend</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Impressions</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Reach</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Clicks</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">CTR</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">CPC</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">CPM</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.adset_id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                  <td className="py-3 px-4">
                    <p className="text-foreground truncate font-medium max-w-[280px]">
                      {row.adset_name || row.adset_id}
                    </p>
                  </td>
                  <td className="py-3 px-3 text-muted text-xs truncate max-w-[180px]">
                    {campaignMap[row.campaign_id || ""] || "-"}
                  </td>
                  <td className="py-3 px-3 text-right text-foreground">{currency(num(row.spend))}</td>
                  <td className="py-3 px-3 text-right text-foreground">{Number(num(row.impressions)).toLocaleString()}</td>
                  <td className="py-3 px-3 text-right text-foreground">{Number(num(row.reach)).toLocaleString()}</td>
                  <td className="py-3 px-3 text-right text-foreground">{Number(num(row.clicks)).toLocaleString()}</td>
                  <td className="py-3 px-3 text-right text-foreground">{`${num(row.ctr).toFixed(2)}%`}</td>
                  <td className="py-3 px-3 text-right text-foreground">{currency(num(row.cpc))}</td>
                  <td className="py-3 px-3 text-right text-foreground">{currency(num(row.cpm))}</td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted text-sm">
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
