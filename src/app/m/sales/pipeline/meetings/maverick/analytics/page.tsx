"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Loader2,
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
} from "lucide-react";

/* ── Types ─────────────────────────────────────────── */

interface GHLUser {
  id: string;
  name: string;
  email: string;
}

interface CalendarEvent {
  id: string;
  startTime: string;
  endTime: string;
  appointmentStatus?: string;
  assignedUserId?: string;
  contactId?: string;
}

interface CalendarItem {
  id: string;
  name: string;
  teamMembers?: { userId: string }[];
}

interface MeetRecord {
  opportunity_id: string;
  ghl_status: string | null;
  assigned_to: string | null;
  source: string;
  stage_name: string;
  created_at: string;
}

interface SalesRecord {
  opportunity_id: string;
  fees_quoted: number;
  fees_collected: number;
  pending_amount: number;
  collection_status: string;
  assigned_to: string | null;
  ghl_status: string | null;
}

/* ── Main Component ────────────────────────────────── */

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [maverickUserId, setMaverickUserId] = useState<string | null>(null);
  const [meetRecords, setMeetRecords] = useState<MeetRecord[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    async function init() {
      try {
        const [usersRes, meetRes, salesRes, calRes] = await Promise.all([
          fetch("/api/ghl/users"),
          fetch("/api/sales/maverick-meet-tracking"),
          fetch("/api/sales/maverick-sales-tracking"),
          fetch("/api/ghl/calendars"),
        ]);
        const usersData = await usersRes.json();
        const meetData = await meetRes.json();
        const salesData = await salesRes.json();
        const calData = await calRes.json();

        const usrs = usersData.users || [];
        const maverick = usrs.find((u: GHLUser) =>
          u.name.toLowerCase().includes("maverick")
        );
        const mavId = maverick?.id || null;
        setMaverickUserId(mavId);

        if (!meetData.error) setMeetRecords(meetData.records || []);
        if (!salesData.error) setSalesRecords(salesData.records || []);

        // Fetch calendar events for Maverick
        if (maverick && calData.calendars) {
          const cals = calData.calendars as CalendarItem[];
          const mavCals = cals.filter((c) =>
            c.teamMembers?.some((tm) => tm.userId === maverick.id)
          );
          if (mavCals.length > 0) {
            const now = new Date();
            const start = new Date(now);
            start.setMonth(start.getMonth() - 6);
            const end = new Date(now);
            end.setMonth(end.getMonth() + 1);

            const allEvents: CalendarEvent[] = [];
            const results = await Promise.all(
              mavCals.map((cal) =>
                fetch(
                  `/api/ghl/calendar-events?calendarId=${cal.id}&startTime=${start.toISOString()}&endTime=${end.toISOString()}`
                ).then((r) => r.json())
              )
            );
            results.forEach((data) => {
              if (data.events) allEvents.push(...data.events);
            });
            setCalendarEvents(
              allEvents.filter((ev) => ev.assignedUserId === maverick.id)
            );
          }
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Filter to Maverick only
  const mavMeetRecords = useMemo(() => {
    if (!maverickUserId) return meetRecords;
    return meetRecords.filter((r) => r.assigned_to === maverickUserId);
  }, [meetRecords, maverickUserId]);

  const mavSalesRecords = useMemo(() => {
    if (!maverickUserId) return salesRecords;
    return salesRecords.filter((r) => r.assigned_to === maverickUserId);
  }, [salesRecords, maverickUserId]);

  // ── Meeting Analytics ──
  const meetingStats = useMemo(() => {
    const totalBooked = calendarEvents.length;
    const showed = calendarEvents.filter(
      (e) => e.appointmentStatus === "showed"
    ).length;
    const confirmed = calendarEvents.filter(
      (e) => e.appointmentStatus === "confirmed"
    ).length;
    const noShow = calendarEvents.filter(
      (e) =>
        e.appointmentStatus === "noshow" || e.appointmentStatus === "no_show"
    ).length;
    const cancelled = calendarEvents.filter(
      (e) => e.appointmentStatus === "cancelled"
    ).length;
    const showRate = totalBooked > 0 ? ((showed / totalBooked) * 100) : 0;
    const noShowRate = totalBooked > 0 ? ((noShow / totalBooked) * 100) : 0;

    return { totalBooked, showed, confirmed, noShow, cancelled, showRate, noShowRate };
  }, [calendarEvents]);

  // ── Pipeline Analytics ──
  const pipelineStats = useMemo(() => {
    const total = mavMeetRecords.length;
    const open = mavMeetRecords.filter((r) => (r.ghl_status || "open") === "open").length;
    const won = mavMeetRecords.filter((r) => r.ghl_status === "won").length;
    const lost = mavMeetRecords.filter((r) => r.ghl_status === "lost").length;
    const abandoned = mavMeetRecords.filter((r) => r.ghl_status === "abandoned").length;
    const conversionRate = total > 0 ? ((won / total) * 100) : 0;
    const lossRate = total > 0 ? ((lost / total) * 100) : 0;

    return { total, open, won, lost, abandoned, conversionRate, lossRate };
  }, [mavMeetRecords]);

  // ── Revenue Analytics ──
  const revenueStats = useMemo(() => {
    const totalQuoted = mavSalesRecords.reduce((s, r) => s + (r.fees_quoted || 0), 0);
    const totalCollected = mavSalesRecords.reduce((s, r) => s + (r.fees_collected || 0), 0);
    const totalPending = mavSalesRecords.reduce((s, r) => s + (r.pending_amount || 0), 0);
    const fullyPaid = mavSalesRecords.filter((r) => r.collection_status === "fully_paid").length;
    const partial = mavSalesRecords.filter((r) => r.collection_status === "partial").length;
    const overdue = mavSalesRecords.filter((r) => r.collection_status === "overdue").length;
    const collectionRate = totalQuoted > 0 ? ((totalCollected / totalQuoted) * 100) : 0;
    const avgDealSize = mavSalesRecords.length > 0 ? totalQuoted / mavSalesRecords.length : 0;

    return { totalQuoted, totalCollected, totalPending, fullyPaid, partial, overdue, collectionRate, avgDealSize, totalDeals: mavSalesRecords.length };
  }, [mavSalesRecords]);

  // ── Source Breakdown ──
  const sourceBreakdown = useMemo(() => {
    const map: Record<string, { total: number; won: number }> = {};
    mavMeetRecords.forEach((r) => {
      const src = r.source || "Unknown";
      if (!map[src]) map[src] = { total: 0, won: 0 };
      map[src].total++;
      if (r.ghl_status === "won") map[src].won++;
    });
    return Object.entries(map)
      .map(([source, data]) => ({
        source,
        ...data,
        rate: data.total > 0 ? ((data.won / data.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [mavMeetRecords]);

  // ── Monthly Trend ──
  const monthlyTrend = useMemo(() => {
    const months: Record<string, { booked: number; won: number; revenue: number }> = {};

    // Last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[key] = { booked: 0, won: 0, revenue: 0 };
    }

    calendarEvents.forEach((ev) => {
      const d = new Date(ev.startTime);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (months[key]) months[key].booked++;
    });

    mavMeetRecords.forEach((r) => {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (months[key] && r.ghl_status === "won") months[key].won++;
    });

    mavSalesRecords.forEach((r) => {
      // Use created_at from the base record
      const d = new Date();
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (months[key]) months[key].revenue += r.fees_collected || 0;
    });

    return Object.entries(months).map(([key, data]) => {
      const [y, m] = key.split("-");
      const label = new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", { month: "short" });
      return { label, ...data };
    });
  }, [calendarEvents, mavMeetRecords, mavSalesRecords]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex-shrink-0 border-b border-border">
        <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
        <p className="text-muted text-sm mt-0.5">
          Meeting and revenue performance overview
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* ── Meeting Performance ── */}
        <Section title="Meeting Performance" icon={<CalendarCheck className="w-4 h-4" />}>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <MetricCard label="Total Booked" value={meetingStats.totalBooked} icon={<CalendarCheck className="w-4 h-4" />} color="text-blue-400" bg="bg-blue-500/10" />
            <MetricCard label="Confirmed" value={meetingStats.confirmed} icon={<CheckCircle className="w-4 h-4" />} color="text-cyan-400" bg="bg-cyan-500/10" />
            <MetricCard label="Showed Up" value={meetingStats.showed} icon={<UserCheck className="w-4 h-4" />} color="text-green-400" bg="bg-green-500/10" />
            <MetricCard label="No Show" value={meetingStats.noShow} icon={<UserX className="w-4 h-4" />} color="text-red-400" bg="bg-red-500/10" />
            <MetricCard label="Cancelled" value={meetingStats.cancelled} icon={<XCircle className="w-4 h-4" />} color="text-gray-400" bg="bg-gray-500/10" />
            <MetricCard label="Show Rate" value={`${meetingStats.showRate.toFixed(1)}%`} icon={<ArrowUpRight className="w-4 h-4" />} color="text-green-400" bg="bg-green-500/10" highlight />
            <MetricCard label="No-Show Rate" value={`${meetingStats.noShowRate.toFixed(1)}%`} icon={<ArrowDownRight className="w-4 h-4" />} color="text-red-400" bg="bg-red-500/10" highlight />
          </div>
        </Section>

        {/* ── Pipeline / Conversion ── */}
        <Section title="Pipeline & Conversion" icon={<Target className="w-4 h-4" />}>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <MetricCard label="Total Leads" value={pipelineStats.total} icon={<Target className="w-4 h-4" />} color="text-blue-400" bg="bg-blue-500/10" />
            <MetricCard label="Open" value={pipelineStats.open} icon={<Clock className="w-4 h-4" />} color="text-blue-400" bg="bg-blue-500/10" />
            <MetricCard label="Won" value={pipelineStats.won} icon={<CheckCircle className="w-4 h-4" />} color="text-green-400" bg="bg-green-500/10" />
            <MetricCard label="Lost" value={pipelineStats.lost} icon={<XCircle className="w-4 h-4" />} color="text-red-400" bg="bg-red-500/10" />
            <MetricCard label="Abandoned" value={pipelineStats.abandoned} icon={<UserX className="w-4 h-4" />} color="text-gray-400" bg="bg-gray-500/10" />
            <MetricCard label="Conversion Rate" value={`${pipelineStats.conversionRate.toFixed(1)}%`} icon={<ArrowUpRight className="w-4 h-4" />} color="text-green-400" bg="bg-green-500/10" highlight />
            <MetricCard label="Loss Rate" value={`${pipelineStats.lossRate.toFixed(1)}%`} icon={<ArrowDownRight className="w-4 h-4" />} color="text-red-400" bg="bg-red-500/10" highlight />
          </div>

          {/* Pipeline Funnel Bar */}
          {pipelineStats.total > 0 && (
            <div className="mt-4">
              <p className="text-[11px] text-muted mb-2 uppercase tracking-wider">Pipeline Funnel</p>
              <div className="flex h-6 rounded-lg overflow-hidden border border-border">
                {pipelineStats.open > 0 && (
                  <div className="bg-blue-500/30 flex items-center justify-center" style={{ width: `${(pipelineStats.open / pipelineStats.total) * 100}%` }}>
                    <span className="text-[9px] text-blue-300 font-medium">Open {pipelineStats.open}</span>
                  </div>
                )}
                {pipelineStats.won > 0 && (
                  <div className="bg-green-500/30 flex items-center justify-center" style={{ width: `${(pipelineStats.won / pipelineStats.total) * 100}%` }}>
                    <span className="text-[9px] text-green-300 font-medium">Won {pipelineStats.won}</span>
                  </div>
                )}
                {pipelineStats.lost > 0 && (
                  <div className="bg-red-500/30 flex items-center justify-center" style={{ width: `${(pipelineStats.lost / pipelineStats.total) * 100}%` }}>
                    <span className="text-[9px] text-red-300 font-medium">Lost {pipelineStats.lost}</span>
                  </div>
                )}
                {pipelineStats.abandoned > 0 && (
                  <div className="bg-gray-500/30 flex items-center justify-center" style={{ width: `${(pipelineStats.abandoned / pipelineStats.total) * 100}%` }}>
                    <span className="text-[9px] text-gray-300 font-medium">Abn {pipelineStats.abandoned}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </Section>

        {/* ── Revenue ── */}
        <Section title="Revenue" icon={<DollarSign className="w-4 h-4" />}>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <MetricCard label="Total Quoted" value={`₹${revenueStats.totalQuoted.toLocaleString()}`} icon={<TrendingUp className="w-4 h-4" />} color="text-blue-400" bg="bg-blue-500/10" />
            <MetricCard label="Collected" value={`₹${revenueStats.totalCollected.toLocaleString()}`} icon={<DollarSign className="w-4 h-4" />} color="text-green-400" bg="bg-green-500/10" />
            <MetricCard label="Pending" value={`₹${revenueStats.totalPending.toLocaleString()}`} icon={<Clock className="w-4 h-4" />} color="text-amber-400" bg="bg-amber-500/10" />
            <MetricCard label="Collection Rate" value={`${revenueStats.collectionRate.toFixed(1)}%`} icon={<ArrowUpRight className="w-4 h-4" />} color="text-green-400" bg="bg-green-500/10" highlight />
            <MetricCard label="Avg Deal Size" value={`₹${Math.round(revenueStats.avgDealSize).toLocaleString()}`} icon={<BarChart3 className="w-4 h-4" />} color="text-purple-400" bg="bg-purple-500/10" />
          </div>

          {/* Collection Breakdown */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="border border-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs text-muted">Fully Paid</span>
              </div>
              <p className="text-lg font-semibold text-green-400">{revenueStats.fullyPaid}<span className="text-xs text-muted font-normal">/{revenueStats.totalDeals}</span></p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs text-muted">Partial</span>
              </div>
              <p className="text-lg font-semibold text-blue-400">{revenueStats.partial}</p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs text-muted">Overdue</span>
              </div>
              <p className="text-lg font-semibold text-red-400">{revenueStats.overdue}</p>
            </div>
          </div>
        </Section>

        {/* ── Source Breakdown & Monthly Trend side by side ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Source Breakdown */}
          <Section title="Source Breakdown" icon={<BarChart3 className="w-4 h-4" />}>
            {sourceBreakdown.length === 0 ? (
              <p className="text-xs text-muted py-4">No data yet</p>
            ) : (
              <div className="space-y-2">
                {sourceBreakdown.map((s) => (
                  <div key={s.source} className="flex items-center gap-3">
                    <div className="w-28 text-xs text-foreground truncate">{s.source}</div>
                    <div className="flex-1 h-5 bg-surface rounded-full overflow-hidden border border-border relative">
                      <div
                        className="h-full bg-accent/30 rounded-full"
                        style={{ width: `${pipelineStats.total > 0 ? (s.total / pipelineStats.total) * 100 : 0}%` }}
                      />
                      {s.won > 0 && (
                        <div
                          className="h-full bg-green-500/40 rounded-full absolute top-0 left-0"
                          style={{ width: `${pipelineStats.total > 0 ? (s.won / pipelineStats.total) * 100 : 0}%` }}
                        />
                      )}
                    </div>
                    <div className="w-20 text-right">
                      <span className="text-xs text-foreground">{s.total}</span>
                      <span className="text-[10px] text-muted ml-1">({s.won} won)</span>
                    </div>
                    <div className="w-14 text-right">
                      <span className={`text-[11px] font-medium ${s.rate >= 50 ? "text-green-400" : s.rate >= 25 ? "text-amber-400" : "text-red-400"}`}>
                        {s.rate.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Monthly Trend */}
          <Section title="Monthly Trend (6 months)" icon={<TrendingUp className="w-4 h-4" />}>
            {monthlyTrend.length === 0 ? (
              <p className="text-xs text-muted py-4">No data yet</p>
            ) : (
              <div>
                {/* Simple bar chart */}
                <div className="flex items-end gap-2 h-32 mb-2">
                  {monthlyTrend.map((m) => {
                    const maxBooked = Math.max(...monthlyTrend.map((t) => t.booked), 1);
                    const height = (m.booked / maxBooked) * 100;
                    const wonHeight = m.booked > 0 ? (m.won / m.booked) * height : 0;
                    return (
                      <div key={m.label} className="flex-1 flex flex-col items-center gap-0.5">
                        <span className="text-[9px] text-muted">{m.booked}</span>
                        <div className="w-full relative" style={{ height: `${height}%`, minHeight: m.booked > 0 ? "4px" : "0" }}>
                          <div className="absolute bottom-0 w-full bg-blue-500/30 rounded-t" style={{ height: "100%" }} />
                          {wonHeight > 0 && (
                            <div className="absolute bottom-0 w-full bg-green-500/40 rounded-t" style={{ height: `${wonHeight}%` }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  {monthlyTrend.map((m) => (
                    <div key={m.label} className="flex-1 text-center text-[10px] text-muted">{m.label}</div>
                  ))}
                </div>
                {/* Legend */}
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-blue-500/30 border border-blue-500/50" />
                    <span className="text-[10px] text-muted">Booked</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-green-500/40 border border-green-500/50" />
                    <span className="text-[10px] text-muted">Won</span>
                  </div>
                </div>
              </div>
            )}
          </Section>
        </div>

        {/* ── Key Ratios Summary ── */}
        <Section title="Key Ratios" icon={<Target className="w-4 h-4" />}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <RatioCard
              label="Booked → Show"
              from={meetingStats.totalBooked}
              to={meetingStats.showed}
              rate={meetingStats.showRate}
            />
            <RatioCard
              label="Show → Won"
              from={meetingStats.showed}
              to={pipelineStats.won}
              rate={meetingStats.showed > 0 ? (pipelineStats.won / meetingStats.showed) * 100 : 0}
            />
            <RatioCard
              label="Booked → Won"
              from={meetingStats.totalBooked}
              to={pipelineStats.won}
              rate={meetingStats.totalBooked > 0 ? (pipelineStats.won / meetingStats.totalBooked) * 100 : 0}
            />
            <RatioCard
              label="Revenue / Deal"
              from={revenueStats.totalDeals}
              to={null}
              rate={null}
              customValue={`₹${Math.round(revenueStats.avgDealSize).toLocaleString()}`}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

/* ── Section Wrapper ───────────────────────────────── */

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

/* ── Metric Card ───────────────────────────────────── */

function MetricCard({
  label,
  value,
  icon,
  color,
  bg,
  highlight,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  bg: string;
  highlight?: boolean;
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

/* ── Ratio Card ────────────────────────────────────── */

function RatioCard({
  label,
  from,
  to,
  rate,
  customValue,
}: {
  label: string;
  from: number;
  to: number | null;
  rate: number | null;
  customValue?: string;
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
