"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Users,
  CheckCircle,
  Clock,
  Pause,
  RefreshCw,
  Star,
  TrendingUp,
  AlertTriangle,
  CalendarCheck,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { OnboardingSkeleton } from "@/components/Skeleton";

/* ── Types ─────────────────────────────────────────── */

interface OnboardingRecord {
  opportunity_id: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  source_rep?: string;
  fees_quoted?: number;
  fees_collected?: number;
  onboarding_status: string;
  assigned_onboarder?: string;
  meeting_date?: string;
  meeting_notes?: string;
  brand_rating?: number;
  brand_description?: string;
  client_notes?: string;
  checklist?: { id: string; label: string; done: boolean }[];
  follow_up_date?: string;
  created_at?: string;
  updated_at?: string;
}

/* ── Constants ─────────────────────────────────────── */

const TOOLTIP_STYLE = {
  background: "#1a1a1a",
  border: "1px solid #262626",
  borderRadius: "8px",
  color: "#ededed",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "#3b82f6",
  in_progress: "#f59e0b",
  completed: "#22c55e",
  on_hold: "#6b7280",
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  on_hold: "On Hold",
};

const PIE_COLORS = ["#3b82f6", "#f59e0b", "#22c55e", "#6b7280", "#8b5cf6", "#ec4899"];

/* ── Main Component ────────────────────────────────── */

export default function OnboardingAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<OnboardingRecord[]>([]);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/sales/onboarding-tracking");
        const data = await res.json();
        setRecords(data.records || []);
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  /* ── Computed metrics ──────────────────────────── */

  const total = records.length;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    records.forEach((r) => {
      counts[r.onboarding_status] = (counts[r.onboarding_status] || 0) + 1;
    });
    return counts;
  }, [records]);

  const statusData = useMemo(
    () =>
      Object.entries(statusCounts).map(([status, count]) => ({
        name: STATUS_LABELS[status] || status,
        value: count,
        color: STATUS_COLORS[status] || "#6b7280",
      })),
    [statusCounts]
  );

  const completionRate = total > 0 ? Math.round(((statusCounts["completed"] || 0) / total) * 100) : 0;

  // Brand rating distribution
  const ratingDist = useMemo(() => {
    const dist = [0, 0, 0, 0, 0]; // index 0 = rating 1, etc.
    records.forEach((r) => {
      if (r.brand_rating && r.brand_rating >= 1 && r.brand_rating <= 5) {
        dist[r.brand_rating - 1]++;
      }
    });
    return dist.map((count, i) => ({ rating: `${i + 1} Star`, value: count }));
  }, [records]);

  const avgRating = useMemo(() => {
    const rated = records.filter((r) => r.brand_rating && r.brand_rating >= 1);
    if (rated.length === 0) return 0;
    const sum = rated.reduce((s, r) => s + (r.brand_rating || 0), 0);
    return Math.round((sum / rated.length) * 10) / 10;
  }, [records]);

  const unratedCount = records.filter((r) => !r.brand_rating).length;

  // Source rep breakdown
  const repData = useMemo(() => {
    const map: Record<string, { total: number; completed: number; avgRating: number; ratingCount: number }> = {};
    records.forEach((r) => {
      const rep = r.source_rep || "Unknown";
      if (!map[rep]) map[rep] = { total: 0, completed: 0, avgRating: 0, ratingCount: 0 };
      map[rep].total++;
      if (r.onboarding_status === "completed") map[rep].completed++;
      if (r.brand_rating) {
        map[rep].avgRating += r.brand_rating;
        map[rep].ratingCount++;
      }
    });
    return Object.entries(map).map(([rep, d]) => ({
      rep,
      total: d.total,
      completed: d.completed,
      completionRate: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
      avgRating: d.ratingCount > 0 ? Math.round((d.avgRating / d.ratingCount) * 10) / 10 : 0,
    }));
  }, [records]);

  // Checklist progress
  const checklistStats = useMemo(() => {
    let totalItems = 0;
    let doneItems = 0;
    const itemCounts: Record<string, { done: number; total: number }> = {};

    records.forEach((r) => {
      const cl = r.checklist || [];
      cl.forEach((item) => {
        totalItems++;
        if (item.done) doneItems++;
        if (!itemCounts[item.label]) itemCounts[item.label] = { done: 0, total: 0 };
        itemCounts[item.label].total++;
        if (item.done) itemCounts[item.label].done++;
      });
    });

    const perItem = Object.entries(itemCounts).map(([label, d]) => ({
      label,
      pct: d.total > 0 ? Math.round((d.done / d.total) * 100) : 0,
      done: d.done,
      total: d.total,
    }));

    return {
      overallPct: totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0,
      perItem,
    };
  }, [records]);

  // Overdue follow-ups
  const overdueFollowUps = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return records.filter((r) => {
      if (!r.follow_up_date || r.onboarding_status === "completed") return false;
      return new Date(r.follow_up_date) < now;
    });
  }, [records]);

  // Revenue
  const totalQuoted = records.reduce((s, r) => s + (r.fees_quoted || 0), 0);
  const totalCollected = records.reduce((s, r) => s + (r.fees_collected || 0), 0);

  /* ── Render ────────────────────────────────────── */

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Onboarding Analytics</h1>
        <OnboardingSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">Onboarding Analytics</h1>

      {/* ── Row 1: Key Metrics ────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard icon={Users} label="Total Clients" value={total} iconBg="bg-blue-500/10" iconColor="text-blue-400" />
        <MetricCard icon={CheckCircle} label="Completed" value={statusCounts["completed"] || 0} sub={`${completionRate}%`} iconBg="bg-green-500/10" iconColor="text-green-400" />
        <MetricCard icon={RefreshCw} label="In Progress" value={statusCounts["in_progress"] || 0} iconBg="bg-amber-500/10" iconColor="text-amber-400" />
        <MetricCard icon={Star} label="Avg Brand Rating" value={avgRating || "-"} sub={`${unratedCount} unrated`} iconBg="bg-amber-500/10" iconColor="text-amber-400" />
        <MetricCard icon={AlertTriangle} label="Overdue Follow-ups" value={overdueFollowUps.length} iconBg="bg-red-500/10" iconColor="text-red-400" />
      </div>

      {/* ── Row 2: Status Pie + Checklist Progress ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-sm font-medium text-foreground mb-3">Status Distribution</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 flex-1">
              {statusData.map((s) => (
                <div key={s.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-xs text-foreground">{s.name}</span>
                  </div>
                  <span className="text-xs text-muted">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-sm font-medium text-foreground mb-1">Checklist Completion</h3>
          <p className="text-xs text-muted mb-3">Overall: {checklistStats.overallPct}% complete across all clients</p>
          <div className="space-y-2">
            {checklistStats.perItem.map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-foreground truncate mr-2">{item.label}</span>
                  <span className="text-muted flex-shrink-0">{item.done}/{item.total} ({item.pct}%)</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 3: Brand Rating + Revenue ──────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-sm font-medium text-foreground mb-3">Brand Rating Distribution</h3>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="flex items-center gap-1 justify-center mb-1">
                <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                <span className="text-3xl font-bold text-foreground">{avgRating}</span>
              </div>
              <p className="text-xs text-muted">Avg Rating</p>
            </div>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={ratingDist} layout="vertical">
                  <XAxis type="number" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="rating" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-sm font-medium text-foreground mb-3">Revenue from Onboarded Clients</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-muted">Total Quoted</p>
              <p className="text-xl font-bold text-foreground">₹{totalQuoted.toLocaleString("en-IN")}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Total Collected</p>
              <p className="text-xl font-bold text-green-400">₹{totalCollected.toLocaleString("en-IN")}</p>
            </div>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full"
              style={{ width: `${totalQuoted > 0 ? (totalCollected / totalQuoted) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-muted mt-1">
            {totalQuoted > 0 ? Math.round((totalCollected / totalQuoted) * 100) : 0}% collection rate
          </p>
        </div>
      </div>

      {/* ── Row 4: Per-Rep Breakdown ──────────────── */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">By Sales Rep</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-xs text-muted font-medium">Rep</th>
                <th className="text-right py-2 px-3 text-xs text-muted font-medium">Total</th>
                <th className="text-right py-2 px-3 text-xs text-muted font-medium">Completed</th>
                <th className="text-right py-2 px-3 text-xs text-muted font-medium">Completion %</th>
                <th className="text-right py-2 px-3 text-xs text-muted font-medium">Avg Brand Rating</th>
              </tr>
            </thead>
            <tbody>
              {repData.map((row) => (
                <tr key={row.rep} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                  <td className="py-2.5 px-3 text-foreground">{row.rep}</td>
                  <td className="py-2.5 px-3 text-right text-foreground">{row.total}</td>
                  <td className="py-2.5 px-3 text-right text-green-400">{row.completed}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={row.completionRate >= 75 ? "text-green-400" : row.completionRate >= 50 ? "text-amber-400" : "text-red-400"}>
                      {row.completionRate}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Star className={`w-3 h-3 ${row.avgRating >= 1 ? "text-amber-400 fill-amber-400" : "text-zinc-600"}`} />
                      <span className="text-foreground">{row.avgRating || "-"}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Row 5: Overdue Follow-ups ─────────────── */}
      {overdueFollowUps.length > 0 && (
        <div className="bg-surface border border-red-500/20 rounded-xl p-4">
          <h3 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Overdue Follow-ups ({overdueFollowUps.length})
          </h3>
          <div className="space-y-2">
            {overdueFollowUps.map((r) => {
              const daysOverdue = Math.floor(
                (new Date().getTime() - new Date(r.follow_up_date!).getTime()) / (1000 * 60 * 60 * 24)
              );
              return (
                <div key={r.opportunity_id} className="flex items-center justify-between py-2 px-3 bg-red-500/5 rounded-lg">
                  <div>
                    <p className="text-sm text-foreground">{r.contact_name}</p>
                    <p className="text-xs text-muted">{r.source_rep} · {r.assigned_onboarder || "Unassigned"}</p>
                  </div>
                  <span className="text-xs text-red-400">{daysOverdue}d overdue</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Metric Card ──────────────────────────────────── */

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  iconBg,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-[10px] text-muted">{sub}</p>}
      </div>
    </div>
  );
}
