"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Phone,
  CalendarCheck,
  IndianRupee,
  UserPlus,
  Clock,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Users,
  Target,
  ChevronDown,
  ChevronUp,
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
  Legend,
} from "recharts";
import { SalesDashboardSkeleton } from "@/components/Skeleton";

/* ── Types ─────────────────────────────────────────────── */

interface Pipeline {
  id: string;
  name: string;
  stages: { id: string; name: string }[];
}

interface Opportunity {
  id: string;
  name: string;
  status: string;
  monetaryValue: number;
  pipelineStageId: string;
  pipelineId: string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
  lastStatusChangeAt?: string;
  lastStageChangeAt?: string;
}

interface OptinRecord {
  opportunity_id: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  pipeline_name?: string;
  stage_name?: string;
  source?: string;
  monetary_value?: number;
  status?: string;
  notes?: string;
  last_contacted_at?: string;
  assigned_to?: string;
  created_at?: string;
  updated_at?: string;
}

interface CallBookedRecord {
  opportunity_id: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  pipeline_name?: string;
  stage_name?: string;
  source?: string;
  status?: string;
  rating?: number;
  comments?: string;
  notes?: string;
  assigned_to?: string;
  ghl_status?: string;
  created_at?: string;
  updated_at?: string;
}

interface PaymentRecord {
  opportunity_id: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  pipeline_name?: string;
  stage_name?: string;
  source?: string;
  status?: string;
  notes?: string;
  last_contacted_at?: string;
  call_scheduled_at?: string;
  assigned_to?: string;
  created_at?: string;
  updated_at?: string;
}

interface CalendarItem {
  id: string;
  name: string;
  teamMembers?: { userId: string }[];
}

interface CalendarEvent {
  id: string;
  title?: string;
  calendarId: string;
  startTime: string;
  endTime: string;
  status: string;
  appointmentStatus?: string;
  assignedUserId?: string;
  contactId?: string;
}

/* ── Constants ─────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  open: "#3b82f6",
  won: "#22c55e",
  lost: "#ef4444",
  abandoned: "#6b7280",
};

const STAGE_COLORS = [
  "#3b82f6", "#06b6d4", "#8b5cf6", "#ec4899",
  "#f59e0b", "#22c55e", "#ef4444", "#6366f1",
];

const TOOLTIP_STYLE = {
  background: "#1a1a1a",
  border: "1px solid #262626",
  borderRadius: "8px",
  color: "#ededed",
};

/* ── Helper: is today ─────────────────────────────────── */

function isToday(dateStr?: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isThisWeek(dateStr?: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return d >= startOfWeek && d < endOfWeek;
}

function isThisMonth(dateStr?: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/* ── Metric Card ──────────────────────────────────────── */

function MetricCard({
  label,
  value,
  subValue,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted truncate">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {subValue && <p className="text-[11px] text-muted">{subValue}</p>}
      </div>
    </div>
  );
}

/* ── Widget Card wrapper ───────────────────────────────── */

function WidgetCard({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

/* ── Collapsible Recent List ──────────────────────────── */

function RecentList({
  title,
  icon: Icon,
  iconColor,
  items,
  emptyText,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  items: { name: string; detail: string; time?: string; badge?: string; badgeColor?: string }[];
  emptyText: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, 5);

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <span className="ml-auto text-xs text-muted">{items.length} total</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted py-4 text-center">{emptyText}</p>
      ) : (
        <>
          <div className="space-y-2">
            {shown.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">{item.name}</p>
                  <p className="text-xs text-muted truncate">{item.detail}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  {item.badge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${item.badgeColor || "bg-zinc-700 text-zinc-300"}`}>
                      {item.badge}
                    </span>
                  )}
                  {item.time && <span className="text-[11px] text-muted">{item.time}</span>}
                </div>
              </div>
            ))}
          </div>
          {items.length > 5 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-accent mt-2 hover:underline"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "Show less" : `Show all ${items.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* ── Main Dashboard ────────────────────────────────────── */

export default function GHLDashboard() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<string>("");
  const [optinRecords, setOptinRecords] = useState<OptinRecord[]>([]);
  const [callBookedRecords, setCallBookedRecords] = useState<CallBookedRecord[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [allOpportunities, setAllOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeFilter, setTimeFilter] = useState<"today" | "week" | "month">("today");

  /* ── Fetch all data ───────────────────────────────── */

  useEffect(() => {
    async function init() {
      try {
        const [pipelinesRes, optinRes, callRes, paymentRes, calRes] = await Promise.all([
          fetch("/api/ghl/pipelines"),
          fetch("/api/sales/optin-tracking"),
          fetch("/api/sales/call-booked-tracking"),
          fetch("/api/sales/payment-done-tracking"),
          fetch("/api/ghl/calendars"),
        ]);

        const [pData, oData, cData, pDoneData, calData] = await Promise.all([
          pipelinesRes.json(),
          optinRes.json(),
          callRes.json(),
          paymentRes.json(),
          calRes.json(),
        ]);

        if (pData.error) throw new Error(pData.error);
        const pipelineList: Pipeline[] = pData.pipelines || [];
        setPipelines(pipelineList);
        if (pipelineList.length > 0) setSelectedPipeline(pipelineList[0].id);

        setOptinRecords(oData.records || []);
        setCallBookedRecords(cData.records || []);
        setPaymentRecords(pDoneData.records || []);

        // Fetch opportunities from ALL pipelines for date lookup
        const oppResults = await Promise.all(
          pipelineList.map((p) =>
            fetch(`/api/ghl/opportunities?pipeline_id=${p.id}`).then((r) => r.json())
          )
        );
        const allOpps: Opportunity[] = [];
        oppResults.forEach((data) => {
          if (data.opportunities) allOpps.push(...data.opportunities);
        });
        setAllOpportunities(allOpps);

        // Fetch calendar events for today + upcoming week
        if (calData.calendars) {
          const cals = calData.calendars as CalendarItem[];
          const now = new Date();
          const start = new Date(now);
          start.setDate(start.getDate() - 1);
          const end = new Date(now);
          end.setDate(end.getDate() + 7);
          const allEvents: CalendarEvent[] = [];
          const results = await Promise.all(
            cals.map((cal) =>
              fetch(`/api/ghl/calendar-events?calendarId=${cal.id}&startTime=${start.toISOString()}&endTime=${end.toISOString()}`).then((r) => r.json())
            )
          );
          results.forEach((data) => { if (data.events) allEvents.push(...data.events); });
          setCalendarEvents(allEvents);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  /* Fetch opportunities for selected pipeline (for pipeline-specific charts) */
  useEffect(() => {
    if (!selectedPipeline) return;
    const pipelineOpps = allOpportunities.filter((o) => o.pipelineId === selectedPipeline);
    setOpportunities(pipelineOpps);
  }, [selectedPipeline, allOpportunities]);

  /* ── GHL date lookup: opportunity_id → lastStageChangeAt ── */
  // lastStageChangeAt = when the lead entered its current stage (Opt-in, Call Booked, Payment Done)
  // This is the real "when did this action happen" date, not when the opportunity was first created

  const oppDateMap = useMemo(() => {
    const map: Record<string, { stageDate: string; createdAt: string }> = {};
    allOpportunities.forEach((o) => {
      map[o.id] = {
        stageDate: o.lastStageChangeAt || o.updatedAt || o.createdAt || "",
        createdAt: o.createdAt || "",
      };
    });
    return map;
  }, [allOpportunities]);

  /* ── Time-filtered data ─────────────────────────── */

  const timeCheck = timeFilter === "today" ? isToday : timeFilter === "week" ? isThisWeek : isThisMonth;

  // Use the GHL lastStageChangeAt as the action date for each tracking record
  function matchesTime(record: { opportunity_id: string }) {
    const dates = oppDateMap[record.opportunity_id];
    if (!dates) return false;
    return timeCheck(dates.stageDate);
  }

  const filteredOptins = useMemo(() => optinRecords.filter(matchesTime), [optinRecords, timeFilter, oppDateMap]);
  const filteredCallBooked = useMemo(() => callBookedRecords.filter(matchesTime), [callBookedRecords, timeFilter, oppDateMap]);
  const filteredPayments = useMemo(() => paymentRecords.filter(matchesTime), [paymentRecords, timeFilter, oppDateMap]);

  const meetingsToday = useMemo(() => calendarEvents.filter((ev) => isToday(ev.startTime)), [calendarEvents]);
  const meetingsCompleted = useMemo(() => meetingsToday.filter((ev) => ev.appointmentStatus === "confirmed" || ev.status === "confirmed"), [meetingsToday]);
  const meetingsUpcoming = useMemo(
    () => calendarEvents.filter((ev) => new Date(ev.startTime) > new Date()).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [calendarEvents]
  );

  /* ── Opportunity computed data ──────────────────── */

  const statusCounts = opportunities.reduce(
    (acc, opp) => {
      const s = opp.status || "open";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const statusData = Object.entries(statusCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: STATUS_COLORS[name] || "#6b7280",
  }));

  const totalValue = opportunities.reduce((sum, o) => sum + (o.monetaryValue || 0), 0);
  const wonOpps = opportunities.filter((o) => o.status === "won");
  const openOpps = opportunities.filter((o) => o.status === "open");
  const lostOpps = opportunities.filter((o) => o.status === "lost");
  const wonValue = wonOpps.reduce((sum, o) => sum + (o.monetaryValue || 0), 0);
  const openValue = openOpps.reduce((sum, o) => sum + (o.monetaryValue || 0), 0);
  const conversionRate = opportunities.length > 0 ? Math.round((wonOpps.length / opportunities.length) * 100) : 0;

  const currentPipeline = pipelines.find((p) => p.id === selectedPipeline);
  const stageData = (currentPipeline?.stages || []).map((stage) => {
    const stageOpps = opportunities.filter((o) => o.pipelineStageId === stage.id);
    const stageValue = stageOpps.reduce((sum, o) => sum + (o.monetaryValue || 0), 0);
    return { name: stage.name, count: stageOpps.length, value: stageValue };
  });

  /* Lead source data */
  const leadSourceMap: Record<string, { total: number; value: number; open: number; won: number; lost: number; abandoned: number }> = {};
  opportunities.forEach((opp) => {
    const source = opp.source || "Direct";
    if (!leadSourceMap[source]) leadSourceMap[source] = { total: 0, value: 0, open: 0, won: 0, lost: 0, abandoned: 0 };
    const existing = leadSourceMap[source];
    existing.total++;
    existing.value += opp.monetaryValue || 0;
    if (opp.status === "open") existing.open++;
    if (opp.status === "won") existing.won++;
    if (opp.status === "lost") existing.lost++;
    if (opp.status === "abandoned") existing.abandoned++;
  });
  const leadSourceData = Object.entries(leadSourceMap).map(([source, d]) => ({
    source,
    ...d,
    winRate: d.total > 0 ? Math.round((d.won / d.total) * 100) : 0,
  }));

  /* Sales efficiency */
  let avgSalesDuration = "0d";
  if (wonOpps.length > 0) {
    const totalDays = wonOpps.reduce((sum, o) => {
      if (o.createdAt && o.lastStatusChangeAt) {
        const diff = new Date(o.lastStatusChangeAt).getTime() - new Date(o.createdAt).getTime();
        return sum + diff / (1000 * 60 * 60 * 24);
      }
      return sum;
    }, 0);
    const avg = totalDays / wonOpps.length;
    if (avg >= 1) avgSalesDuration = `${Math.round(avg)}d`;
    else if (avg * 24 >= 1) avgSalesDuration = `${Math.round(avg * 24)}h`;
    else avgSalesDuration = `${Math.round(avg * 24 * 60)}m`;
  }

  /* Optin status breakdown */
  const optinStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    optinRecords.forEach((r) => {
      const s = r.status || "new";
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [optinRecords]);

  /* Call booked status breakdown */
  const callBookedStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    callBookedRecords.forEach((r) => {
      const s = r.ghl_status || "open";
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [callBookedRecords]);

  /* Payment status breakdown */
  const paymentStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    paymentRecords.forEach((r) => {
      const s = r.status || "pending";
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [paymentRecords]);

  /* Recent items for lists */
  const recentOptins = useMemo(
    () =>
      [...optinRecords]
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 20)
        .map((r) => ({
          name: r.contact_name || "Unknown",
          detail: `${r.source || "Direct"} · ${r.pipeline_name || ""}`,
          time: r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "",
          badge: r.status || "new",
          badgeColor: r.status === "contacted" ? "bg-blue-500/20 text-blue-400" : r.status === "qualified" ? "bg-green-500/20 text-green-400" : "bg-zinc-700 text-zinc-300",
        })),
    [optinRecords]
  );

  const recentMeetings = useMemo(
    () =>
      [...callBookedRecords]
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 20)
        .map((r) => ({
          name: r.contact_name || "Unknown",
          detail: `${r.source || "Direct"} · ${r.assigned_to || "Unassigned"}`,
          time: r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "",
          badge: r.ghl_status || "open",
          badgeColor:
            r.ghl_status === "won" ? "bg-green-500/20 text-green-400" :
            r.ghl_status === "lost" ? "bg-red-500/20 text-red-400" :
            r.ghl_status === "abandoned" ? "bg-zinc-600 text-zinc-300" :
            "bg-blue-500/20 text-blue-400",
        })),
    [callBookedRecords]
  );

  const upcomingMeetingsList = useMemo(
    () =>
      meetingsUpcoming.slice(0, 10).map((ev) => {
        const d = new Date(ev.startTime);
        return {
          name: ev.title || "Meeting",
          detail: `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} at ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
          badge: ev.appointmentStatus || ev.status,
          badgeColor: ev.appointmentStatus === "confirmed" ? "bg-green-500/20 text-green-400" : "bg-amber-500/20 text-amber-400",
        };
      }),
    [meetingsUpcoming]
  );

  /* ── Render ────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <SalesDashboardSkeleton />
      </div>
    );
  }

  const timeLabel = timeFilter === "today" ? "Today" : timeFilter === "week" ? "This Week" : "This Month";

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-muted text-sm mt-1">Actionable sales overview</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Time filter */}
          <div className="flex bg-surface border border-border rounded-lg overflow-hidden">
            {(["today", "week", "month"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeFilter(t)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  timeFilter === t ? "bg-accent text-white" : "text-muted hover:text-foreground"
                }`}
              >
                {t === "today" ? "Today" : t === "week" ? "Week" : "Month"}
              </button>
            ))}
          </div>

          {pipelines.length > 0 && (
            <select
              value={selectedPipeline}
              onChange={(e) => setSelectedPipeline(e.target.value)}
              className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">{error}</div>
      )}

      {/* ── Row 1: Today's Key Metrics ─────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label={`Opt-ins ${timeLabel}`}
          value={filteredOptins.length}
          subValue={`${optinRecords.length} total`}
          icon={UserPlus}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-400"
        />
        <MetricCard
          label={`Meetings Booked ${timeLabel}`}
          value={filteredCallBooked.length}
          subValue={`${callBookedRecords.length} total`}
          icon={CalendarCheck}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-400"
        />
        <MetricCard
          label="Meetings Today"
          value={meetingsToday.length}
          subValue={`${meetingsCompleted.length} confirmed`}
          icon={Phone}
          iconBg="bg-purple-500/10"
          iconColor="text-purple-400"
        />
        <MetricCard
          label={`Payments ${timeLabel}`}
          value={filteredPayments.length}
          subValue={`${paymentRecords.length} total`}
          icon={IndianRupee}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-400"
        />
      </div>

      {/* ── Row 2: Pipeline Snapshot ───────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-surface border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-muted">Total Pipeline</p>
          <p className="text-xl font-bold text-foreground mt-1">{opportunities.length}</p>
          <p className="text-[11px] text-muted">₹{totalValue.toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-blue-400">Open</p>
          <p className="text-xl font-bold text-foreground mt-1">{openOpps.length}</p>
          <p className="text-[11px] text-muted">₹{openValue.toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-green-400">Won</p>
          <p className="text-xl font-bold text-foreground mt-1">{wonOpps.length}</p>
          <p className="text-[11px] text-muted">₹{wonValue.toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-red-400">Lost</p>
          <p className="text-xl font-bold text-foreground mt-1">{lostOpps.length}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-accent">Win Rate</p>
          <p className="text-xl font-bold text-foreground mt-1">{conversionRate}%</p>
          <p className="text-[11px] text-muted">Avg cycle: {avgSalesDuration}</p>
        </div>
      </div>

      {/* ── Row 3: Status Breakdowns ──────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Optin Status */}
        <WidgetCard title="Opt-in Status Breakdown">
          {Object.keys(optinStatusCounts).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(optinStatusCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => {
                  const pct = optinRecords.length > 0 ? Math.round((count / optinRecords.length) * 100) : 0;
                  return (
                    <div key={status}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-foreground capitalize">{status.replace(/_/g, " ")}</span>
                        <span className="text-muted">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-sm text-muted text-center py-4">No opt-in data</p>
          )}
        </WidgetCard>

        {/* Call Booked Status */}
        <WidgetCard title="Meetings Booked Status">
          {Object.keys(callBookedStatusCounts).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(callBookedStatusCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => {
                  const pct = callBookedRecords.length > 0 ? Math.round((count / callBookedRecords.length) * 100) : 0;
                  const barColor =
                    status === "won" ? "bg-green-500" :
                    status === "lost" ? "bg-red-500" :
                    status === "abandoned" ? "bg-zinc-500" :
                    "bg-blue-500";
                  return (
                    <div key={status}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-foreground capitalize">{status}</span>
                        <span className="text-muted">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-sm text-muted text-center py-4">No meetings data</p>
          )}
        </WidgetCard>

        {/* Payment Status */}
        <WidgetCard title="Payment Status">
          {Object.keys(paymentStatusCounts).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(paymentStatusCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => {
                  const pct = paymentRecords.length > 0 ? Math.round((count / paymentRecords.length) * 100) : 0;
                  const barColor =
                    status === "completed" || status === "paid" ? "bg-green-500" :
                    status === "pending" ? "bg-amber-500" :
                    status === "overdue" ? "bg-red-500" :
                    "bg-blue-500";
                  return (
                    <div key={status}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-foreground capitalize">{status.replace(/_/g, " ")}</span>
                        <span className="text-muted">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-sm text-muted text-center py-4">No payment data</p>
          )}
        </WidgetCard>
      </div>

      {/* ── Row 4: Funnel Visualization ──────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Conversion Funnel */}
        <WidgetCard title="Sales Funnel" right={<span className="text-xs text-muted">All time</span>}>
          <div className="space-y-2">
            {[
              { label: "Opt-ins", count: optinRecords.length, color: "bg-emerald-500" },
              { label: "Meetings Booked", count: callBookedRecords.length, color: "bg-blue-500" },
              { label: "Won Deals", count: wonOpps.length, color: "bg-green-500" },
              { label: "Payments Done", count: paymentRecords.length, color: "bg-amber-500" },
            ].map((step, i, arr) => {
              const maxCount = Math.max(...arr.map((s) => s.count), 1);
              const widthPct = Math.max((step.count / maxCount) * 100, 8);
              const dropOff = i > 0 && arr[i - 1].count > 0
                ? Math.round(((arr[i - 1].count - step.count) / arr[i - 1].count) * 100)
                : null;
              return (
                <div key={step.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-foreground">{step.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{step.count}</span>
                      {dropOff !== null && dropOff > 0 && (
                        <span className="text-red-400 text-[10px]">-{dropOff}%</span>
                      )}
                    </div>
                  </div>
                  <div className="h-7 bg-zinc-800 rounded-lg overflow-hidden">
                    <div
                      className={`h-full ${step.color} rounded-lg flex items-center justify-end pr-2 transition-all`}
                      style={{ width: `${widthPct}%` }}
                    >
                      {widthPct > 20 && (
                        <span className="text-[10px] text-white font-medium">{step.count}</span>
                      )}
                    </div>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="flex justify-center py-0.5">
                      <ArrowRight className="w-3 h-3 text-muted rotate-90" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </WidgetCard>

        {/* Stage Distribution */}
        <WidgetCard
          title="Pipeline Stages"
          right={<span className="text-xs text-muted">{currentPipeline?.name}</span>}
        >
          {stageData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stageData} layout="vertical">
                <XAxis
                  type="number"
                  tick={{ fill: "#737373", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "#737373", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={120}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {stageData.map((_, i) => (
                    <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted text-sm">
              No pipeline stages
            </div>
          )}
        </WidgetCard>
      </div>

      {/* ── Row 5: Lead Source Report ──────────────── */}
      <WidgetCard title="Lead Source Report">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-xs text-muted font-medium">Source</th>
                <th className="text-right py-2 px-3 text-xs text-muted font-medium">Total</th>
                <th className="text-right py-2 px-3 text-xs text-muted font-medium">Value</th>
                <th className="text-right py-2 px-3 text-xs text-muted font-medium">Open</th>
                <th className="text-right py-2 px-3 text-xs text-muted font-medium">Won</th>
                <th className="text-right py-2 px-3 text-xs text-muted font-medium">Lost</th>
                <th className="text-right py-2 px-3 text-xs text-muted font-medium">Win %</th>
              </tr>
            </thead>
            <tbody>
              {leadSourceData.length > 0 ? (
                leadSourceData
                  .sort((a, b) => b.total - a.total)
                  .map((row) => (
                    <tr key={row.source} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                      <td className="py-2.5 px-3 text-foreground">{row.source}</td>
                      <td className="py-2.5 px-3 text-right text-foreground">{row.total}</td>
                      <td className="py-2.5 px-3 text-right text-foreground">₹{row.value.toLocaleString("en-IN")}</td>
                      <td className="py-2.5 px-3 text-right text-blue-400">{row.open}</td>
                      <td className="py-2.5 px-3 text-right text-green-400">{row.won}</td>
                      <td className="py-2.5 px-3 text-right text-red-400">{row.lost}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={row.winRate >= 50 ? "text-green-400" : row.winRate >= 25 ? "text-amber-400" : "text-red-400"}>
                          {row.winRate}%
                        </span>
                      </td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted text-sm">No lead source data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </WidgetCard>

      {/* ── Row 6: Recent Activity Lists ─────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RecentList
          title="Recent Opt-ins"
          icon={UserPlus}
          iconColor="text-emerald-400"
          items={recentOptins}
          emptyText="No opt-ins yet"
        />
        <RecentList
          title="Recent Meetings Booked"
          icon={CalendarCheck}
          iconColor="text-blue-400"
          items={recentMeetings}
          emptyText="No meetings booked yet"
        />
        <RecentList
          title="Upcoming Meetings"
          icon={Clock}
          iconColor="text-purple-400"
          items={upcomingMeetingsList}
          emptyText="No upcoming meetings"
        />
      </div>
    </div>
  );
}
