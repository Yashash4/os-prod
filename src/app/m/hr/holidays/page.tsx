"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  PartyPopper,
  Plus,
  Loader2,
  Trash2,
  Calendar,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

interface Holiday {
  id: string;
  name: string;
  date: string;
  is_optional: boolean;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const INPUT =
  "bg-background/50 border border-border rounded-lg px-3 py-1.5 text-sm w-full";
const LABEL = "text-[11px] text-muted uppercase tracking-wider mb-1 block";

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");

  // Form state
  const [fName, setFName] = useState("");
  const [fDate, setFDate] = useState("");
  const [fOptional, setFOptional] = useState(false);

  function showToast(msg: string, duration = 2500) {
    setToast(msg);
    setTimeout(() => setToast(""), duration);
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/hr/holidays");
      const data = await res.json();
      setHolidays(data.holidays || []);
    } catch (err) {
      console.error("Fetch holidays failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Group holidays by month
  const grouped = useMemo(() => {
    const map = new Map<number, Holiday[]>();
    for (const h of holidays) {
      const month = new Date(h.date).getMonth();
      if (!map.has(month)) map.set(month, []);
      map.get(month)!.push(h);
    }
    // Sort by month
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [holidays]);

  async function handleAdd() {
    if (!fName.trim() || !fDate) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/hr/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fName.trim(),
          date: fDate,
          is_optional: fOptional,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to add holiday", 4000);
        return;
      }
      setFName("");
      setFDate("");
      setFOptional(false);
      setShowForm(false);
      showToast("Holiday added");
      fetchData();
    } catch (err) {
      console.error("Add holiday failed:", err);
      showToast("Failed to add holiday", 4000);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this holiday?")) return;
    try {
      const res = await apiFetch(`/api/hr/holidays?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || "Failed to delete holiday", 4000);
        return;
      }
      showToast("Holiday deleted");
      fetchData();
    } catch (err) {
      console.error("Delete holiday failed:", err);
      showToast("Failed to delete holiday", 4000);
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-[1000px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PartyPopper className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold">Holidays</h1>
          <span className="text-sm text-muted">({holidays.length})</span>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Holiday
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-medium">New Holiday</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Holiday Name *</label>
              <input
                type="text"
                value={fName}
                onChange={(e) => setFName(e.target.value)}
                className={INPUT}
                placeholder="e.g. Republic Day"
              />
            </div>
            <div>
              <label className={LABEL}>Date *</label>
              <input
                type="date"
                value={fDate}
                onChange={(e) => setFDate(e.target.value)}
                className={INPUT}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer py-1.5">
                <input
                  type="checkbox"
                  checked={fOptional}
                  onChange={(e) => setFOptional(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-accent"
                />
                <span className="text-sm text-muted">Optional Holiday</span>
              </label>
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={submitting || !fName.trim() || !fDate}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Adding..." : "Add Holiday"}
          </button>
        </div>
      )}

      {/* Holiday List Grouped by Month */}
      {grouped.length === 0 && !loading && (
        <div className="text-center py-16 text-muted text-sm">
          No holidays found. Add your first holiday above.
        </div>
      )}

      {grouped.map(([month, monthHolidays]) => (
        <div key={month} className="space-y-2">
          <h2 className="text-xs text-muted uppercase tracking-wider font-medium px-1">
            {MONTH_NAMES[month]}
          </h2>
          <div className="space-y-1.5">
            {monthHolidays.map((h) => (
              <div
                key={h.id}
                className="card border border-border rounded-xl px-5 py-3 flex items-center gap-4 hover:bg-surface-hover transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4.5 h-4.5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{h.name}</p>
                    {h.is_optional && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                        Optional
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted">{formatDate(h.date)}</p>
                </div>
                <button
                  onClick={() => handleDelete(h.id)}
                  className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete holiday"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-surface border border-border rounded-lg px-4 py-2.5 shadow-lg text-sm text-foreground z-50 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
          {toast}
        </div>
      )}
    </div>
  );
}
