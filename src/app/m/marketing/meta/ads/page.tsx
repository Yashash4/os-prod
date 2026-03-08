"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2, ImageIcon, Search, LayoutGrid, List, X, Play } from "lucide-react";
import { MetaTableSkeleton } from "@/components/Skeleton";
import { apiFetch } from "@/lib/api-fetch";

/* ── Types ─────────────────────────────────────────── */

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
  adset_id?: string;
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
  actions?: { action_type: string; value: string }[];
}

interface BulkAdSetRow {
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
}

interface BulkCampaignRow {
  campaign_id?: string;
  campaign_name?: string;
}

interface MergedAd extends BulkAdRow {
  status?: string;
  creative?: AdCreative;
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

const STATUS_OPTIONS = ["ALL", "ACTIVE", "PAUSED", "ARCHIVED"];

function num(val?: string) {
  return parseFloat(val || "0");
}

function currency(val: number) {
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function getConversions(actions?: { action_type: string; value: string }[]) {
  if (!actions) return 0;
  const purchase = actions.find((a) => a.action_type === "purchase");
  if (purchase) return parseInt(purchase.value);
  const lead = actions.find((a) => a.action_type === "lead");
  if (lead) return parseInt(lead.value);
  return 0;
}

function statusBadge(status: string) {
  const s = status.toUpperCase();
  if (s === "ACTIVE") return "bg-green-500/15 text-green-400 border-green-500/30";
  if (s === "PAUSED") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-gray-500/15 text-gray-400 border-gray-500/30";
}

/* ── Main Component ────────────────────────────────── */

export default function AdsPage() {
  const [rows, setRows] = useState<MergedAd[]>([]);
  const [adsetMap, setAdsetMap] = useState<Record<string, string>>({});
  const [campaignMap, setCampaignMap] = useState<Record<string, string>>({});
  const [adsetCampaignMap, setAdsetCampaignMap] = useState<Record<string, string>>({});
  const [datePreset, setDatePreset] = useState("last_30d");
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [selectedAdSet, setSelectedAdSet] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [expandedAdId, setExpandedAdId] = useState<string | null>(null);
  const [lightboxAd, setLightboxAd] = useState<MergedAd | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoPicture, setVideoPicture] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const [adRes, adsetRes, campRes, adsMetaRes] = await Promise.all([
          apiFetch(`/api/meta/ad-insights-bulk?date_preset=${datePreset}`),
          apiFetch(`/api/meta/adset-insights-bulk?date_preset=${datePreset}`),
          apiFetch(`/api/meta/campaign-insights-bulk?date_preset=${datePreset}`),
          apiFetch(`/api/meta/ads`),
        ]);
        const adData = await adRes.json();
        const adsetData = await adsetRes.json();
        const campData = await campRes.json();
        const adsMetaData = await adsMetaRes.json();

        if (adData.error) throw new Error(adData.error);

        // Build ad metadata map (creative + status)
        const adMetaMap: Record<string, AdMeta> = {};
        (adsMetaData.ads || []).forEach((ad: AdMeta) => {
          if (ad.id) adMetaMap[ad.id] = ad;
        });

        // Merge bulk insights with ad metadata
        const merged: MergedAd[] = (adData.insights || []).map((row: BulkAdRow) => {
          const meta = adMetaMap[row.ad_id || ""];
          return {
            ...row,
            status: meta?.status || "UNKNOWN",
            creative: meta?.creative,
          };
        });
        setRows(merged);

        // Build adset name map
        const aMap: Record<string, string> = {};
        const acMap: Record<string, string> = {};
        (adsetData.insights || []).forEach((r: BulkAdSetRow) => {
          if (r.adset_id) {
            aMap[r.adset_id] = r.adset_name || r.adset_id;
            if (r.campaign_id) acMap[r.adset_id] = r.campaign_id;
          }
        });
        setAdsetMap(aMap);
        setAdsetCampaignMap(acMap);

        // Build campaign name map
        const cMap: Record<string, string> = {};
        (campData.insights || []).forEach((r: BulkCampaignRow) => {
          if (r.campaign_id && r.campaign_name) {
            cMap[r.campaign_id] = r.campaign_name;
          }
        });
        setCampaignMap(cMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [datePreset]);

  // Open lightbox — fetch video source if video ad
  async function openLightbox(ad: MergedAd) {
    setLightboxAd(ad);
    setVideoSrc(null);
    setVideoPicture(null);
    if (ad.creative?.video_id) {
      setVideoLoading(true);
      try {
        const res = await apiFetch(`/api/meta/video?videoId=${ad.creative.video_id}`);
        const data = await res.json();
        if (data.source) setVideoSrc(data.source);
        if (data.picture) setVideoPicture(data.picture);
      } catch {
        // ignore — will show image fallback
      } finally {
        setVideoLoading(false);
      }
    }
  }

  // Derive campaign list for filter
  const campaigns = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    rows.forEach((r) => {
      const cid = r.campaign_id;
      if (cid && !seen.has(cid)) {
        seen.add(cid);
        result.push({ id: cid, name: campaignMap[cid] || cid });
      }
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, campaignMap]);

  // Derive adset list for filter (filtered by selected campaign)
  const adsets = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    rows.forEach((r) => {
      const asid = r.adset_id;
      if (asid && !seen.has(asid)) {
        if (!selectedCampaign || r.campaign_id === selectedCampaign) {
          seen.add(asid);
          result.push({ id: asid, name: adsetMap[asid] || asid });
        }
      }
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, adsetMap, selectedCampaign]);

  // Filter + sort
  const filteredRows = useMemo(() => {
    let filtered = rows;
    if (selectedCampaign) {
      filtered = filtered.filter((r) => r.campaign_id === selectedCampaign);
    }
    if (selectedAdSet) {
      filtered = filtered.filter((r) => r.adset_id === selectedAdSet);
    }
    if (statusFilter !== "ALL") {
      filtered = filtered.filter((r) => (r.status || "").toUpperCase() === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((r) => {
        const adName = (r.ad_name || "").toLowerCase();
        const title = (r.creative?.title || "").toLowerCase();
        const body = (r.creative?.body || "").toLowerCase();
        return adName.includes(q) || title.includes(q) || body.includes(q);
      });
    }
    return [...filtered].sort((a, b) => num(b.spend) - num(a.spend));
  }, [rows, selectedCampaign, selectedAdSet, statusFilter, search]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Ads</h1>
        <MetaTableSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Ads</h1>
          <p className="text-muted text-sm mt-1">{filteredRows.length} ads</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Read Only
          </span>
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search ads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent w-[160px]"
            />
          </div>
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === "ALL" ? "All Status" : s}</option>
            ))}
          </select>
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
            {adsets.map((a) => (
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
          {/* View toggle */}
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 ${viewMode === "table" ? "bg-accent/15 text-accent" : "bg-surface text-muted hover:text-foreground"}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 ${viewMode === "grid" ? "bg-accent/15 text-accent" : "bg-surface text-muted hover:text-foreground"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">{error}</div>
      )}

      {/* Grid View */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRows.map((row) => {
            const imgUrl = row.creative?.thumbnail_url || row.creative?.image_url;
            return (
              <div key={row.ad_id} className="bg-surface border border-border rounded-xl overflow-hidden hover:border-accent/30 transition-colors">
                {/* Creative image — clickable */}
                <div
                  className="h-40 bg-background/50 flex items-center justify-center overflow-hidden cursor-pointer relative"
                  onClick={() => openLightbox(row)}
                >
                  {imgUrl ? (
                    <img src={imgUrl} alt={row.ad_name || "Ad"} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-muted/30" />
                  )}
                  {row.creative?.video_id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
                        <Play className="w-5 h-5 text-white fill-white" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-foreground text-sm font-medium line-clamp-1">{row.ad_name || row.ad_id}</p>
                    {row.status && (
                      <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-medium flex-shrink-0 ${statusBadge(row.status)}`}>
                        {row.status}
                      </span>
                    )}
                  </div>
                  {row.creative?.title && (
                    <p className="text-xs text-accent line-clamp-1">{row.creative.title}</p>
                  )}
                  {row.creative?.body && (
                    <p className="text-xs text-muted line-clamp-2">{row.creative.body}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted pt-1 border-t border-border/50">
                    <span>Spend: <span className="text-foreground">{currency(num(row.spend))}</span></span>
                    <span>Clicks: <span className="text-foreground">{Number(num(row.clicks)).toLocaleString()}</span></span>
                    <span>CTR: <span className="text-foreground">{num(row.ctr).toFixed(2)}%</span></span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>Conv: <span className="text-foreground">{getConversions(row.actions)}</span></span>
                    <span className="text-muted truncate max-w-[140px]">{adsetMap[row.adset_id || ""] || ""}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredRows.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted text-sm">
              <ImageIcon className="w-8 h-8 text-muted/30 mx-auto mb-2" />
              No ads found
            </div>
          )}
        </div>
      ) : (
        /* Table View */
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-xs text-muted font-medium">Ad</th>
                  <th className="text-left py-3 px-3 text-xs text-muted font-medium">Creative</th>
                  <th className="text-left py-3 px-3 text-xs text-muted font-medium">Ad Set</th>
                  <th className="text-center py-3 px-3 text-xs text-muted font-medium">Status</th>
                  <th className="text-right py-3 px-3 text-xs text-muted font-medium">Spend</th>
                  <th className="text-right py-3 px-3 text-xs text-muted font-medium">Impressions</th>
                  <th className="text-right py-3 px-3 text-xs text-muted font-medium">Clicks</th>
                  <th className="text-right py-3 px-3 text-xs text-muted font-medium">CTR</th>
                  <th className="text-right py-3 px-3 text-xs text-muted font-medium">CPC</th>
                  <th className="text-right py-3 px-3 text-xs text-muted font-medium">Conv.</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const imgUrl = row.creative?.thumbnail_url || row.creative?.image_url;
                  const isExpanded = expandedAdId === row.ad_id;
                  return (
                    <tr
                      key={row.ad_id}
                      className="border-b border-border/50 hover:bg-surface-hover transition-colors cursor-pointer"
                      onClick={() => setExpandedAdId(isExpanded ? null : (row.ad_id || null))}
                    >
                      <td colSpan={10} className="p-0">
                        <div className="flex items-center px-4 py-3">
                          {/* Ad name */}
                          <div className="w-[200px] flex-shrink-0">
                            <p className="text-foreground truncate font-medium">
                              {row.ad_name || row.ad_id}
                            </p>
                          </div>
                          {/* Creative thumbnail + title */}
                          <div
                            className="w-[180px] flex-shrink-0 flex items-center gap-2 px-3 cursor-pointer hover:opacity-80"
                            onClick={(e) => { e.stopPropagation(); openLightbox(row); }}
                          >
                            {imgUrl ? (
                              <div className="relative w-8 h-8 flex-shrink-0">
                                <img src={imgUrl} alt="" className="w-8 h-8 rounded object-cover" />
                                {row.creative?.video_id && (
                                  <div className="absolute inset-0 flex items-center justify-center rounded bg-black/30">
                                    <Play className="w-3 h-3 text-white fill-white" />
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded bg-background/50 flex items-center justify-center flex-shrink-0">
                                <ImageIcon className="w-4 h-4 text-muted/40" />
                              </div>
                            )}
                            <span className="text-xs text-muted truncate">{row.creative?.title || "-"}</span>
                          </div>
                          {/* Ad Set */}
                          <div className="w-[140px] flex-shrink-0 px-3">
                            <span className="text-muted text-xs truncate block">{adsetMap[row.adset_id || ""] || "-"}</span>
                          </div>
                          {/* Status */}
                          <div className="w-[80px] flex-shrink-0 px-3 text-center">
                            {row.status && (
                              <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${statusBadge(row.status)}`}>
                                {row.status}
                              </span>
                            )}
                          </div>
                          {/* Metrics */}
                          <div className="flex-1 flex items-center justify-end gap-0">
                            <span className="w-20 text-right text-foreground text-xs">{currency(num(row.spend))}</span>
                            <span className="w-20 text-right text-foreground text-xs">{Number(num(row.impressions)).toLocaleString()}</span>
                            <span className="w-16 text-right text-foreground text-xs">{Number(num(row.clicks)).toLocaleString()}</span>
                            <span className="w-16 text-right text-foreground text-xs">{num(row.ctr).toFixed(2)}%</span>
                            <span className="w-16 text-right text-foreground text-xs">{currency(num(row.cpc))}</span>
                            <span className="w-14 text-right text-foreground text-xs">{getConversions(row.actions)}</span>
                          </div>
                        </div>
                        {/* Expanded creative detail */}
                        {isExpanded && (row.creative?.body || row.creative?.title) && (
                          <div className="px-4 pb-3 border-t border-border/30">
                            <div className="flex gap-4 pt-3">
                              {imgUrl && (
                                <img
                                  src={imgUrl}
                                  alt=""
                                  className="w-24 h-24 rounded-lg object-cover flex-shrink-0 cursor-pointer hover:opacity-80"
                                  onClick={(e) => { e.stopPropagation(); openLightbox(row); }}
                                />
                              )}
                              <div className="space-y-1 min-w-0">
                                {row.creative?.title && (
                                  <p className="text-sm font-medium text-accent">{row.creative.title}</p>
                                )}
                                {row.creative?.body && (
                                  <p className="text-xs text-muted whitespace-pre-wrap">{row.creative.body}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-muted text-sm">
                      <ImageIcon className="w-8 h-8 text-muted/30 mx-auto mb-2" />
                      No ads found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Creative Lightbox Modal ──────────────── */}
      {lightboxAd && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxAd(null)}
        >
          <div
            className="bg-surface border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <div className="min-w-0">
                <p className="text-foreground font-medium truncate">{lightboxAd.ad_name || lightboxAd.ad_id}</p>
                <p className="text-xs text-muted mt-0.5">{adsetMap[lightboxAd.adset_id || ""] || ""} · {campaignMap[lightboxAd.campaign_id || ""] || ""}</p>
              </div>
              <button
                onClick={() => setLightboxAd(null)}
                className="p-1.5 rounded-lg hover:bg-surface-hover text-muted hover:text-foreground transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Creative media — video or image */}
            <div className="bg-background/50">
              {lightboxAd.creative?.video_id ? (
                videoLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-accent mr-2" />
                    <span className="text-sm text-muted">Loading video...</span>
                  </div>
                ) : videoSrc ? (
                  <video
                    src={videoSrc}
                    controls
                    autoPlay
                    className="w-full max-h-[450px]"
                    poster={videoPicture || lightboxAd.creative.image_url || lightboxAd.creative.thumbnail_url}
                  />
                ) : (
                  <div className="relative">
                    <img
                      src={videoPicture || lightboxAd.creative.image_url || lightboxAd.creative.thumbnail_url}
                      alt={lightboxAd.ad_name || "Ad creative"}
                      className="w-full max-h-[400px] object-contain"
                    />
                    <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/70 px-2.5 py-1.5 rounded-lg">
                      <Play className="w-3.5 h-3.5 text-white fill-white" />
                      <span className="text-xs text-white/90">Video preview — direct playback requires additional API permissions</span>
                    </div>
                  </div>
                )
              ) : (lightboxAd.creative?.image_url || lightboxAd.creative?.thumbnail_url) ? (
                <img
                  src={lightboxAd.creative.image_url || lightboxAd.creative.thumbnail_url}
                  alt={lightboxAd.ad_name || "Ad creative"}
                  className="w-full max-h-[400px] object-contain"
                />
              ) : null}
            </div>

            {/* Creative text */}
            <div className="p-4 space-y-3">
              {lightboxAd.creative?.title && (
                <div>
                  <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Headline</p>
                  <p className="text-sm font-medium text-accent">{lightboxAd.creative.title}</p>
                </div>
              )}
              {lightboxAd.creative?.body && (
                <div>
                  <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Body</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{lightboxAd.creative.body}</p>
                </div>
              )}

              {/* Performance metrics */}
              <div className="border-t border-border/50 pt-3">
                <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Performance</p>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  <div>
                    <p className="text-[10px] text-muted">Spend</p>
                    <p className="text-sm font-medium text-foreground">{currency(num(lightboxAd.spend))}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted">Impressions</p>
                    <p className="text-sm font-medium text-foreground">{Number(num(lightboxAd.impressions)).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted">Clicks</p>
                    <p className="text-sm font-medium text-foreground">{Number(num(lightboxAd.clicks)).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted">CTR</p>
                    <p className="text-sm font-medium text-foreground">{num(lightboxAd.ctr).toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted">CPC</p>
                    <p className="text-sm font-medium text-foreground">{currency(num(lightboxAd.cpc))}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted">Conversions</p>
                    <p className="text-sm font-medium text-foreground">{getConversions(lightboxAd.actions)}</p>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${statusBadge(lightboxAd.status || "")}`}>
                  {lightboxAd.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
