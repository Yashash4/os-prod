"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Search,
  AlertTriangle,
  Phone,
  Mail,
  MessageSquare,
  IndianRupee,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Eye,
  Loader2,
  RefreshCw,
} from "lucide-react";
import PaymentLinkModal from "@/components/PaymentLinkModal";
import { apiFetch } from "@/lib/api-fetch";
import PermissionGate from "@/components/PermissionGate";

/* ── Types ─────────────────────────────────────────── */

interface RazorpayPayment {
  id: string;
  amount: number; // paise
  currency: string;
  status: string;
  method: string;
  email: string;
  contact: string;
  description: string | null;
  notes: Record<string, string>;
  created_at: number; // unix
  error_code: string | null;
  error_description: string | null;
}

interface TrackingRecord {
  id: string;
  razorpay_payment_id: string;
  status: string; // pending | contacted | resolved | written_off | retry_sent
  notes: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  amount: number;
  razorpay_created_at: string;
  created_at: string;
  updated_at: string;
}

interface MergedRow {
  payment: RazorpayPayment;
  tracking: TrackingRecord | null;
}

/* ── Status Configs ──────────────────────────────────── */

const TRACKING_STATUSES = [
  { value: "pending", label: "Pending", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: Clock },
  { value: "contacted", label: "Contacted", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", icon: Phone },
  { value: "resolved", label: "Resolved", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", icon: CheckCircle },
  { value: "written_off", label: "Written Off", color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20", icon: XCircle },
  { value: "retry_sent", label: "Retry Sent", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", icon: Send },
];

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "contacted", label: "Contacted" },
  { value: "resolved", label: "Resolved" },
  { value: "written_off", label: "Written Off" },
  { value: "retry_sent", label: "Retry Sent" },
  { value: "untracked", label: "Untracked" },
];

const DATE_PRESETS = [
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
  { label: "60 days", days: 60 },
  { label: "90 days", days: 90 },
];

/* ── Helpers ─────────────────────────────────────────── */

function formatDate(ts: number | string): string {
  const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatAmount(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function truncateId(id: string): string {
  if (id.length <= 18) return id;
  return id.slice(0, 10) + "..." + id.slice(-6);
}

/* ── Main Component ────────────────────────────────── */

export default function FailedPaymentsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payments, setPayments] = useState<RazorpayPayment[]>([]);
  const [trackingRecords, setTrackingRecords] = useState<TrackingRecord[]>([]);

  // Date range
  const [datePreset, setDatePreset] = useState(30);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Editing
  const [editingCell, setEditingCell] = useState<{ paymentId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Tracking creation in-progress
  const [trackingInProgress, setTrackingInProgress] = useState<Set<string>>(new Set());

  // Payment Link Modal
  const [paymentLinkRow, setPaymentLinkRow] = useState<MergedRow | null>(null);

  // Refreshing
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (days: number) => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const from = now - days * 86400;

      const [paymentsRes, trackingRes] = await Promise.all([
        apiFetch(`/api/razorpay/payments?from=${from}&to=${now}`),
        apiFetch("/api/payments/failed-tracking"),
      ]);

      const paymentsData = await paymentsRes.json();
      const trackingData = await trackingRes.json();

      const allPayments: RazorpayPayment[] = paymentsData.payments || paymentsData.items || [];
      const failedPayments = allPayments.filter(
        (p) => p.status === "failed" || p.status === "created"
      );
      setPayments(failedPayments);
      setTrackingRecords(trackingData.records || []);
    } catch {
      setError("Failed to load payment data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(datePreset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datePreset]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData(datePreset);
  };

  // Merge payments with tracking
  const mergedRows = useMemo<MergedRow[]>(() => {
    const trackMap = new Map<string, TrackingRecord>();
    for (const t of trackingRecords) {
      trackMap.set(t.razorpay_payment_id, t);
    }
    return payments.map((p) => ({
      payment: p,
      tracking: trackMap.get(p.id) || null,
    }));
  }, [payments, trackingRecords]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return mergedRows.filter((row) => {
      // Status filter
      if (statusFilter === "untracked" && row.tracking !== null) return false;
      if (statusFilter !== "all" && statusFilter !== "untracked") {
        if (!row.tracking || row.tracking.status !== statusFilter) return false;
      }
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          row.payment.id.toLowerCase().includes(q) ||
          (row.payment.email || "").toLowerCase().includes(q) ||
          (row.payment.contact || "").toLowerCase().includes(q) ||
          (row.tracking?.contact_name || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [mergedRows, statusFilter, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const totalFailed = mergedRows.reduce((s, r) => s + r.payment.amount, 0);
    const tracked = mergedRows.filter((r) => r.tracking !== null).length;
    const contacted = mergedRows.filter((r) => r.tracking?.status === "contacted").length;
    const resolved = mergedRows.filter((r) => r.tracking?.status === "resolved").length;
    return { totalFailed, tracked, contacted, resolved };
  }, [mergedRows]);

  // Filter counts
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: mergedRows.length, untracked: 0 };
    for (const s of TRACKING_STATUSES) counts[s.value] = 0;
    for (const row of mergedRows) {
      if (!row.tracking) {
        counts.untracked++;
      } else {
        counts[row.tracking.status] = (counts[row.tracking.status] || 0) + 1;
      }
    }
    return counts;
  }, [mergedRows]);

  // Track a payment
  const trackPayment = async (row: MergedRow) => {
    const payId = row.payment.id;
    setTrackingInProgress((prev) => new Set(prev).add(payId));
    try {
      const res = await apiFetch("/api/payments/failed-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_payment_id: payId,
          contact_name: row.payment.notes?.name || "",
          contact_email: row.payment.email || "",
          contact_phone: row.payment.contact || "",
          amount: row.payment.amount,
          razorpay_created_at: new Date(row.payment.created_at * 1000).toISOString(),
          status: "pending",
          notes: "",
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTrackingRecords((prev) => [...prev, data.record]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tracking record");
    } finally {
      setTrackingInProgress((prev) => {
        const next = new Set(prev);
        next.delete(payId);
        return next;
      });
    }
  };

  // Update tracking record
  const updateTracking = async (paymentId: string, updates: Record<string, unknown>) => {
    try {
      const res = await apiFetch("/api/payments/failed-tracking", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ razorpay_payment_id: paymentId, ...updates }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTrackingRecords((prev) =>
        prev.map((t) =>
          t.razorpay_payment_id === paymentId ? { ...t, ...updates } as TrackingRecord : t
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  // Edit helpers
  function startEdit(paymentId: string, field: string, currentValue: string) {
    setEditingCell({ paymentId, field });
    setEditValue(currentValue || "");
  }
  function commitEdit() {
    if (editingCell) {
      updateTracking(editingCell.paymentId, { [editingCell.field]: editValue });
      setEditingCell(null);
      setEditValue("");
    }
  }
  function cancelEdit() {
    setEditingCell(null);
    setEditValue("");
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-sm">Loading failed payments...</p>
      </div>
    );
  }

  const COLUMNS = [
    { key: "sno", label: "#", width: "w-10" },
    { key: "payment_id", label: "Payment ID", width: "w-40" },
    { key: "contact", label: "Contact", width: "w-52" },
    { key: "amount", label: "Amount", width: "w-28" },
    { key: "date", label: "Date", width: "w-28" },
    { key: "status", label: "Status", width: "w-36" },
    { key: "notes", label: "Notes", width: "w-48" },
    { key: "actions", label: "Actions", width: "w-32" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex-shrink-0 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-accent rounded-full" />
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Failed Payments</h1>
              <p className="text-muted text-xs mt-0.5">
                Track and resolve failed/pending Razorpay payments — {mergedRows.length} payments
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground bg-surface border border-border rounded-lg hover:border-accent/30 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
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
        <StatCard icon={<AlertTriangle className="w-4 h-4" />} label="Total Failed" value={formatAmount(stats.totalFailed)} color="text-red-400" bg="bg-red-500/10" />
        <StatCard icon={<Eye className="w-4 h-4" />} label="Tracked" value={`${stats.tracked}/${mergedRows.length}`} color="text-blue-400" bg="bg-blue-500/10" />
        <StatCard icon={<Phone className="w-4 h-4" />} label="Contacted" value={String(stats.contacted)} color="text-amber-400" bg="bg-amber-500/10" />
        <StatCard icon={<CheckCircle className="w-4 h-4" />} label="Resolved" value={String(stats.resolved)} color="text-green-400" bg="bg-green-500/10" />
      </div>

      {/* Date Presets */}
      <div className="px-6 py-2 flex items-center gap-2 flex-shrink-0 border-b border-border/50">
        <span className="text-[10px] text-muted uppercase tracking-wider mr-1">Range:</span>
        {DATE_PRESETS.map((p) => (
          <button
            key={p.days}
            onClick={() => setDatePreset(p.days)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
              datePreset === p.days
                ? "bg-accent/10 border-accent/20 text-accent"
                : "border-border text-muted hover:border-border/80"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Filter Pills */}
      <div className="px-6 py-2 flex gap-2 flex-wrap flex-shrink-0 border-b border-border/50">
        {FILTER_OPTIONS.map((f) => {
          const count = filterCounts[f.value] || 0;
          const isUntracked = f.value === "untracked";
          const statusCfg = TRACKING_STATUSES.find((s) => s.value === f.value);
          const isActive = statusFilter === f.value;

          let activeStyle = "bg-accent/10 border-accent/20 text-accent";
          if (isActive && isUntracked) activeStyle = "bg-red-500/10 border-red-500/20 text-red-400";
          else if (isActive && statusCfg) activeStyle = `${statusCfg.bg} ${statusCfg.color}`;

          return (
            <button
              key={f.value}
              onClick={() => setStatusFilter(statusFilter === f.value ? "all" : f.value)}
              className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                isActive ? activeStyle : "border-border text-muted hover:border-border/80"
              }`}
            >
              {f.label}
              <span>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 flex items-center gap-3 flex-shrink-0 border-b border-border/50 bg-surface/50">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            type="text"
            placeholder="Search by payment ID, email, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent placeholder:text-muted/50"
          />
        </div>
        <span className="text-xs text-muted ml-auto">
          Showing {filteredRows.length} of {mergedRows.length}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse min-w-[1200px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface border-b border-border/50">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`${col.width} text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5 border-r border-border last:border-r-0`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="text-center py-16 text-muted text-sm">
                  {mergedRows.length === 0
                    ? "No failed or pending payments found in this date range."
                    : "No records match your filters."}
                </td>
              </tr>
            ) : (
              filteredRows.map((row, idx) => {
                const isUntracked = !row.tracking;
                const isTrackingInProgress = trackingInProgress.has(row.payment.id);
                const contactName = row.tracking?.contact_name || row.payment.notes?.name || "";
                const contactEmail = row.tracking?.contact_email || row.payment.email || "";
                const contactPhone = row.tracking?.contact_phone || row.payment.contact || "";

                return (
                  <tr
                    key={row.payment.id}
                    className={`border-b transition-colors ${
                      isUntracked
                        ? "border-red-500/20 border-dashed hover:bg-red-500/5"
                        : "border-border/50 hover:bg-surface-hover/50"
                    }`}
                  >
                    {/* # */}
                    <td className="px-3 py-2 text-xs text-muted border-r border-border">{idx + 1}</td>

                    {/* Payment ID */}
                    <td className="px-3 py-2 text-xs border-r border-border">
                      <span className="font-mono text-foreground" title={row.payment.id}>
                        {truncateId(row.payment.id)}
                      </span>
                      <span className={`block text-[10px] mt-0.5 ${row.payment.status === "failed" ? "text-red-400" : "text-amber-400"}`}>
                        {row.payment.status}
                      </span>
                    </td>

                    {/* Contact */}
                    <td className="px-3 py-2 text-xs border-r border-border">
                      {contactName && <p className="text-foreground font-medium">{contactName}</p>}
                      {contactEmail && (
                        <a href={`mailto:${contactEmail}`} className="text-muted hover:text-accent transition-colors text-[11px] block truncate">
                          {contactEmail}
                        </a>
                      )}
                      {contactPhone && (
                        <a href={`tel:${contactPhone}`} className="text-muted hover:text-accent transition-colors text-[11px] block">
                          {contactPhone}
                        </a>
                      )}
                      {!contactName && !contactEmail && !contactPhone && <span className="text-muted">-</span>}
                    </td>

                    {/* Amount */}
                    <td className="px-3 py-2 text-xs border-r border-border">
                      <span className="text-red-400 font-medium">{formatAmount(row.payment.amount)}</span>
                    </td>

                    {/* Date */}
                    <td className="px-3 py-2 text-xs text-foreground border-r border-border">
                      {formatDate(row.payment.created_at)}
                    </td>

                    {/* Status */}
                    <td className="px-2 py-1.5 border-r border-border">
                      {isUntracked ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-dashed border-red-500/30 text-red-400 bg-red-500/5">
                          <AlertTriangle className="w-3 h-3" />
                          Untracked
                        </span>
                      ) : (
                        <PermissionGate module="payments" subModule="payments-failed" action="canApprove" fallback={<span className="text-[11px] font-medium">{TRACKING_STATUSES.find((s) => s.value === row.tracking!.status)?.label ?? row.tracking!.status}</span>}>
                          <TrackingStatusDropdown
                            current={row.tracking!.status}
                            onChange={(s) => updateTracking(row.payment.id, { status: s })}
                          />
                        </PermissionGate>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="px-3 py-2 text-xs border-r border-border">
                      {isUntracked ? (
                        <span className="text-muted/40 italic">Track first...</span>
                      ) : (
                        <PermissionGate module="payments" subModule="payments-failed" action="canEdit" fallback={<span className="text-xs text-muted">{row.tracking?.notes || "-"}</span>}>
                          <div
                            className="cursor-pointer"
                            onClick={() => startEdit(row.payment.id, "notes", row.tracking?.notes || "")}
                          >
                            {editingCell?.paymentId === row.payment.id && editingCell?.field === "notes" ? (
                              <input
                                autoFocus
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={commitEdit}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") commitEdit();
                                  if (e.key === "Escape") cancelEdit();
                                }}
                                className="w-full bg-background border border-accent rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none"
                              />
                            ) : (
                              <span className={row.tracking?.notes ? "text-foreground" : "text-muted/40 italic"}>
                                {row.tracking?.notes || "Click to add..."}
                              </span>
                            )}
                          </div>
                        </PermissionGate>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {isUntracked ? (
                          <PermissionGate module="payments" subModule="payments-failed" action="canCreate">
                            <button
                              onClick={() => trackPayment(row)}
                              disabled={isTrackingInProgress}
                              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
                            >
                              {isTrackingInProgress ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                              Track
                            </button>
                          </PermissionGate>
                        ) : (
                          <>
                            {contactPhone && (
                              <a
                                href={`https://wa.me/${contactPhone.replace(/[^0-9]/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded hover:bg-green-500/10 text-muted hover:text-green-400 transition-colors"
                                title="WhatsApp"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {contactEmail && (
                              <a
                                href={`mailto:${contactEmail}`}
                                className="p-1 rounded hover:bg-blue-500/10 text-muted hover:text-blue-400 transition-colors"
                                title="Email"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </>
                        )}
                        <button
                          onClick={() => setPaymentLinkRow(row)}
                          className="p-1 rounded hover:bg-indigo-500/10 text-muted hover:text-indigo-400 transition-colors"
                          title="Send Payment Link"
                        >
                          <IndianRupee className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Payment Link Modal */}
      {paymentLinkRow && (
        <PaymentLinkModal
          open={!!paymentLinkRow}
          onClose={() => setPaymentLinkRow(null)}
          customerName={paymentLinkRow.tracking?.contact_name || paymentLinkRow.payment.notes?.name || ""}
          customerEmail={paymentLinkRow.tracking?.contact_email || paymentLinkRow.payment.email || ""}
          customerPhone={paymentLinkRow.tracking?.contact_phone || paymentLinkRow.payment.contact || ""}
          amount={paymentLinkRow.payment.amount / 100}
          opportunityId={paymentLinkRow.payment.id}
          onSuccess={() => {
            if (paymentLinkRow.tracking) {
              updateTracking(paymentLinkRow.payment.id, { status: "retry_sent" });
            }
          }}
        />
      )}
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

/* ── Tracking Status Dropdown ─────────────────────── */

function TrackingStatusDropdown({ current, onChange }: { current: string; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const cfg = TRACKING_STATUSES.find((c) => c.value === current) || TRACKING_STATUSES[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md border ${cfg.bg} ${cfg.color} transition-colors`}
      >
        <cfg.icon className="w-3 h-3" />
        {cfg.label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-36 bg-surface border border-border rounded-lg shadow-xl z-30 py-1">
            {TRACKING_STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => {
                  onChange(s.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${
                  current === s.value ? "bg-accent/5 font-medium" : "hover:bg-surface-hover"
                } ${s.color}`}
              >
                <s.icon className="w-3 h-3" />
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
