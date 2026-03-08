"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  IndianRupee,
  AlertTriangle,
  Phone,
  Mail,
  MessageSquare,
  Search,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Eye,
  ExternalLink,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

/* ── Types ─────────────────────────────────────────── */

interface RazorpayInvoice {
  id: string;
  type: string;
  status: string; // draft | issued | partially_paid | paid | cancelled | expired
  customer_details: {
    name: string | null;
    email: string | null;
    contact: string | null;
  };
  amount: number; // paise
  amount_paid: number; // paise
  amount_due: number; // paise
  date: number; // unix timestamp
  expire_by: number | null; // unix timestamp
  short_url: string | null;
}

interface FollowUp {
  id: string;
  invoice_id: string;
  follow_up_status: string; // pending | contacted | partial_paid | paid | written_off | disputed
  last_contacted: string | null;
  next_follow_up_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface MergedInvoice {
  invoice: RazorpayInvoice;
  followUp: FollowUp | null;
  tracked: boolean;
}

const FOLLOW_UP_STATUSES = [
  { value: "pending", label: "Pending", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  { value: "contacted", label: "Contacted", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  { value: "partial_paid", label: "Partial Paid", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  { value: "paid", label: "Paid", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  { value: "written_off", label: "Written Off", color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20" },
  { value: "disputed", label: "Disputed", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
];

type FilterValue = "all" | "pending" | "contacted" | "partial_paid" | "paid" | "written_off" | "disputed" | "untracked";

/* ── Main Component ────────────────────────────────── */

export default function OutstandingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoices, setInvoices] = useState<RazorpayInvoice[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);

  // Filters
  const [filter, setFilter] = useState<FilterValue>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Inline editing
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Tracking state
  const [trackingId, setTrackingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [invRes, fuRes] = await Promise.all([
        apiFetch("/api/razorpay/invoices"),
        apiFetch("/api/payments/invoice-follow-ups"),
      ]);
      const invData = await invRes.json();
      const fuData = await fuRes.json();

      if (invData.error) throw new Error(invData.error);
      if (fuData.error) throw new Error(fuData.error);

      // Filter for outstanding invoices only
      const outstanding = (invData.invoices || []).filter(
        (inv: RazorpayInvoice) => inv.status === "issued" || inv.status === "partially_paid"
      );
      setInvoices(outstanding);
      setFollowUps(fuData.follow_ups || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Merge invoices with follow-ups ─────────────── */

  const merged = useMemo<MergedInvoice[]>(() => {
    return invoices.map((inv) => {
      const fu = followUps.find((f) => f.invoice_id === inv.id) || null;
      return { invoice: inv, followUp: fu, tracked: !!fu };
    });
  }, [invoices, followUps]);

  /* ── Stats ──────────────────────────────────────── */

  const stats = useMemo(() => {
    const totalOutstanding = merged.reduce((s, m) => s + (m.invoice.amount_due || 0), 0);
    const now = Date.now() / 1000;
    const overdue = merged.filter((m) => m.invoice.expire_by && m.invoice.expire_by < now).length;
    const contacted = merged.filter((m) => m.followUp?.follow_up_status === "contacted").length;
    const partiallyPaid = merged.filter((m) => m.invoice.status === "partially_paid").length;
    return { totalOutstanding, overdue, contacted, partiallyPaid };
  }, [merged]);

  /* ── Filtered list ──────────────────────────────── */

  const filtered = useMemo(() => {
    return merged.filter((m) => {
      // Filter by status
      if (filter === "untracked" && m.tracked) return false;
      if (filter !== "all" && filter !== "untracked") {
        if (!m.followUp || m.followUp.follow_up_status !== filter) return false;
      }

      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = m.invoice.customer_details?.name?.toLowerCase() || "";
        const email = m.invoice.customer_details?.email?.toLowerCase() || "";
        const id = m.invoice.id.toLowerCase();
        return name.includes(q) || email.includes(q) || id.includes(q);
      }
      return true;
    });
  }, [merged, filter, searchQuery]);

  /* ── Filter counts ──────────────────────────────── */

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: merged.length, untracked: 0 };
    FOLLOW_UP_STATUSES.forEach((s) => (counts[s.value] = 0));
    merged.forEach((m) => {
      if (!m.tracked) {
        counts.untracked++;
      } else if (m.followUp) {
        counts[m.followUp.follow_up_status] = (counts[m.followUp.follow_up_status] || 0) + 1;
      }
    });
    return counts;
  }, [merged]);

  /* ── Track invoice ──────────────────────────────── */

  const trackInvoice = async (invoiceId: string) => {
    setTrackingId(invoiceId);
    try {
      const res = await apiFetch("/api/payments/invoice-follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId, follow_up_status: "pending" }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFollowUps((prev) => [...prev, data.follow_up]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to track invoice");
    } finally {
      setTrackingId(null);
    }
  };

  /* ── Update follow-up ──────────────────────────── */

  const updateFollowUp = async (followUpId: string, invoiceId: string, updates: Record<string, unknown>) => {
    try {
      const res = await apiFetch("/api/payments/invoice-follow-ups", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: followUpId, ...updates }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFollowUps((prev) =>
        prev.map((f) => (f.id === followUpId ? { ...f, ...updates } as FollowUp : f))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  /* ── Edit helpers ───────────────────────────────── */

  function startEdit(id: string, field: string, currentValue: string) {
    setEditingCell({ id, field });
    setEditValue(currentValue || "");
  }

  function commitEdit() {
    if (!editingCell) return;
    const { id, field } = editingCell;
    const m = merged.find((m) => m.invoice.id === id);
    if (m?.followUp) {
      updateFollowUp(m.followUp.id, id, { [field]: editValue || null });
    }
    setEditingCell(null);
    setEditValue("");
  }

  function cancelEdit() {
    setEditingCell(null);
    setEditValue("");
  }

  /* ── Helpers ────────────────────────────────────── */

  function formatDate(ts: number | null | undefined): string {
    if (!ts) return "-";
    return new Date(ts * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  function daysOverdue(expireBy: number | null | undefined): number {
    if (!expireBy) return 0;
    const now = Date.now() / 1000;
    const diff = now - expireBy;
    return diff > 0 ? Math.floor(diff / 86400) : 0;
  }

  function getStatusConfig(status: string) {
    return FOLLOW_UP_STATUSES.find((s) => s.value === status) || FOLLOW_UP_STATUSES[0];
  }

  /* ── Columns ────────────────────────────────────── */

  const COLUMNS = [
    { key: "sno", label: "#", width: "w-10" },
    { key: "invoice_id", label: "Invoice ID", width: "w-36" },
    { key: "customer", label: "Customer", width: "w-48" },
    { key: "amount_due", label: "Amount Due", width: "w-32" },
    { key: "due_date", label: "Due Date", width: "w-28" },
    { key: "days_overdue", label: "Days Overdue", width: "w-28" },
    { key: "status", label: "Status", width: "w-36" },
    { key: "last_contacted", label: "Last Contacted", width: "w-32" },
    { key: "next_follow_up", label: "Next Follow-up", width: "w-36" },
    { key: "notes", label: "Notes", width: "w-48" },
    { key: "actions", label: "Actions", width: "w-32" },
  ];

  const FILTER_PILLS: { value: FilterValue; label: string; color: string; bg: string }[] = [
    { value: "all", label: "All", color: "text-[#B8860B]", bg: "bg-[#B8860B]/10 border-[#B8860B]/20" },
    ...FOLLOW_UP_STATUSES.map((s) => ({ value: s.value as FilterValue, label: s.label, color: s.color, bg: s.bg })),
    { value: "untracked", label: "Untracked", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex-shrink-0 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-[#B8860B] rounded-full" />
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Outstanding Invoices</h1>
              <p className="text-muted text-xs mt-0.5">
                {merged.length} outstanding invoice{merged.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20 flex items-center justify-between">
          {error}
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-300 text-xs ml-4">Dismiss</button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="px-6 py-3 flex gap-3 flex-shrink-0 border-b border-border/50">
        <StatCard
          icon={<IndianRupee className="w-4 h-4" />}
          label="Total Outstanding"
          value={`\u20B9${(stats.totalOutstanding / 100).toLocaleString("en-IN", { minimumFractionDigits: 0 })}`}
          color="text-[#B8860B]"
          bg="bg-[#B8860B]/10"
        />
        <StatCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Overdue"
          value={String(stats.overdue)}
          color="text-red-400"
          bg="bg-red-500/10"
        />
        <StatCard
          icon={<Phone className="w-4 h-4" />}
          label="Contacted"
          value={String(stats.contacted)}
          color="text-blue-400"
          bg="bg-blue-500/10"
        />
        <StatCard
          icon={<AlertCircle className="w-4 h-4" />}
          label="Partially Paid"
          value={String(stats.partiallyPaid)}
          color="text-purple-400"
          bg="bg-purple-500/10"
        />
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 flex items-center gap-3 flex-shrink-0 border-b border-border/50 bg-surface/50">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            type="text"
            placeholder="Search by invoice ID, name, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-[#B8860B] placeholder:text-muted/50"
          />
        </div>
        <span className="text-xs text-muted ml-auto">Showing {filtered.length} of {merged.length}</span>
      </div>

      {/* Filter Pills */}
      <div className="px-6 py-2 flex gap-2 flex-wrap flex-shrink-0 border-b border-border/50">
        {FILTER_PILLS.map((pill) => (
          <button
            key={pill.value}
            onClick={() => setFilter(filter === pill.value ? "all" : pill.value)}
            className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
              filter === pill.value
                ? pill.bg + " " + pill.color
                : "border-border text-muted hover:border-border/80"
            }`}
          >
            {pill.label}
            <span>{filterCounts[pill.value] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted text-sm">Loading...</div>
        ) : (
          <table className="w-full border-collapse min-w-[1400px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface border-b border-border/50">
                {COLUMNS.map((col) => (
                  <th key={col.key} className={`${col.width} text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5 border-r border-border last:border-r-0`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="text-center py-16 text-muted text-sm">
                    {merged.length === 0 ? "No outstanding invoices found." : "No invoices match your filters."}
                  </td>
                </tr>
              ) : (
                filtered.map((m, idx) => {
                  const inv = m.invoice;
                  const fu = m.followUp;
                  const overdue = daysOverdue(inv.expire_by);
                  const isUntracked = !m.tracked;

                  return (
                    <tr
                      key={inv.id}
                      className={`border-b transition-colors ${
                        isUntracked
                          ? "border-red-500/30 border-dashed hover:bg-red-500/5"
                          : "border-border/50 hover:bg-surface-hover/50"
                      }`}
                    >
                      {/* # */}
                      <td className="px-3 py-2 text-xs text-muted border-r border-border">{idx + 1}</td>

                      {/* Invoice ID */}
                      <td className="px-3 py-2 text-xs border-r border-border">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-foreground truncate max-w-[100px]" title={inv.id}>
                            {inv.id}
                          </span>
                          {inv.short_url && (
                            <a
                              href={inv.short_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-0.5 rounded hover:bg-[#B8860B]/10 text-muted hover:text-[#B8860B] transition-colors flex-shrink-0"
                              title="Open payment link"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-3 py-2 text-xs border-r border-border">
                        <div>
                          <span className="text-foreground font-medium block">
                            {inv.customer_details?.name || "Unknown"}
                          </span>
                          {inv.customer_details?.email && (
                            <span className="text-muted text-[10px]">{inv.customer_details.email}</span>
                          )}
                        </div>
                      </td>

                      {/* Amount Due */}
                      <td className="px-3 py-2 text-xs border-r border-border">
                        <span className="text-foreground font-medium">
                          {`\u20B9${(inv.amount_due / 100).toLocaleString("en-IN")}`}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="px-3 py-2 text-xs border-r border-border text-foreground">
                        {formatDate(inv.expire_by)}
                      </td>

                      {/* Days Overdue */}
                      <td className="px-3 py-2 text-xs border-r border-border">
                        {overdue > 0 ? (
                          <span className="text-red-400 font-medium">{overdue}d</span>
                        ) : (
                          <span className="text-green-400">On time</span>
                        )}
                      </td>

                      {/* Status (dropdown, only for tracked) */}
                      <td className="px-2 py-1.5 border-r border-border">
                        {isUntracked ? (
                          <span className="text-[11px] text-red-400 italic">Untracked</span>
                        ) : (
                          <select
                            value={fu?.follow_up_status || "pending"}
                            onChange={(e) => {
                              if (fu) updateFollowUp(fu.id, inv.id, { follow_up_status: e.target.value });
                            }}
                            className="w-full bg-transparent text-xs text-foreground border-none focus:outline-none cursor-pointer [&>option]:bg-surface"
                          >
                            {FOLLOW_UP_STATUSES.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        )}
                      </td>

                      {/* Last Contacted */}
                      <td className="px-3 py-2 text-xs border-r border-border text-foreground">
                        {fu?.last_contacted
                          ? new Date(fu.last_contacted).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                          : <span className="text-muted">-</span>}
                      </td>

                      {/* Next Follow-up (inline date picker) */}
                      <td className="px-3 py-2 text-xs border-r border-border">
                        {isUntracked ? (
                          <span className="text-muted">-</span>
                        ) : (
                          <input
                            type="date"
                            value={fu?.next_follow_up_date ? new Date(fu.next_follow_up_date).toISOString().slice(0, 10) : ""}
                            onChange={(e) => {
                              if (fu) updateFollowUp(fu.id, inv.id, { next_follow_up_date: e.target.value || null });
                            }}
                            className="bg-transparent border-none text-xs text-foreground focus:outline-none cursor-pointer [color-scheme:dark] w-full"
                          />
                        )}
                      </td>

                      {/* Notes (inline editable) */}
                      <td
                        className={`px-3 py-2 text-xs border-r border-border ${isUntracked ? "" : "cursor-pointer"}`}
                        onClick={() => {
                          if (!isUntracked) startEdit(inv.id, "notes", fu?.notes || "");
                        }}
                      >
                        {editingCell?.id === inv.id && editingCell?.field === "notes" ? (
                          <input
                            autoFocus
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                            className="w-full bg-background border border-[#B8860B] rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none"
                          />
                        ) : isUntracked ? (
                          <span className="text-muted">-</span>
                        ) : (
                          <span className={fu?.notes ? "text-foreground" : "text-muted/40 italic"}>
                            {fu?.notes || "Click to add..."}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {isUntracked ? (
                            <button
                              onClick={() => trackInvoice(inv.id)}
                              disabled={trackingId === inv.id}
                              className="px-2 py-1 bg-[#B8860B] hover:bg-[#9A7209] text-white text-[10px] font-medium rounded transition-colors disabled:opacity-50"
                            >
                              {trackingId === inv.id ? "..." : "Track"}
                            </button>
                          ) : null}
                          {inv.customer_details?.contact && (
                            <a
                              href={`tel:${inv.customer_details.contact}`}
                              className="p-1 rounded hover:bg-green-500/10 text-muted hover:text-green-400 transition-colors"
                              title="Call"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {inv.customer_details?.email && (
                            <a
                              href={`mailto:${inv.customer_details.email}`}
                              className="p-1 rounded hover:bg-blue-500/10 text-muted hover:text-blue-400 transition-colors"
                              title="Email"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {inv.customer_details?.contact && (
                            <a
                              href={`https://wa.me/${inv.customer_details.contact.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded hover:bg-green-500/10 text-muted hover:text-green-400 transition-colors"
                              title="WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ── Stat Card ──────────────────────────────────────── */

function StatCard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: string; color: string; bg: string }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/30 ${bg}`}>
      <div className={color}>{icon}</div>
      <div>
        <p className="text-[9px] text-muted uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}
