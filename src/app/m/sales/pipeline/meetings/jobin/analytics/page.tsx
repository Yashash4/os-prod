"use client";

import { useEffect, useState, useMemo } from "react";
import {
  CalendarCheck,
  UserCheck,
  UserX,
  TrendingUp,
  DollarSign,
  Target,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Star,
  MessageSquare,
  CreditCard,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Phone,
  Mail,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { AnalyticsSkeleton } from "@/components/Skeleton";
import { apiFetch } from "@/lib/api-fetch";

/* ── Types ─────────────────────────────────────────── */

interface GHLUser { id: string; name: string; email: string; }
interface CalendarEvent { id: string; startTime: string; endTime: string; appointmentStatus?: string; assignedUserId?: string; contactId?: string; }
interface CalendarItem { id: string; name: string; teamMembers?: { userId: string }[]; }

interface MeetRecord {
  opportunity_id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  pipeline_name: string;
  stage_name: string;
  source: string;
  status: string;
  rating: number | null;
  comments: string | null;
  notes: string | null;
  assigned_to: string | null;
  contact_id: string | null;
  ghl_status: string | null;
  meet_notes: string | null;
  outcome: string | null;
  created_at: string;
}

interface SalesRecord {
  opportunity_id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  source: string;
  fees_quoted: number;
  fees_collected: number;
  pending_amount: number;
  collection_status: string;
  onboarding_status: string;
  payment_mode: string | null;
  invoice_number: string | null;
  closed_date: string | null;
  sales_notes: string | null;
  assigned_to: string | null;
  ghl_status: string | null;
  created_at: string;
}

type ActiveTab = "overview" | "setter" | "conversions" | "payments";

/* ── Constants ────────────────────────────────────── */

const TOOLTIP_STYLE = {
  background: "#171717",
  border: "1px solid #262626",
  borderRadius: "8px",
  color: "#F5F5F5",
};

const GHL_STATUSES = [
  { value: "all", label: "All", color: "text-accent", bg: "bg-accent/10 border-accent/20" },
  { value: "open", label: "Open", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  { value: "won", label: "Won", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  { value: "lost", label: "Lost", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  { value: "abandoned", label: "Abandoned", color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20" },
];

const SETTER_STATUSES = [
  { value: "pending_review", label: "Pending Review", color: "text-blue-400", bg: "bg-blue-500/10" },
  { value: "call_done", label: "Call Done", color: "text-amber-400", bg: "bg-amber-500/10" },
  { value: "right_fit", label: "Right Fit", color: "text-green-400", bg: "bg-green-500/10" },
  { value: "not_a_fit", label: "Not a Fit", color: "text-red-400", bg: "bg-red-500/10" },
  { value: "needs_followup", label: "Needs Followup", color: "text-orange-400", bg: "bg-orange-500/10" },
  { value: "onboarded", label: "Onboarded", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { value: "declined", label: "Declined", color: "text-gray-400", bg: "bg-gray-500/10" },
];

const ONBOARDING_STATUSES = [
  { value: "not_started", label: "Not Started", color: "text-gray-400", bg: "bg-gray-500/10" },
  { value: "in_progress", label: "In Progress", color: "text-blue-400", bg: "bg-blue-500/10" },
  { value: "completed", label: "Completed", color: "text-green-400", bg: "bg-green-500/10" },
  { value: "on_hold", label: "On Hold", color: "text-amber-400", bg: "bg-amber-500/10" },
];

const PIE_COLORS = ["#B8860B", "#3B82F6", "#22C55E", "#EF4444", "#F97316", "#8B5CF6", "#06B6D4", "#EC4899"];

/* ── Main Component ────────────────────────────────── */

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [jobinUserId, setJobinUserId] = useState<string | null>(null);
  const [meetRecords, setMeetRecords] = useState<MeetRecord[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  // Filters
  const [ghlFilter, setGhlFilter] = useState("all");
  const [setterFilter, setSetterFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");

  useEffect(() => {
    async function init() {
      try {
        const [usersRes, meetRes, salesRes, calRes] = await Promise.all([
          apiFetch("/api/ghl/users"),
          apiFetch("/api/sales/jobin-meet-tracking"),
          apiFetch("/api/sales/jobin-sales-tracking"),
          apiFetch("/api/ghl/calendars"),
        ]);
        const usersData = await usersRes.json();
        const meetData = await meetRes.json();
        const salesData = await salesRes.json();
        const calData = await calRes.json();

        const usrs = usersData.users || [];
        const jobin = usrs.find((u: GHLUser) => u.name.toLowerCase().includes("jobin"));
        const jobId = jobin?.id || null;
        setJobinUserId(jobId);

        if (!meetData.error) setMeetRecords(meetData.records || []);
        if (!salesData.error) setSalesRecords(salesData.records || []);

        if (jobin && calData.calendars) {
          const cals = calData.calendars as CalendarItem[];
          const jobinCals = cals.filter((c) => c.teamMembers?.some((tm) => tm.userId === jobin.id));
          if (jobinCals.length > 0) {
            const now = new Date();
            const start = new Date(now); start.setMonth(start.getMonth() - 6);
            const end = new Date(now); end.setMonth(end.getMonth() + 1);
            const allEvents: CalendarEvent[] = [];
            const results = await Promise.all(
              jobinCals.map((cal) =>
                apiFetch(`/api/ghl/calendar-events?calendarId=${cal.id}&startTime=${start.toISOString()}&endTime=${end.toISOString()}`).then((r) => r.json())
              )
            );
            results.forEach((data) => { if (data.events) allEvents.push(...data.events); });
            setCalendarEvents(allEvents.filter((ev) => ev.assignedUserId === jobin.id));
          }
        }
      } catch { /* silent */ } finally { setLoading(false); }
    }
    init();
  }, []);

  // Base records for this user
  const jobinMeetRecords = useMemo(() => {
    if (!jobinUserId) return meetRecords;
    return meetRecords.filter((r) => r.assigned_to === jobinUserId);
  }, [meetRecords, jobinUserId]);

  const jobinSalesRecords = useMemo(() => {
    if (!jobinUserId) return salesRecords;
    return salesRecords.filter((r) => r.assigned_to === jobinUserId);
  }, [salesRecords, jobinUserId]);

  // Filtered records based on global filters
  const filteredMeetRecords = useMemo(() => {
    return jobinMeetRecords.filter((r) => {
      if (ghlFilter !== "all" && (r.ghl_status || "open") !== ghlFilter) return false;
      if (setterFilter !== "all" && r.status !== setterFilter) return false;
      return true;
    });
  }, [jobinMeetRecords, ghlFilter, setterFilter]);

  const filteredOppIds = useMemo(() => new Set(filteredMeetRecords.map((r) => r.opportunity_id)), [filteredMeetRecords]);

  const filteredSalesRecords = useMemo(() => {
    if (ghlFilter === "all" && setterFilter === "all") return jobinSalesRecords;
    return jobinSalesRecords.filter((r) => filteredOppIds.has(r.opportunity_id));
  }, [jobinSalesRecords, filteredOppIds, ghlFilter, setterFilter]);

  // ── Stats (all driven by filtered data) ──

  const meetingStats = useMemo(() => {
    const totalBooked = calendarEvents.length;
    const showed = calendarEvents.filter((e) => e.appointmentStatus === "showed").length;
    const confirmed = calendarEvents.filter((e) => e.appointmentStatus === "confirmed").length;
    const noShow = calendarEvents.filter((e) => e.appointmentStatus === "noshow" || e.appointmentStatus === "no_show").length;
    const cancelled = calendarEvents.filter((e) => e.appointmentStatus === "cancelled").length;
    const showRate = totalBooked > 0 ? (showed / totalBooked) * 100 : 0;
    const noShowRate = totalBooked > 0 ? (noShow / totalBooked) * 100 : 0;
    return { totalBooked, showed, confirmed, noShow, cancelled, showRate, noShowRate };
  }, [calendarEvents]);

  const pipelineStats = useMemo(() => {
    const total = filteredMeetRecords.length;
    const open = filteredMeetRecords.filter((r) => (r.ghl_status || "open") === "open").length;
    const won = filteredMeetRecords.filter((r) => r.ghl_status === "won").length;
    const lost = filteredMeetRecords.filter((r) => r.ghl_status === "lost").length;
    const abandoned = filteredMeetRecords.filter((r) => r.ghl_status === "abandoned").length;
    const rightFit = filteredMeetRecords.filter((r) => r.status === "right_fit").length;
    const conversionRate = total > 0 ? (won / total) * 100 : 0;
    const lossRate = total > 0 ? (lost / total) * 100 : 0;
    const rightFitRate = total > 0 ? (rightFit / total) * 100 : 0;
    return { total, open, won, lost, abandoned, rightFit, conversionRate, lossRate, rightFitRate };
  }, [filteredMeetRecords]);

  const revenueStats = useMemo(() => {
    const totalQuoted = filteredSalesRecords.reduce((s, r) => s + (r.fees_quoted || 0), 0);
    const totalCollected = filteredSalesRecords.reduce((s, r) => s + (r.fees_collected || 0), 0);
    const totalPending = filteredSalesRecords.reduce((s, r) => s + (r.pending_amount || 0), 0);
    const fullyPaid = filteredSalesRecords.filter((r) => r.collection_status === "fully_paid").length;
    const partial = filteredSalesRecords.filter((r) => r.collection_status === "partial").length;
    const overdue = filteredSalesRecords.filter((r) => r.collection_status === "overdue").length;
    const collectionRate = totalQuoted > 0 ? (totalCollected / totalQuoted) * 100 : 0;
    const avgDealSize = filteredSalesRecords.length > 0 ? totalQuoted / filteredSalesRecords.length : 0;
    return { totalQuoted, totalCollected, totalPending, fullyPaid, partial, overdue, collectionRate, avgDealSize, totalDeals: filteredSalesRecords.length };
  }, [filteredSalesRecords]);

  const sourceBreakdown = useMemo(() => {
    const map: Record<string, { total: number; won: number; totalRating: number; ratedCount: number }> = {};
    filteredMeetRecords.forEach((r) => {
      const src = r.source || "Unknown";
      if (!map[src]) map[src] = { total: 0, won: 0, totalRating: 0, ratedCount: 0 };
      map[src].total++;
      if (r.ghl_status === "won") map[src].won++;
      if (r.rating) { map[src].totalRating += r.rating; map[src].ratedCount++; }
    });
    return Object.entries(map)
      .map(([source, data]) => ({
        source, ...data,
        rate: data.total > 0 ? (data.won / data.total) * 100 : 0,
        avgRating: data.ratedCount > 0 ? data.totalRating / data.ratedCount : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredMeetRecords]);

  const monthlyTrend = useMemo(() => {
    const months: Record<string, { booked: number; won: number; revenue: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[key] = { booked: 0, won: 0, revenue: 0 };
    }
    calendarEvents.forEach((ev) => { const d = new Date(ev.startTime); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; if (months[key]) months[key].booked++; });
    filteredMeetRecords.forEach((r) => { const d = new Date(r.created_at); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; if (months[key] && r.ghl_status === "won") months[key].won++; });
    filteredSalesRecords.forEach((r) => { const d = new Date(); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; if (months[key]) months[key].revenue += r.fees_collected || 0; });
    return Object.entries(months).map(([key, data]) => {
      const [y, m] = key.split("-");
      const label = new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", { month: "short" });
      return { label, ...data };
    });
  }, [calendarEvents, filteredMeetRecords, filteredSalesRecords]);

  // Setter analysis data
  const setterStats = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    SETTER_STATUSES.forEach((s) => { statusCounts[s.value] = 0; });
    const ratingCounts = [0, 0, 0, 0, 0]; // index 0=1star ... 4=5star
    let totalRating = 0;
    let ratedCount = 0;
    let unrated = 0;

    filteredMeetRecords.forEach((r) => {
      if (r.status && statusCounts[r.status] !== undefined) statusCounts[r.status]++;
      if (r.rating && r.rating >= 1 && r.rating <= 5) {
        ratingCounts[r.rating - 1]++;
        totalRating += r.rating;
        ratedCount++;
      } else {
        unrated++;
      }
    });

    const avgRating = ratedCount > 0 ? totalRating / ratedCount : 0;
    const ratingData = [1, 2, 3, 4, 5].map((star) => ({ star: `${star}★`, count: ratingCounts[star - 1] }));
    const statusData = SETTER_STATUSES.map((s) => ({ ...s, count: statusCounts[s.value] || 0 }));
    return { statusData, ratingData, avgRating, ratedCount, unrated };
  }, [filteredMeetRecords]);

  // Notes feed
  const notesFeed = useMemo(() => {
    return filteredMeetRecords
      .filter((r) => r.notes || r.comments || r.meet_notes || r.outcome)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [filteredMeetRecords]);

  // Conversion data
  const convertedLeads = useMemo(() => {
    const salesMap = new Map(filteredSalesRecords.map((s) => [s.opportunity_id, s]));
    return filteredMeetRecords
      .filter((r) => r.ghl_status === "won")
      .map((r) => ({ ...r, sales: salesMap.get(r.opportunity_id) || null }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [filteredMeetRecords, filteredSalesRecords]);

  const lostLeads = useMemo(() => {
    return filteredMeetRecords
      .filter((r) => r.ghl_status === "lost" || r.ghl_status === "abandoned")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [filteredMeetRecords]);

  // Payment data
  const paymentModeData = useMemo(() => {
    const map: Record<string, { count: number; quoted: number; collected: number }> = {};
    filteredSalesRecords.forEach((r) => {
      const mode = r.payment_mode || "Not Set";
      if (!map[mode]) map[mode] = { count: 0, quoted: 0, collected: 0 };
      map[mode].count++;
      map[mode].quoted += r.fees_quoted || 0;
      map[mode].collected += r.fees_collected || 0;
    });
    return Object.entries(map).map(([mode, data]) => ({
      mode, ...data,
      collectionRate: data.quoted > 0 ? (data.collected / data.quoted) * 100 : 0,
    })).sort((a, b) => b.collected - a.collected);
  }, [filteredSalesRecords]);

  const onboardingData = useMemo(() => {
    const counts: Record<string, number> = {};
    ONBOARDING_STATUSES.forEach((s) => { counts[s.value] = 0; });
    filteredSalesRecords.forEach((r) => {
      const st = r.onboarding_status || "not_started";
      if (counts[st] !== undefined) counts[st]++;
    });
    const completed = counts["completed"] || 0;
    const total = filteredSalesRecords.length;
    return { counts, completionRate: total > 0 ? (completed / total) * 100 : 0, total };
  }, [filteredSalesRecords]);

  const overdueAlerts = useMemo(() => {
    return filteredSalesRecords
      .filter((r) => r.collection_status === "overdue" || (r.pending_amount > 0 && r.collection_status !== "fully_paid"))
      .sort((a, b) => (b.pending_amount || 0) - (a.pending_amount || 0));
  }, [filteredSalesRecords]);

  // GHL filter counts (from unfiltered data)
  const ghlCounts = useMemo(() => {
    const counts: Record<string, number> = { all: jobinMeetRecords.length, open: 0, won: 0, lost: 0, abandoned: 0 };
    jobinMeetRecords.forEach((r) => {
      const st = r.ghl_status || "open";
      if (counts[st] !== undefined) counts[st]++;
    });
    return counts;
  }, [jobinMeetRecords]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
        <AnalyticsSkeleton />
      </div>
    );
  }

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "setter", label: "Setter Analysis" },
    { key: "conversions", label: "Conversions" },
    { key: "payments", label: "Payments" },
  ];

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex-shrink-0 border-b border-border">
        <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
        <p className="text-muted text-sm mt-0.5">Meeting and revenue performance overview</p>
      </div>

      {/* Filter Bar */}
      <div className="px-6 py-3 border-b border-border flex-shrink-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted uppercase tracking-wider mr-1">Pipeline:</span>
          {GHL_STATUSES.map((s) => (
            <button key={s.value} onClick={() => setGhlFilter(s.value)}
              className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-colors ${ghlFilter === s.value ? s.bg + " " + s.color : "border-border text-muted hover:border-border/80"}`}>
              {s.label} <span>{ghlCounts[s.value] ?? 0}</span>
            </button>
          ))}
          <span className="mx-2 text-border">|</span>
          <span className="text-[11px] text-muted uppercase tracking-wider mr-1">Setter:</span>
          <select value={setterFilter} onChange={(e) => setSetterFilter(e.target.value)}
            className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-surface text-foreground focus:outline-none focus:border-accent cursor-pointer [&>option]:bg-surface">
            <option value="all">All Statuses</option>
            {SETTER_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {(ghlFilter !== "all" || setterFilter !== "all") && (
            <button onClick={() => { setGhlFilter("all"); setSetterFilter("all"); }}
              className="text-[11px] text-accent hover:underline ml-2">Clear Filters</button>
          )}
        </div>
        {(ghlFilter !== "all" || setterFilter !== "all") && (
          <p className="text-[11px] text-muted">Showing {filteredMeetRecords.length} of {jobinMeetRecords.length} leads</p>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="px-6 border-b border-border flex-shrink-0">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6 space-y-6">
        {activeTab === "overview" && (
          <OverviewTab
            meetingStats={meetingStats} pipelineStats={pipelineStats} revenueStats={revenueStats}
            sourceBreakdown={sourceBreakdown} monthlyTrend={monthlyTrend}
            filteredMeetRecords={filteredMeetRecords} filteredSalesRecords={filteredSalesRecords}
            paymentModeData={paymentModeData}
          />
        )}
        {activeTab === "setter" && (
          <SetterTab setterStats={setterStats} notesFeed={notesFeed} />
        )}
        {activeTab === "conversions" && (
          <ConversionsTab
            convertedLeads={convertedLeads} lostLeads={lostLeads}
            pipelineStats={pipelineStats} revenueStats={revenueStats}
          />
        )}
        {activeTab === "payments" && (
          <PaymentsTab
            paymentModeData={paymentModeData} onboardingData={onboardingData}
            overdueAlerts={overdueAlerts} filteredSalesRecords={filteredSalesRecords}
          />
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   TAB: Overview
   ══════════════════════════════════════════════════════ */

function OverviewTab({ meetingStats, pipelineStats, revenueStats, sourceBreakdown, monthlyTrend, filteredMeetRecords, filteredSalesRecords, paymentModeData }: {
  meetingStats: { totalBooked: number; showed: number; confirmed: number; noShow: number; cancelled: number; showRate: number; noShowRate: number };
  pipelineStats: { total: number; open: number; won: number; lost: number; abandoned: number; rightFit: number; conversionRate: number; lossRate: number; rightFitRate: number };
  revenueStats: { totalQuoted: number; totalCollected: number; totalPending: number; fullyPaid: number; partial: number; overdue: number; collectionRate: number; avgDealSize: number; totalDeals: number };
  sourceBreakdown: { source: string; total: number; won: number; rate: number; avgRating: number }[];
  monthlyTrend: { label: string; booked: number; won: number; revenue: number }[];
  filteredMeetRecords: MeetRecord[];
  filteredSalesRecords: SalesRecord[];
  paymentModeData: { mode: string; count: number; quoted: number; collected: number; collectionRate: number }[];
}) {
  return (
    <>
      <Section title="Meeting Performance" icon={<CalendarCheck className="w-4 h-4" />}>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <MetricCard label="Total Booked" value={meetingStats.totalBooked} icon={<CalendarCheck className="w-4 h-4" />} color="text-blue-400" bg="bg-blue-500/10" />
          <MetricCard label="Confirmed" value={meetingStats.confirmed} icon={<CheckCircle className="w-4 h-4" />} color="text-blue-400" bg="bg-blue-500/10" />
          <MetricCard label="Showed Up" value={meetingStats.showed} icon={<UserCheck className="w-4 h-4" />} color="text-green-400" bg="bg-green-500/10" />
          <MetricCard label="No Show" value={meetingStats.noShow} icon={<UserX className="w-4 h-4" />} color="text-red-400" bg="bg-red-500/10" />
          <MetricCard label="Cancelled" value={meetingStats.cancelled} icon={<XCircle className="w-4 h-4" />} color="text-gray-400" bg="bg-gray-500/10" />
          <MetricCard label="Show Rate" value={`${meetingStats.showRate.toFixed(1)}%`} icon={<ArrowUpRight className="w-4 h-4" />} color="text-green-400" bg="bg-green-500/10" highlight />
          <MetricCard label="No-Show Rate" value={`${meetingStats.noShowRate.toFixed(1)}%`} icon={<ArrowDownRight className="w-4 h-4" />} color="text-red-400" bg="bg-red-500/10" highlight />
        </div>
      </Section>

      <Section title="Pipeline & Conversion" icon={<Target className="w-4 h-4" />}>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <MetricCard label="Total Leads" value={pipelineStats.total} icon={<Target className="w-4 h-4" />} color="text-blue-400" bg="bg-blue-500/10" />
          <MetricCard label="Open" value={pipelineStats.open} icon={<Clock className="w-4 h-4" />} color="text-blue-400" bg="bg-blue-500/10" />
          <MetricCard label="Won" value={pipelineStats.won} icon={<CheckCircle className="w-4 h-4" />} color="text-green-400" bg="bg-green-500/10" />
          <MetricCard label="Lost" value={pipelineStats.lost} icon={<XCircle className="w-4 h-4" />} color="text-red-400" bg="bg-red-500/10" />
          <MetricCard label="Abandoned" value={pipelineStats.abandoned} icon={<UserX className="w-4 h-4" />} color="text-gray-400" bg="bg-gray-500/10" />
          <MetricCard label="Conversion Rate" value={`${pipelineStats.conversionRate.toFixed(1)}%`} icon={<ArrowUpRight className="w-4 h-4" />} color="text-green-400" bg="bg-green-500/10" highlight />
          <MetricCard label="Right Fit Rate" value={`${pipelineStats.rightFitRate.toFixed(1)}%`} icon={<ArrowUpRight className="w-4 h-4" />} color="text-emerald-400" bg="bg-emerald-500/10" highlight />
        </div>

        {pipelineStats.total > 0 && (
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-[11px] text-muted mb-2 uppercase tracking-wider">Pipeline Funnel</p>
              <div className="flex h-6 rounded-lg overflow-hidden border border-border">
                {pipelineStats.open > 0 && <FunnelSegment count={pipelineStats.open} total={pipelineStats.total} label="Open" color="bg-blue-500/30" textColor="text-blue-300" />}
                {pipelineStats.won > 0 && <FunnelSegment count={pipelineStats.won} total={pipelineStats.total} label="Won" color="bg-green-500/30" textColor="text-green-300" />}
                {pipelineStats.lost > 0 && <FunnelSegment count={pipelineStats.lost} total={pipelineStats.total} label="Lost" color="bg-red-500/30" textColor="text-red-300" />}
                {pipelineStats.abandoned > 0 && <FunnelSegment count={pipelineStats.abandoned} total={pipelineStats.total} label="Abn" color="bg-gray-500/30" textColor="text-gray-300" />}
              </div>
            </div>
            <div>
              <p className="text-[11px] text-muted mb-2 uppercase tracking-wider">Setter Status Distribution</p>
              <div className="flex h-6 rounded-lg overflow-hidden border border-border">
                {SETTER_STATUSES.map((s) => {
                  const count = filteredMeetRecords.filter((r) => r.status === s.value).length;
                  if (count === 0) return null;
                  return <FunnelSegment key={s.value} count={count} total={pipelineStats.total} label={s.label.split(" ")[0]} color={s.bg.replace("/10", "/30")} textColor={s.color.replace("400", "300")} />;
                })}
              </div>
            </div>
          </div>
        )}
      </Section>

      <Section title="Revenue" icon={<DollarSign className="w-4 h-4" />}>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <MetricCard label="Total Quoted" value={`₹${revenueStats.totalQuoted.toLocaleString()}`} icon={<TrendingUp className="w-4 h-4" />} color="text-blue-400" bg="bg-blue-500/10" />
          <MetricCard label="Collected" value={`₹${revenueStats.totalCollected.toLocaleString()}`} icon={<DollarSign className="w-4 h-4" />} color="text-green-400" bg="bg-green-500/10" />
          <MetricCard label="Pending" value={`₹${revenueStats.totalPending.toLocaleString()}`} icon={<Clock className="w-4 h-4" />} color="text-amber-400" bg="bg-amber-500/10" />
          <MetricCard label="Collection Rate" value={`${revenueStats.collectionRate.toFixed(1)}%`} icon={<ArrowUpRight className="w-4 h-4" />} color="text-green-400" bg="bg-green-500/10" highlight />
          <MetricCard label="Avg Deal Size" value={`₹${Math.round(revenueStats.avgDealSize).toLocaleString()}`} icon={<BarChart3 className="w-4 h-4" />} color="text-purple-400" bg="bg-purple-500/10" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1"><CheckCircle className="w-3.5 h-3.5 text-green-400" /><span className="text-xs text-muted">Fully Paid</span></div>
            <p className="text-lg font-semibold text-green-400">{revenueStats.fullyPaid}<span className="text-xs text-muted font-normal">/{revenueStats.totalDeals}</span></p>
          </div>
          <div className="border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1"><Clock className="w-3.5 h-3.5 text-blue-400" /><span className="text-xs text-muted">Partial</span></div>
            <p className="text-lg font-semibold text-blue-400">{revenueStats.partial}</p>
          </div>
          <div className="border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1"><XCircle className="w-3.5 h-3.5 text-red-400" /><span className="text-xs text-muted">Overdue</span></div>
            <p className="text-lg font-semibold text-red-400">{revenueStats.overdue}</p>
          </div>
        </div>

        {paymentModeData.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] text-muted mb-2 uppercase tracking-wider">By Payment Mode</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {paymentModeData.map((pm) => (
                <div key={pm.mode} className="border border-border rounded-lg p-2.5">
                  <p className="text-[10px] text-muted">{pm.mode}</p>
                  <p className="text-sm font-semibold text-foreground">{pm.count} <span className="text-[10px] text-muted font-normal">deals</span></p>
                  <p className="text-[10px] text-green-400">₹{pm.collected.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Source Breakdown" icon={<BarChart3 className="w-4 h-4" />}>
          {sourceBreakdown.length === 0 ? (
            <p className="text-xs text-muted py-4">No data yet</p>
          ) : (
            <div className="space-y-2">
              {sourceBreakdown.map((s) => (
                <div key={s.source} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-foreground truncate">{s.source}</div>
                  <div className="flex-1 h-5 bg-surface rounded-full overflow-hidden border border-border relative">
                    <div className="h-full bg-accent/30 rounded-full" style={{ width: `${pipelineStats.total > 0 ? (s.total / pipelineStats.total) * 100 : 0}%` }} />
                    {s.won > 0 && (
                      <div className="h-full bg-green-500/40 rounded-full absolute top-0 left-0" style={{ width: `${pipelineStats.total > 0 ? (s.won / pipelineStats.total) * 100 : 0}%` }} />
                    )}
                  </div>
                  <div className="w-16 text-right">
                    <span className="text-xs text-foreground">{s.total}</span>
                    <span className="text-[10px] text-muted ml-1">({s.won}w)</span>
                  </div>
                  {s.avgRating > 0 && (
                    <div className="w-12 flex items-center gap-0.5">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="text-[10px] text-amber-400">{s.avgRating.toFixed(1)}</span>
                    </div>
                  )}
                  <div className="w-12 text-right">
                    <span className={`text-[11px] font-medium ${s.rate >= 50 ? "text-green-400" : s.rate >= 25 ? "text-amber-400" : "text-red-400"}`}>
                      {s.rate.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Monthly Trend (6 months)" icon={<TrendingUp className="w-4 h-4" />}>
          {monthlyTrend.length === 0 ? (
            <p className="text-xs text-muted py-4">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={monthlyTrend} barGap={4}>
                <XAxis dataKey="label" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="booked" fill="rgba(184, 134, 11, 0.35)" radius={[4, 4, 0, 0]} name="Booked" />
                <Bar dataKey="won" fill="rgba(34, 197, 94, 0.35)" radius={[4, 4, 0, 0]} name="Won" />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      <Section title="Key Ratios" icon={<Target className="w-4 h-4" />}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <RatioCard label="Booked → Show" from={meetingStats.totalBooked} to={meetingStats.showed} rate={meetingStats.showRate} />
          <RatioCard label="Show → Won" from={meetingStats.showed} to={pipelineStats.won} rate={meetingStats.showed > 0 ? (pipelineStats.won / meetingStats.showed) * 100 : 0} />
          <RatioCard label="Booked → Won" from={meetingStats.totalBooked} to={pipelineStats.won} rate={meetingStats.totalBooked > 0 ? (pipelineStats.won / meetingStats.totalBooked) * 100 : 0} />
          <RatioCard label="Right Fit Rate" from={pipelineStats.total} to={pipelineStats.rightFit} rate={pipelineStats.rightFitRate} />
          <RatioCard label="Revenue / Deal" from={revenueStats.totalDeals} to={null} rate={null} customValue={`₹${Math.round(revenueStats.avgDealSize).toLocaleString()}`} />
        </div>
      </Section>
    </>
  );
}

/* ══════════════════════════════════════════════════════
   TAB: Setter Analysis
   ══════════════════════════════════════════════════════ */

function SetterTab({ setterStats, notesFeed }: {
  setterStats: {
    statusData: { value: string; label: string; color: string; bg: string; count: number }[];
    ratingData: { star: string; count: number }[];
    avgRating: number; ratedCount: number; unrated: number;
  };
  notesFeed: MeetRecord[];
}) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Rating Distribution" icon={<Star className="w-4 h-4" />}>
          <div className="flex items-start gap-6">
            <div className="text-center">
              <div className="flex items-center gap-1 mb-1">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <span className="text-3xl font-bold text-foreground">{setterStats.avgRating.toFixed(1)}</span>
              </div>
              <p className="text-[10px] text-muted">{setterStats.ratedCount} rated</p>
              <p className="text-[10px] text-muted">{setterStats.unrated} unrated</p>
            </div>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={setterStats.ratingData} layout="vertical" barSize={14}>
                  <XAxis type="number" tick={{ fill: "#A3A3A3", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="star" tick={{ fill: "#A3A3A3", fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" fill="rgba(184, 134, 11, 0.5)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Section>

        <Section title="Setter Status Distribution" icon={<Target className="w-4 h-4" />}>
          <div className="space-y-2">
            {setterStats.statusData.map((s) => (
              <div key={s.value} className="flex items-center gap-3">
                <div className="w-28">
                  <span className={`text-[11px] font-medium ${s.color}`}>{s.label}</span>
                </div>
                <div className="flex-1 h-4 bg-surface rounded-full overflow-hidden border border-border">
                  <div className={`h-full rounded-full ${s.bg.replace("/10", "/40")}`}
                    style={{ width: `${setterStats.statusData.reduce((a, b) => a + b.count, 0) > 0 ? (s.count / setterStats.statusData.reduce((a, b) => a + b.count, 0)) * 100 : 0}%` }} />
                </div>
                <span className="text-xs text-foreground w-8 text-right">{s.count}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Setter Notes & Comments" icon={<MessageSquare className="w-4 h-4" />}>
        {notesFeed.length === 0 ? (
          <p className="text-xs text-muted py-4">No notes or comments found</p>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-3 pr-1">
            {notesFeed.map((r) => (
              <div key={r.opportunity_id} className="border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">{r.contact_name || "Unknown"}</span>
                    <StatusBadge status={r.status} />
                    <GhlBadge status={r.ghl_status} />
                  </div>
                  <div className="flex items-center gap-1">
                    {r.rating && <ReadOnlyStars rating={r.rating} />}
                  </div>
                </div>
                {r.notes && (
                  <div className="mb-1.5">
                    <span className="text-[10px] text-muted">Setter Notes: </span>
                    <span className="text-xs text-foreground">{r.notes}</span>
                  </div>
                )}
                {r.comments && (
                  <div className="mb-1.5">
                    <span className="text-[10px] text-muted">Setter Comments: </span>
                    <span className="text-xs text-foreground">{r.comments}</span>
                  </div>
                )}
                {r.meet_notes && (
                  <div className="mb-1.5">
                    <span className="text-[10px] text-muted">Meet Notes: </span>
                    <span className="text-xs text-foreground">{r.meet_notes}</span>
                  </div>
                )}
                {r.outcome && (
                  <div>
                    <span className="text-[10px] text-muted">Outcome: </span>
                    <span className="text-xs text-foreground">{r.outcome}</span>
                  </div>
                )}
                <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted">
                  <span>{r.source || "Unknown source"}</span>
                  <span>{new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

/* ══════════════════════════════════════════════════════
   TAB: Conversions
   ══════════════════════════════════════════════════════ */

function ConversionsTab({ convertedLeads, lostLeads, pipelineStats, revenueStats }: {
  convertedLeads: (MeetRecord & { sales: SalesRecord | null })[];
  lostLeads: MeetRecord[];
  pipelineStats: { total: number; rightFit: number; won: number };
  revenueStats: { fullyPaid: number; totalDeals: number };
}) {
  const [showLost, setShowLost] = useState(false);

  return (
    <>
      {/* Conversion Funnel */}
      <Section title="Conversion Funnel" icon={<Target className="w-4 h-4" />}>
        <div className="flex items-center gap-2">
          <FunnelStep label="Total Leads" count={pipelineStats.total} color="text-blue-400" bg="bg-blue-500/10" />
          <ChevronDown className="w-4 h-4 text-muted rotate-[-90deg]" />
          <FunnelStep label="Right Fit" count={pipelineStats.rightFit} color="text-emerald-400" bg="bg-emerald-500/10"
            dropoff={pipelineStats.total > 0 ? ((pipelineStats.total - pipelineStats.rightFit) / pipelineStats.total * 100) : 0} />
          <ChevronDown className="w-4 h-4 text-muted rotate-[-90deg]" />
          <FunnelStep label="Won" count={pipelineStats.won} color="text-green-400" bg="bg-green-500/10"
            dropoff={pipelineStats.rightFit > 0 ? ((pipelineStats.rightFit - pipelineStats.won) / pipelineStats.rightFit * 100) : 0} />
          <ChevronDown className="w-4 h-4 text-muted rotate-[-90deg]" />
          <FunnelStep label="Fully Paid" count={revenueStats.fullyPaid} color="text-accent" bg="bg-accent/10"
            dropoff={pipelineStats.won > 0 ? ((pipelineStats.won - revenueStats.fullyPaid) / pipelineStats.won * 100) : 0} />
        </div>
      </Section>

      {/* Converted Leads Table */}
      <Section title={`Converted Leads (${convertedLeads.length})`} icon={<CheckCircle className="w-4 h-4" />}>
        {convertedLeads.length === 0 ? (
          <p className="text-xs text-muted py-4">No converted leads yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[1200px]">
              <thead>
                <tr className="bg-surface border-b border-border">
                  {["Contact", "Source", "Setter Status", "Rating", "Setter Notes", "Outcome", "Quoted", "Collected", "Collection", "Onboarding"].map((h) => (
                    <th key={h} className="text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2 border-r border-border last:border-r-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {convertedLeads.map((r) => (
                  <tr key={r.opportunity_id} className="border-b border-border/50 hover:bg-surface-hover/50">
                    <td className="px-3 py-2 border-r border-border">
                      <p className="text-xs text-foreground font-medium">{r.contact_name || "-"}</p>
                      {r.contact_email && <p className="text-[10px] text-muted">{r.contact_email}</p>}
                    </td>
                    <td className="px-3 py-2 text-xs text-foreground border-r border-border">{r.source || "-"}</td>
                    <td className="px-3 py-2 border-r border-border"><StatusBadge status={r.status} /></td>
                    <td className="px-3 py-2 border-r border-border">{r.rating ? <ReadOnlyStars rating={r.rating} /> : <span className="text-[10px] text-muted">-</span>}</td>
                    <td className="px-3 py-2 text-xs text-foreground border-r border-border max-w-[160px] truncate" title={r.notes || ""}>{r.notes || "-"}</td>
                    <td className="px-3 py-2 text-xs text-foreground border-r border-border max-w-[120px] truncate" title={r.outcome || ""}>{r.outcome || "-"}</td>
                    <td className="px-3 py-2 text-xs text-foreground border-r border-border">{r.sales ? `₹${r.sales.fees_quoted.toLocaleString()}` : "-"}</td>
                    <td className="px-3 py-2 text-xs text-green-400 border-r border-border">{r.sales ? `₹${r.sales.fees_collected.toLocaleString()}` : "-"}</td>
                    <td className="px-3 py-2 border-r border-border">{r.sales ? <CollectionBadge status={r.sales.collection_status} /> : <span className="text-[10px] text-muted">-</span>}</td>
                    <td className="px-3 py-2">{r.sales ? <OnboardingBadge status={r.sales.onboarding_status} /> : <span className="text-[10px] text-muted">-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Lost/Abandoned Summary */}
      {lostLeads.length > 0 && (
        <Section title={`Lost / Abandoned (${lostLeads.length})`} icon={<XCircle className="w-4 h-4" />}>
          <button onClick={() => setShowLost(!showLost)} className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors mb-3">
            {showLost ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showLost ? "Hide details" : "Show details"}
          </button>
          {showLost && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-surface border-b border-border">
                    {["Contact", "Source", "Status", "Setter Status", "Rating", "Notes / Comments"].map((h) => (
                      <th key={h} className="text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2 border-r border-border last:border-r-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lostLeads.map((r) => (
                    <tr key={r.opportunity_id} className="border-b border-border/50 hover:bg-surface-hover/50">
                      <td className="px-3 py-2 text-xs text-foreground font-medium border-r border-border">{r.contact_name || "-"}</td>
                      <td className="px-3 py-2 text-xs text-foreground border-r border-border">{r.source || "-"}</td>
                      <td className="px-3 py-2 border-r border-border"><GhlBadge status={r.ghl_status} /></td>
                      <td className="px-3 py-2 border-r border-border"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-2 border-r border-border">{r.rating ? <ReadOnlyStars rating={r.rating} /> : <span className="text-[10px] text-muted">-</span>}</td>
                      <td className="px-3 py-2 text-xs text-foreground">{r.notes || r.comments || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════
   TAB: Payments
   ══════════════════════════════════════════════════════ */

function PaymentsTab({ paymentModeData, onboardingData, overdueAlerts, filteredSalesRecords }: {
  paymentModeData: { mode: string; count: number; quoted: number; collected: number; collectionRate: number }[];
  onboardingData: { counts: Record<string, number>; completionRate: number; total: number };
  overdueAlerts: SalesRecord[];
  filteredSalesRecords: SalesRecord[];
}) {
  const pieData = paymentModeData.map((pm) => ({ name: pm.mode, value: pm.collected })).filter((d) => d.value > 0);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Payment Mode Breakdown" icon={<CreditCard className="w-4 h-4" />}>
          {pieData.length === 0 ? (
            <p className="text-xs text-muted py-4">No payment data yet</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `₹${Number(v).toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 flex-1">
                {paymentModeData.map((pm, i) => (
                  <div key={pm.mode} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-foreground flex-1">{pm.mode}</span>
                    <span className="text-muted">{pm.count}</span>
                    <span className="text-green-400 w-20 text-right">₹{pm.collected.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {paymentModeData.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {["Mode", "Count", "Quoted", "Collected", "Rate"].map((h) => (
                      <th key={h} className="text-left text-[10px] font-semibold text-muted uppercase px-2 py-1.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paymentModeData.map((pm) => (
                    <tr key={pm.mode} className="border-b border-border/50">
                      <td className="px-2 py-1.5 text-foreground">{pm.mode}</td>
                      <td className="px-2 py-1.5 text-muted">{pm.count}</td>
                      <td className="px-2 py-1.5 text-foreground">₹{pm.quoted.toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-green-400">₹{pm.collected.toLocaleString()}</td>
                      <td className="px-2 py-1.5">
                        <span className={pm.collectionRate >= 80 ? "text-green-400" : pm.collectionRate >= 50 ? "text-amber-400" : "text-red-400"}>
                          {pm.collectionRate.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Onboarding Status" icon={<UserCheck className="w-4 h-4" />}>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {ONBOARDING_STATUSES.map((s) => (
              <div key={s.value} className={`rounded-lg border border-border p-3 ${s.bg}`}>
                <p className="text-[10px] text-muted uppercase tracking-wider">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{onboardingData.counts[s.value] || 0}</p>
              </div>
            ))}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-muted">Completion Rate</span>
              <span className="text-xs font-medium text-foreground">{onboardingData.completionRate.toFixed(0)}%</span>
            </div>
            <div className="h-3 bg-surface rounded-full overflow-hidden border border-border">
              <div className="h-full bg-green-500/40 rounded-full transition-all" style={{ width: `${onboardingData.completionRate}%` }} />
            </div>
            <p className="text-[10px] text-muted mt-1">{onboardingData.counts["completed"] || 0} of {onboardingData.total} deals fully onboarded</p>
          </div>
        </Section>
      </div>

      {overdueAlerts.length > 0 && (
        <Section title={`Pending & Overdue Alerts (${overdueAlerts.length})`} icon={<AlertCircle className="w-4 h-4" />}>
          <div className="space-y-2">
            {overdueAlerts.map((r) => {
              const daysSinceClosed = r.closed_date ? Math.floor((Date.now() - new Date(r.closed_date).getTime()) / (1000 * 60 * 60 * 24)) : null;
              return (
                <div key={r.opportunity_id} className="flex items-center gap-3 border border-border rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{r.contact_name || "Unknown"}</p>
                    <p className="text-[10px] text-muted">{r.source || "Unknown source"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-amber-400">₹{r.pending_amount.toLocaleString()}</p>
                    <p className="text-[10px] text-muted">pending</p>
                  </div>
                  <CollectionBadge status={r.collection_status} />
                  {daysSinceClosed !== null && (
                    <span className="text-[10px] text-muted">{daysSinceClosed}d ago</span>
                  )}
                  <div className="flex items-center gap-1">
                    {r.contact_phone && <a href={`tel:${r.contact_phone}`} className="p-1 rounded hover:bg-green-500/10 text-muted hover:text-green-400"><Phone className="w-3 h-3" /></a>}
                    {r.contact_email && <a href={`mailto:${r.contact_email}`} className="p-1 rounded hover:bg-blue-500/10 text-muted hover:text-blue-400"><Mail className="w-3 h-3" /></a>}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════
   Shared Components
   ══════════════════════════════════════════════════════ */

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-accent">{icon}</span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function MetricCard({ label, value, icon, color, bg, highlight }: {
  label: string; value: string | number; icon: React.ReactNode; color: string; bg: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border border-border p-3 ${bg}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-[10px] text-muted uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-lg font-bold ${highlight ? color : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function RatioCard({ label, from, to, rate, customValue }: {
  label: string; from: number; to: number | null; rate: number | null; customValue?: string;
}) {
  const rateColor = rate !== null
    ? rate >= 60 ? "text-green-400" : rate >= 30 ? "text-amber-400" : "text-red-400"
    : "text-accent";

  return (
    <div className="border border-border rounded-lg p-3">
      <p className="text-[10px] text-muted uppercase tracking-wider mb-2">{label}</p>
      {customValue ? (
        <p className="text-lg font-bold text-accent">{customValue}</p>
      ) : (
        <>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-foreground">{from}</span>
            <span className="text-muted text-xs">→</span>
            <span className={`text-lg font-bold ${rateColor}`}>{to}</span>
          </div>
          <p className={`text-xs font-medium mt-0.5 ${rateColor}`}>
            {rate !== null ? `${rate.toFixed(1)}%` : "-"}
          </p>
        </>
      )}
    </div>
  );
}

function FunnelSegment({ count, total, label, color, textColor }: {
  count: number; total: number; label: string; color: string; textColor: string;
}) {
  return (
    <div className={`${color} flex items-center justify-center`} style={{ width: `${(count / total) * 100}%` }}>
      <span className={`text-[9px] ${textColor} font-medium`}>{label} {count}</span>
    </div>
  );
}

function FunnelStep({ label, count, color, bg, dropoff }: {
  label: string; count: number; color: string; bg: string; dropoff?: number;
}) {
  return (
    <div className={`flex-1 rounded-lg border border-border p-3 ${bg} text-center`}>
      <p className="text-[10px] text-muted uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{count}</p>
      {dropoff !== undefined && dropoff > 0 && (
        <p className="text-[10px] text-red-400 mt-0.5">-{dropoff.toFixed(0)}% drop</p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = SETTER_STATUSES.find((s) => s.value === status);
  if (!cfg) return <span className="text-[10px] text-muted">{status}</span>;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border border-current/20 font-medium`}>
      {cfg.label}
    </span>
  );
}

function GhlBadge({ status }: { status: string | null }) {
  const s = status || "open";
  const colors: Record<string, string> = {
    open: "text-blue-400 bg-blue-500/10",
    won: "text-green-400 bg-green-500/10",
    lost: "text-red-400 bg-red-500/10",
    abandoned: "text-gray-400 bg-gray-500/10",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colors[s] || colors.open}`}>
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

function CollectionBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "text-amber-400 bg-amber-500/10",
    partial: "text-blue-400 bg-blue-500/10",
    fully_paid: "text-green-400 bg-green-500/10",
    overdue: "text-red-400 bg-red-500/10",
    refunded: "text-gray-400 bg-gray-500/10",
  };
  const labels: Record<string, string> = {
    pending: "Pending", partial: "Partial", fully_paid: "Fully Paid", overdue: "Overdue", refunded: "Refunded",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colors[status] || colors.pending}`}>
      {labels[status] || status}
    </span>
  );
}

function OnboardingBadge({ status }: { status: string }) {
  const cfg = ONBOARDING_STATUSES.find((s) => s.value === status);
  if (!cfg) return <span className="text-[10px] text-muted">{status}</span>;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function ReadOnlyStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`w-3 h-3 ${s <= rating ? "text-amber-400 fill-amber-400" : "text-border"}`} />
      ))}
    </div>
  );
}
