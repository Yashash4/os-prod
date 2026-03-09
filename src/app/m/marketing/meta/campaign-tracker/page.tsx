"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Loader2,
  Search,
  BarChart3,
  CheckCircle2,
  TrendingUp,
  PauseCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

/* ── Types ─────────────────────────────────────────── */

interface MetaCampaign {
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  status?: string;
}

interface TrackerEntry {
  id: string;
  campaign_id: string;
  campaign_name: string;
  log_date: string;
  action: string;
  notes: string;
}

interface MergedRow {
  campaign_id: string;
  campaign_name: string;
  status: string;
  spend: number;
  ctr: number;
  cpc: number;
  tracker?: TrackerEntry;
  action: string;
  notes: string;
}

/* ── Constants ─────────────────────────────────────── */

const ACTION_OPTIONS = [
  { value: "", label: "-- Select --" },
  { value: "scale_up", label: "Scale Up" },
  { value: "scale_down", label: "Scale Down" },
  { value: "pause", label: "Pause" },
  { value: "restart", label: "Restart" },
  { value: "adjust_audience", label: "Adjust Audience" },
  { value: "adjust_creative", label: "Adjust Creative" },
  { value: "no_change", label: "No Change" },
  { value: "kill", label: "Kill" },
];

function actionBadgeClass(action: string): string {
  switch (action) {
    case "scale_up":
      return "bg-green-500/15 text-green-400 border-green-500/30";
    case "scale_down":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "pause":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    case "kill":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    case "restart":
      return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "adjust_audience":
    case "adjust_creative":
      return "bg-purple-500/15 text-purple-400 border-purple-500/30";
    case "no_change":
      return "bg-gray-500/15 text-gray-400 border-gray-500/30";
    default:
      return "";
  }
}

function statusBadge(status: string) {
  const s = status.toUpperCase();
  if (s === "ACTIVE") return "bg-green-500/15 text-green-400 border-green-500/30";
  if (s === "PAUSED") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-gray-500/15 text-gray-400 border-gray-500/30";
}

function num(val?: string) {
  return parseFloat(val || "0");
}

function currency(val: number) {
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/* ── Main Component ────────────────────────────────── */

export default function CampaignTrackerPage() {
  const [rows, setRows] = useState<MergedRow[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [metaRes, trackerRes] = await Promise.all([
        apiFetch("/api/meta/campaign-insights-bulk?date_preset=today"),
        apiFetch(
          `/api/meta/campaign-tracker?from=${selectedDate}&to=${selectedDate}`
        ),
      ]);
      const metaData = await metaRes.json();
      const trackerData = await trackerRes.json();

      if (metaData.error) throw new Error(metaData.error);

      const campaigns: MetaCampaign[] = metaData.insights || [];
      const trackerEntries: TrackerEntry[] = trackerData.entries || [];

      // Build tracker map by campaign_id
      const trackerMap: Record<string, TrackerEntry> = {};
      trackerEntries.forEach((e) => {
        trackerMap[e.campaign_id] = e;
      });

      // Merge
      const merged: MergedRow[] = campaigns.map((c) => {
        const tracker = trackerMap[c.campaign_id || ""];
        return {
          campaign_id: c.campaign_id || "",
          campaign_name: c.campaign_name || c.campaign_id || "",
          status: c.status || "UNKNOWN",
          spend: num(c.spend),
          ctr: num(c.ctr),
          cpc: num(c.cpc),
          tracker,
          action: tracker?.action || "",
          notes: tracker?.notes || "",
        };
      });

      setRows(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Inline save ────────────────────────────── */

  async function saveField(
    row: MergedRow,
    field: "action" | "notes",
    value: string
  ) {
    setSavingIds((prev) => new Set(prev).add(row.campaign_id));
    try {
      if (row.tracker) {
        // PUT — update existing
        await apiFetch("/api/meta/campaign-tracker", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: row.tracker.id, [field]: value }),
        });
        // Update local state
        setRows((prev) =>
          prev.map((r) =>
            r.campaign_id === row.campaign_id
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
          campaign_id: row.campaign_id,
          campaign_name: row.campaign_name,
          log_date: selectedDate,
          action: field === "action" ? value : row.action,
          notes: field === "notes" ? value : row.notes,
        };
        const res = await apiFetch("/api/meta/campaign-tracker", {
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
            r.campaign_id === row.campaign_id
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
        next.delete(row.campaign_id);
        return next;
      });
    }
  }

  /* ── Computed ────────────────────────────────── */

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.campaign_name.toLowerCase().includes(q));
  }, [rows, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const tracked = rows.filter((r) => r.tracker).length;
    const scaledUp = rows.filter((r) => r.action === "scale_up").length;
    const pausedKilled = rows.filter(
      (r) => r.action === "pause" || r.action === "kill"
    ).length;
    return { total, tracked, scaledUp, pausedKilled };
  }, [rows]);

  /* ── Render ─────────────────────────────────── */

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-5 h-5 animate-spin text-accent mr-2" />
        <span className="text-sm text-muted">Loading campaign tracker...</span>
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
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              Campaign Tracker
            </h1>
            <p className="text-muted text-xs mt-0.5">
              Daily decision log per campaign
            </p>
          </div>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
        />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-accent" />
            <span className="text-xs text-muted">Active Campaigns</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
        </div>
        <div className="card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-accent" />
            <span className="text-xs text-muted">Decisions Today</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.tracked}</p>
        </div>
        <div className="card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-xs text-muted">Scaled Up</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {stats.scaledUp}
          </p>
        </div>
        <div className="card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <PauseCircle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-muted">Paused / Killed</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {stats.pausedKilled}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Search campaigns..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 pr-3 py-2 w-full bg-background/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
        />
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
                <th className="text-left py-3 px-4 text-xs text-muted font-medium">
                  Campaign Name
                </th>
                <th className="text-center py-3 px-3 text-xs text-muted font-medium">
                  Status
                </th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">
                  Spend
                </th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">
                  CTR
                </th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">
                  CPC
                </th>
                <th className="text-center py-3 px-3 text-xs text-muted font-medium">
                  Action
                </th>
                <th className="text-left py-3 px-3 text-xs text-muted font-medium">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <CampaignRow
                  key={row.campaign_id}
                  row={row}
                  saving={savingIds.has(row.campaign_id)}
                  onActionChange={(val) => saveField(row, "action", val)}
                  onNotesChange={(val) => saveField(row, "notes", val)}
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-muted text-sm"
                  >
                    <BarChart3 className="w-8 h-8 text-muted/30 mx-auto mb-2" />
                    {rows.length === 0
                      ? "No campaigns found for today"
                      : "No campaigns match your search"}
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

function CampaignRow({
  row,
  saving,
  onActionChange,
  onNotesChange,
}: {
  row: MergedRow;
  saving: boolean;
  onActionChange: (val: string) => void;
  onNotesChange: (val: string) => void;
}) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [localNotes, setLocalNotes] = useState(row.notes);

  // Sync when row changes from external save
  useEffect(() => {
    setLocalNotes(row.notes);
  }, [row.notes]);

  return (
    <tr className="border-b border-border/50 hover:bg-surface-hover transition-colors">
      <td className="py-3 px-4 text-foreground font-medium truncate max-w-[250px]">
        {row.campaign_name}
      </td>
      <td className="py-3 px-3 text-center">
        <span
          className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${statusBadge(row.status)}`}
        >
          {row.status}
        </span>
      </td>
      <td className="py-3 px-3 text-right text-xs text-foreground">
        {currency(row.spend)}
      </td>
      <td className="py-3 px-3 text-right text-xs text-foreground">
        {row.ctr.toFixed(2)}%
      </td>
      <td className="py-3 px-3 text-right text-xs text-foreground">
        {currency(row.cpc)}
      </td>
      <td className="py-3 px-3 text-center">
        <div className="flex items-center justify-center gap-1">
          {saving && (
            <Loader2 className="w-3 h-3 animate-spin text-accent flex-shrink-0" />
          )}
          {row.action && !saving ? (
            <span
              className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${actionBadgeClass(row.action)} mr-1`}
            >
              {row.action.replace(/_/g, " ")}
            </span>
          ) : null}
          <select
            value={row.action}
            onChange={(e) => onActionChange(e.target.value)}
            className="px-2 py-1 bg-background/50 border border-border rounded-md text-foreground text-xs focus:outline-none focus:border-accent"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </td>
      <td className="py-3 px-3 min-w-[200px]">
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
