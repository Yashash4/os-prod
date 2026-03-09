"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Loader2,
  Search,
  ImageIcon,
  Eye,
  AlertTriangle,
  Star,
  Zap,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

/* ── Types ─────────────────────────────────────────── */

interface AdInsight {
  ad_id?: string;
  ad_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  frequency?: string;
}

interface AdMeta {
  id: string;
  name: string;
  status: string;
  campaign_id?: string;
  creative?: {
    image_url?: string;
    thumbnail_url?: string;
  };
}

interface TrackerEntry {
  id: string;
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  status: string;
  fatigue_score: number;
  notes: string;
}

interface MergedRow {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  thumbnail: string;
  spend: number;
  impressions: number;
  ctr: number;
  frequency: number;
  tracker?: TrackerEntry;
  status: string;
  fatigue_score: number;
  notes: string;
}

/* ── Constants ─────────────────────────────────────── */

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "watch", label: "Watch" },
  { value: "fatigued", label: "Fatigued" },
  { value: "retired", label: "Retired" },
  { value: "top_performer", label: "Top Performer" },
];

const FILTER_PILLS = ["All", "Active", "Watch", "Fatigued", "Retired", "Top Performer"];

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-500/15 text-green-400 border-green-500/30";
    case "watch":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "fatigued":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    case "retired":
      return "bg-gray-500/15 text-gray-400 border-gray-500/30";
    case "top_performer":
      return "bg-purple-500/15 text-purple-400 border-purple-500/30";
    default:
      return "bg-gray-500/15 text-gray-400 border-gray-500/30";
  }
}

function frequencyClass(freq: number): string {
  if (freq > 5) return "text-red-400 font-semibold";
  if (freq > 3) return "text-amber-400 font-semibold";
  return "text-foreground";
}

function num(val?: string) {
  return parseFloat(val || "0");
}

function currency(val: number) {
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function compact(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toLocaleString();
}

function filterToStatus(pill: string): string {
  if (pill === "All") return "";
  if (pill === "Top Performer") return "top_performer";
  return pill.toLowerCase();
}

/* ── Main Component ────────────────────────────────── */

export default function CreativeTrackerPage() {
  const [rows, setRows] = useState<MergedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [insightsRes, adsMetaRes, trackerRes] = await Promise.all([
        apiFetch("/api/meta/ad-insights-bulk?date_preset=last_7d"),
        apiFetch("/api/meta/ads"),
        apiFetch("/api/meta/creative-tracker"),
      ]);
      const insightsData = await insightsRes.json();
      const adsMetaData = await adsMetaRes.json();
      const trackerData = await trackerRes.json();

      if (insightsData.error) throw new Error(insightsData.error);

      const insights: AdInsight[] = insightsData.insights || [];
      const adsMeta: AdMeta[] = adsMetaData.ads || [];
      const trackerEntries: TrackerEntry[] = trackerData.entries || [];

      // Build maps
      const metaMap: Record<string, AdMeta> = {};
      adsMeta.forEach((a) => {
        metaMap[a.id] = a;
      });

      const trackerMap: Record<string, TrackerEntry> = {};
      trackerEntries.forEach((e) => {
        trackerMap[e.ad_id] = e;
      });

      // Build campaign name map from metadata
      const campaignNameMap: Record<string, string> = {};
      // We'll derive campaign names from the ads metadata campaign_id
      // For simplicity, use campaign_id as fallback
      adsMeta.forEach((a) => {
        if (a.campaign_id && !campaignNameMap[a.campaign_id]) {
          campaignNameMap[a.campaign_id] = a.campaign_id;
        }
      });

      // Merge
      const merged: MergedRow[] = insights.map((ins) => {
        const adId = ins.ad_id || "";
        const meta = metaMap[adId];
        const tracker = trackerMap[adId];
        const campaignId = meta?.campaign_id || "";
        const campaignName = tracker?.campaign_name || campaignId;

        return {
          ad_id: adId,
          ad_name: ins.ad_name || meta?.name || adId,
          campaign_name: campaignName,
          thumbnail:
            meta?.creative?.thumbnail_url || meta?.creative?.image_url || "",
          spend: num(ins.spend),
          impressions: num(ins.impressions),
          ctr: num(ins.ctr),
          frequency: num(ins.frequency),
          tracker,
          status: tracker?.status || "active",
          fatigue_score: tracker?.fatigue_score ?? 0,
          notes: tracker?.notes || "",
        };
      });

      setRows(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Inline save ────────────────────────────── */

  async function saveField(
    row: MergedRow,
    field: "status" | "fatigue_score" | "notes",
    value: string | number
  ) {
    setSavingIds((prev) => new Set(prev).add(row.ad_id));
    try {
      if (row.tracker) {
        // PUT — update existing
        await apiFetch("/api/meta/creative-tracker", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: row.tracker.id, [field]: value }),
        });
        setRows((prev) =>
          prev.map((r) =>
            r.ad_id === row.ad_id
              ? {
                  ...r,
                  [field]: value,
                  tracker: { ...r.tracker!, [field]: value },
                }
              : r
          )
        );
      } else {
        // POST — create new
        const body = {
          ad_id: row.ad_id,
          ad_name: row.ad_name,
          campaign_name: row.campaign_name,
          status: field === "status" ? value : row.status,
          fatigue_score:
            field === "fatigue_score" ? value : row.fatigue_score,
          notes: field === "notes" ? value : row.notes,
        };
        const res = await apiFetch("/api/meta/creative-tracker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        const newEntry: TrackerEntry = data.entry || {
          id: data.id || "",
          ...body,
        };
        setRows((prev) =>
          prev.map((r) =>
            r.ad_id === row.ad_id
              ? { ...r, [field]: value, tracker: newEntry }
              : r
          )
        );
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(row.ad_id);
        return next;
      });
    }
  }

  /* ── Computed ────────────────────────────────── */

  const filtered = useMemo(() => {
    let result = rows;
    const sf = filterToStatus(statusFilter);
    if (sf) {
      result = result.filter((r) => r.status === sf);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.ad_name.toLowerCase().includes(q));
    }
    return result;
  }, [rows, search, statusFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.status === "active").length;
    const watch = rows.filter((r) => r.status === "watch").length;
    const fatigued = rows.filter((r) => r.status === "fatigued").length;
    return { total, active, watch, fatigued };
  }, [rows]);

  /* ── Render ─────────────────────────────────── */

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-5 h-5 animate-spin text-accent mr-2" />
        <span className="text-sm text-muted">
          Loading creative tracker...
        </span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-1 h-6 bg-accent rounded-full" />
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            Creative Tracker
          </h1>
          <p className="text-muted text-xs mt-0.5">
            Monitor creative fatigue and performance
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <ImageIcon className="w-4 h-4 text-accent" />
            <span className="text-xs text-muted">Total Creatives</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
        </div>
        <div className="card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-green-400" />
            <span className="text-xs text-muted">Active</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.active}</p>
        </div>
        <div className="card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Eye className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-muted">Watch List</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.watch}</p>
        </div>
        <div className="card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-muted">Fatigued</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {stats.fatigued}
          </p>
        </div>
      </div>

      {/* Filter Pills + Search */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          {FILTER_PILLS.map((pill) => (
            <button
              key={pill}
              onClick={() => setStatusFilter(pill)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === pill
                  ? "bg-accent/15 text-accent border border-accent/30"
                  : "bg-surface border border-border text-muted hover:text-foreground"
              }`}
            >
              {pill}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search ads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 bg-background/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent w-[180px]"
          />
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-surface/80">
                <th className="text-left py-3 px-3 text-xs text-muted font-medium w-[50px]"></th>
                <th className="text-left py-3 px-3 text-xs text-muted font-medium">
                  Ad Name
                </th>
                <th className="text-left py-3 px-3 text-xs text-muted font-medium">
                  Campaign
                </th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">
                  Spend
                </th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">
                  Impressions
                </th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">
                  CTR
                </th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">
                  Frequency
                </th>
                <th className="text-center py-3 px-3 text-xs text-muted font-medium">
                  Status
                </th>
                <th className="text-center py-3 px-3 text-xs text-muted font-medium">
                  Fatigue
                </th>
                <th className="text-left py-3 px-3 text-xs text-muted font-medium">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <CreativeRow
                  key={row.ad_id}
                  row={row}
                  saving={savingIds.has(row.ad_id)}
                  onStatusChange={(val) => saveField(row, "status", val)}
                  onFatigueChange={(val) =>
                    saveField(row, "fatigue_score", val)
                  }
                  onNotesChange={(val) => saveField(row, "notes", val)}
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="py-12 text-center text-muted text-sm"
                  >
                    <ImageIcon className="w-8 h-8 text-muted/30 mx-auto mb-2" />
                    {rows.length === 0
                      ? "No creatives found"
                      : "No creatives match your filters"}
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

/* ── Row Component ─────────────────────────────────── */

function CreativeRow({
  row,
  saving,
  onStatusChange,
  onFatigueChange,
  onNotesChange,
}: {
  row: MergedRow;
  saving: boolean;
  onStatusChange: (val: string) => void;
  onFatigueChange: (val: number) => void;
  onNotesChange: (val: string) => void;
}) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [localNotes, setLocalNotes] = useState(row.notes);
  const [localFatigue, setLocalFatigue] = useState(
    String(row.fatigue_score)
  );

  useEffect(() => {
    setLocalNotes(row.notes);
  }, [row.notes]);

  useEffect(() => {
    setLocalFatigue(String(row.fatigue_score));
  }, [row.fatigue_score]);

  return (
    <tr className="border-b border-border/50 hover:bg-surface-hover transition-colors">
      {/* Thumbnail */}
      <td className="py-2 px-3">
        {row.thumbnail ? (
          <img
            src={row.thumbnail}
            alt=""
            className="w-10 h-10 rounded object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded bg-background/50 flex items-center justify-center">
            <ImageIcon className="w-4 h-4 text-muted/40" />
          </div>
        )}
      </td>
      {/* Ad Name */}
      <td className="py-3 px-3 text-foreground font-medium truncate max-w-[200px]">
        {row.ad_name}
      </td>
      {/* Campaign */}
      <td className="py-3 px-3 text-xs text-muted truncate max-w-[150px]">
        {row.campaign_name || "-"}
      </td>
      {/* Spend */}
      <td className="py-3 px-3 text-right text-xs text-foreground">
        {currency(row.spend)}
      </td>
      {/* Impressions */}
      <td className="py-3 px-3 text-right text-xs text-foreground">
        {compact(row.impressions)}
      </td>
      {/* CTR */}
      <td className="py-3 px-3 text-right text-xs text-foreground">
        {row.ctr.toFixed(2)}%
      </td>
      {/* Frequency */}
      <td
        className={`py-3 px-3 text-right text-xs ${frequencyClass(row.frequency)}`}
      >
        {row.frequency.toFixed(2)}
      </td>
      {/* Status */}
      <td className="py-3 px-3 text-center">
        <div className="flex items-center justify-center gap-1">
          {saving && (
            <Loader2 className="w-3 h-3 animate-spin text-accent flex-shrink-0" />
          )}
          <select
            value={row.status}
            onChange={(e) => onStatusChange(e.target.value)}
            className={`px-2 py-1 rounded-md border text-xs font-medium focus:outline-none focus:border-accent ${statusBadgeClass(row.status)}`}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </td>
      {/* Fatigue Score */}
      <td className="py-3 px-3 text-center">
        <input
          type="number"
          min={0}
          max={10}
          value={localFatigue}
          onChange={(e) => setLocalFatigue(e.target.value)}
          onBlur={() => {
            const val = Math.min(10, Math.max(0, parseInt(localFatigue) || 0));
            setLocalFatigue(String(val));
            if (val !== row.fatigue_score) {
              onFatigueChange(val);
            }
          }}
          className="w-14 px-2 py-1 bg-background/50 border border-border rounded-md text-foreground text-xs text-center focus:outline-none focus:border-accent"
        />
      </td>
      {/* Notes */}
      <td className="py-3 px-3 min-w-[180px]">
        {editingNotes ? (
          <input
            type="text"
            autoFocus
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
            onBlur={() => {
              setEditingNotes(false);
              if (localNotes !== row.notes) {
                onNotesChange(localNotes);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-full px-2 py-1 bg-background/50 border border-border rounded-md text-foreground text-xs focus:outline-none focus:border-accent"
          />
        ) : (
          <span
            onClick={() => setEditingNotes(true)}
            className="block w-full px-2 py-1 text-xs text-muted cursor-pointer hover:text-foreground rounded-md hover:bg-background/50 transition-colors truncate"
          >
            {row.notes || "Click to add notes..."}
          </span>
        )}
      </td>
    </tr>
  );
}
