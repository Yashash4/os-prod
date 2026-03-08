"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, ChevronDown } from "lucide-react";

const PRESETS: { label: string; days: number }[] = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 28 days", days: 28 },
  { label: "Last 3 months", days: 90 },
  { label: "Last 6 months", days: 180 },
  { label: "Last 12 months", days: 365 },
];

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export interface DateRange {
  startDate: string;
  endDate: string;
  prevStartDate: string;
  prevEndDate: string;
  days: number;
  compare: boolean;
}

interface Props {
  onChange: (range: DateRange) => void;
  defaultDays?: number;
  showCompare?: boolean;
  showGranularity?: boolean;
  granularity?: "day" | "week" | "month";
  onGranularityChange?: (g: "day" | "week" | "month") => void;
  presets?: { label: string; days: number }[];
}

export default function DateRangeFilter({
  onChange,
  defaultDays = 28,
  showCompare = true,
  showGranularity = false,
  granularity = "day",
  onGranularityChange,
  presets = PRESETS,
}: Props) {
  const defaultPresetIdx = presets.findIndex((p) => p.days === defaultDays);
  const [presetIdx, setPresetIdx] = useState(defaultPresetIdx >= 0 ? defaultPresetIdx : 0);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [compare, setCompare] = useState(false);
  const [showCustom, setShowCustom] = useState(false);

  const buildRange = useCallback(
    (start: string, end: string, days: number, cmp: boolean): DateRange => {
      const prevEnd = new Date(start);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - days + 1);
      return {
        startDate: start,
        endDate: end,
        prevStartDate: toDateStr(prevStart),
        prevEndDate: toDateStr(prevEnd),
        days,
        compare: cmp,
      };
    },
    []
  );

  const handlePreset = (idx: number) => {
    setPresetIdx(idx);
    setShowCustom(false);
    setCustomStart("");
    setCustomEnd("");
    const days = presets[idx].days;
    const end = toDateStr(new Date());
    const start = toDateStr(daysAgo(days));
    onChange(buildRange(start, end, days, compare));
  };

  const handleCustomApply = () => {
    if (!customStart || !customEnd) return;
    const ms = new Date(customEnd).getTime() - new Date(customStart).getTime();
    const days = Math.max(1, Math.round(ms / 86400000));
    setPresetIdx(-1);
    onChange(buildRange(customStart, customEnd, days, compare));
  };

  const handleCompareToggle = () => {
    const newCmp = !compare;
    setCompare(newCmp);
    if (customStart && customEnd) {
      const ms = new Date(customEnd).getTime() - new Date(customStart).getTime();
      const days = Math.max(1, Math.round(ms / 86400000));
      onChange(buildRange(customStart, customEnd, days, newCmp));
    } else if (presetIdx >= 0) {
      const days = presets[presetIdx].days;
      onChange(buildRange(toDateStr(daysAgo(days)), toDateStr(new Date()), days, newCmp));
    }
  };

  // Fire initial range
  useEffect(() => {
    const days = presets[presetIdx >= 0 ? presetIdx : 0].days;
    onChange(buildRange(toDateStr(daysAgo(days)), toDateStr(new Date()), days, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Preset buttons */}
      <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
        {presets.map((p, i) => (
          <button
            key={i}
            onClick={() => handlePreset(i)}
            className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
              presetIdx === i && !showCustom
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom toggle */}
      <button
        onClick={() => setShowCustom(!showCustom)}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
          showCustom ? "bg-accent text-white border-accent" : "bg-surface border-border text-muted hover:text-foreground"
        }`}
      >
        <Calendar className="w-3.5 h-3.5" />
        Custom
        <ChevronDown className={`w-3 h-3 transition-transform ${showCustom ? "rotate-180" : ""}`} />
      </button>

      {/* Custom date inputs */}
      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="bg-surface border border-border rounded-lg px-2 py-1 text-xs"
          />
          <span className="text-muted text-xs">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="bg-surface border border-border rounded-lg px-2 py-1 text-xs"
          />
          <button
            onClick={handleCustomApply}
            disabled={!customStart || !customEnd}
            className="bg-accent text-white px-3 py-1 rounded-lg text-xs hover:bg-accent/90 disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}

      {/* Compare toggle */}
      {showCompare && (
        <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none ml-1">
          <input
            type="checkbox"
            checked={compare}
            onChange={handleCompareToggle}
            className="rounded border-border accent-accent"
          />
          Compare
        </label>
      )}

      {/* Granularity */}
      {showGranularity && onGranularityChange && (
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1 ml-1">
          {(["day", "week", "month"] as const).map((g) => (
            <button
              key={g}
              onClick={() => onGranularityChange(g)}
              className={`px-2 py-1 rounded-md text-xs capitalize transition-colors ${
                granularity === g ? "bg-accent text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Utility: aggregate daily data by granularity ── */

export function aggregateByGranularity<T extends { date: string }>(
  data: T[],
  granularity: "day" | "week" | "month",
  sumFields: (keyof T)[]
): T[] {
  if (granularity === "day") return data;

  const buckets = new Map<string, T[]>();
  for (const row of data) {
    const d = new Date(row.date);
    let key: string;
    if (granularity === "week") {
      const dayOfWeek = d.getDay();
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - dayOfWeek);
      key = toDateStr(weekStart);
    } else {
      key = row.date.slice(0, 7) + "-01";
    }
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(row);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, rows]) => {
      const agg = { ...rows[0], date: key };
      for (const field of sumFields) {
        (agg as Record<string, unknown>)[field as string] = rows.reduce(
          (sum, r) => sum + (Number(r[field]) || 0),
          0
        );
      }
      // Average fields not in sumFields (like ctr, position)
      return agg;
    });
}
