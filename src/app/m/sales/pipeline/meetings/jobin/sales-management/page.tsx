"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Phone,
  Mail,
  Search,
  MessageSquare,
  DollarSign,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertCircle,
  IndianRupee,
} from "lucide-react";
import { SalesManagementSkeleton } from "@/components/Skeleton";
import PaymentLinkModal from "@/components/PaymentLinkModal";
import { apiFetch } from "@/lib/api-fetch";

/* ── Types ─────────────────────────────────────────── */

interface GHLUser {
  id: string;
  name: string;
  email: string;
}

interface SalesRecord {
  id: string;
  opportunity_id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  pipeline_name: string;
  pipeline_id: string | null;
  stage_name: string;
  source: string;
  assigned_to: string | null;
  contact_id: string | null;
  ghl_status: string | null;
  // Sales tracking fields
  closed_date: string | null;
  fees_quoted: number;
  fees_collected: number;
  pending_amount: number;
  payment_mode: string | null;
  invoice_number: string | null;
  collection_status: string;
  onboarding_status: string;
  sales_notes: string | null;
  payment_link_id: string | null;
  payment_link_url: string | null;
  payment_link_sent_at: string | null;
  created_at: string;
}

/* ── Status Configs ──────────────────────────────────── */

const COLLECTION_STATUSES = [
  { value: "pending", label: "Pending", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: Clock },
  { value: "partial", label: "Partial", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", icon: AlertCircle },
  { value: "fully_paid", label: "Fully Paid", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", icon: CheckCircle },
  { value: "overdue", label: "Overdue", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: AlertCircle },
  { value: "refunded", label: "Refunded", color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20", icon: DollarSign },
];

const ONBOARDING_STATUSES = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On Hold" },
];

const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Card", "Cheque", "Other"];

/* ── Main Component ────────────────────────────────── */

export default function SalesManagementPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [jobinUserId, setJobinUserId] = useState<string | null>(null);
  const [usersLoaded, setUsersLoaded] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [collectionFilter, setCollectionFilter] = useState<string>("all");

  // Editing
  const [editingCell, setEditingCell] = useState<{ oppId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Payment Link Modal
  const [paymentLinkRecord, setPaymentLinkRecord] = useState<SalesRecord | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const [usersRes, recordsRes] = await Promise.all([
          apiFetch("/api/ghl/users"),
          apiFetch("/api/sales/jobin-sales-tracking"),
        ]);
        const usersData = await usersRes.json();
        const recordsData = await recordsRes.json();

        const usrs = usersData.users || [];
        const jobin = usrs.find((u: GHLUser) =>
          u.name.toLowerCase().includes("jobin")
        );
        if (jobin) setJobinUserId(jobin.id);
        setUsersLoaded(true);

        if (!recordsData.error) setRecords(recordsData.records || []);
      } catch {
        setUsersLoaded(true);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Filter to Jobin's won leads only
  const jobinRecords = useMemo(() => {
    if (!usersLoaded) return [];
    if (!jobinUserId) return records;
    return records.filter((r) => r.assigned_to === jobinUserId);
  }, [records, jobinUserId, usersLoaded]);

  const filteredRecords = useMemo(() => {
    return jobinRecords.filter((r) => {
      if (collectionFilter !== "all" && r.collection_status !== collectionFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          r.contact_name?.toLowerCase().includes(q) ||
          r.contact_email?.toLowerCase().includes(q) ||
          r.contact_phone?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [jobinRecords, collectionFilter, searchQuery]);

  // Summary stats
  const stats = useMemo(() => {
    const totalQuoted = jobinRecords.reduce((s, r) => s + (r.fees_quoted || 0), 0);
    const totalCollected = jobinRecords.reduce((s, r) => s + (r.fees_collected || 0), 0);
    const totalPending = jobinRecords.reduce((s, r) => s + (r.pending_amount || 0), 0);
    const fullyPaid = jobinRecords.filter((r) => r.collection_status === "fully_paid").length;
    return { totalQuoted, totalCollected, totalPending, fullyPaid, total: jobinRecords.length };
  }, [jobinRecords]);

  // Update sales tracking field
  const updateSalesRecord = async (oppId: string, updates: Record<string, unknown>) => {
    try {
      // Auto-calculate pending_amount if fees change
      const record = records.find((r) => r.opportunity_id === oppId);
      if (record && ("fees_quoted" in updates || "fees_collected" in updates)) {
        const quoted = (updates.fees_quoted as number) ?? record.fees_quoted;
        const collected = (updates.fees_collected as number) ?? record.fees_collected;
        updates.pending_amount = Math.max(0, quoted - collected);
      }

      const res = await apiFetch("/api/sales/jobin-sales-tracking", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity_id: oppId, ...updates }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRecords((prev) =>
        prev.map((r) =>
          r.opportunity_id === oppId ? { ...r, ...updates } as SalesRecord : r
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  // Edit helpers
  function startEdit(oppId: string, field: string, currentValue: string) {
    setEditingCell({ oppId, field });
    setEditValue(currentValue || "");
  }
  function commitEdit() {
    if (editingCell) {
      const field = editingCell.field;
      const value = ["fees_quoted", "fees_collected"].includes(field)
        ? parseFloat(editValue) || 0
        : editValue;
      updateSalesRecord(editingCell.oppId, { [field]: value });
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
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-bold text-foreground tracking-tight">Sales Management</h1>
        <SalesManagementSkeleton />
      </div>
    );
  }

  const COLUMNS = [
    { key: "sno", label: "#", width: "w-10" },
    { key: "contact_name", label: "Contact Name", width: "w-40" },
    { key: "contact_email", label: "Email", width: "w-44" },
    { key: "contact_phone", label: "Phone", width: "w-32" },
    { key: "source", label: "Source", width: "w-28" },
    { key: "closed_date", label: "Closed Date", width: "w-36" },
    { key: "fees_quoted", label: "Fees Quoted", width: "w-32" },
    { key: "fees_collected", label: "Collected", width: "w-32" },
    { key: "pending_amount", label: "Pending", width: "w-28" },
    { key: "payment_mode", label: "Payment Mode", width: "w-32" },
    { key: "invoice_number", label: "Invoice #", width: "w-32" },
    { key: "collection_status", label: "Collection", width: "w-32" },
    { key: "onboarding_status", label: "Onboarding", width: "w-32" },
    { key: "sales_notes", label: "Notes", width: "w-48" },
    { key: "actions", label: "Actions", width: "w-24" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex-shrink-0 border-b border-border/50/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-accent rounded-full" />
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Sales Management</h1>
              <p className="text-muted text-xs mt-0.5">
                Won deals from Meet Management — {jobinRecords.length} deals
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
        <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Total Quoted" value={`₹${stats.totalQuoted.toLocaleString()}`} color="text-blue-400" bg="bg-blue-500/10" />
        <StatCard icon={<DollarSign className="w-4 h-4" />} label="Collected" value={`₹${stats.totalCollected.toLocaleString()}`} color="text-green-400" bg="bg-green-500/10" />
        <StatCard icon={<Clock className="w-4 h-4" />} label="Pending" value={`₹${stats.totalPending.toLocaleString()}`} color="text-amber-400" bg="bg-amber-500/10" />
        <StatCard icon={<CheckCircle className="w-4 h-4" />} label="Fully Paid" value={`${stats.fullyPaid}/${stats.total}`} color="text-emerald-400" bg="bg-emerald-500/10" />
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 flex items-center gap-3 flex-shrink-0 border-b border-border/50 bg-surface/50">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input type="text" placeholder="Search by name, email, phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent placeholder:text-muted/50" />
        </div>
        <span className="text-xs text-muted ml-auto">Showing {filteredRecords.length} of {jobinRecords.length}</span>
      </div>

      {/* Collection Status Pills */}
      <div className="px-6 py-2 flex gap-2 flex-wrap flex-shrink-0 border-b border-border/50">
        <button onClick={() => setCollectionFilter("all")}
          className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-colors ${collectionFilter === "all" ? "bg-accent/10 border-accent/20 text-accent" : "border-border text-muted hover:border-border/80"}`}>
          All <span>{jobinRecords.length}</span>
        </button>
        {COLLECTION_STATUSES.map((cs) => {
          const count = jobinRecords.filter((r) => r.collection_status === cs.value).length;
          return (
            <button key={cs.value} onClick={() => setCollectionFilter(collectionFilter === cs.value ? "all" : cs.value)}
              className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-colors ${collectionFilter === cs.value ? cs.bg + " " + cs.color : "border-border text-muted hover:border-border/80"}`}>
              {cs.label}
              <span>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse min-w-[1600px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface border-b border-border/50">
              {COLUMNS.map((col) => (
                <th key={col.key} className={`${col.width} text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5 border-r border-border last:border-r-0`}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="text-center py-16 text-muted text-sm">
                  {jobinRecords.length === 0
                    ? "No won deals yet. Mark leads as 'Won' in Meet Management to see them here."
                    : "No records match your filters."}
                </td>
              </tr>
            ) : filteredRecords.map((record, idx) => (
              <tr key={record.opportunity_id} className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors">
                <td className="px-3 py-2 text-xs text-muted border-r border-border">{idx + 1}</td>
                <td className="px-3 py-2 text-xs text-foreground font-medium border-r border-border">{record.contact_name || "-"}</td>
                <td className="px-3 py-2 text-xs text-foreground border-r border-border">
                  {record.contact_email ? <a href={`mailto:${record.contact_email}`} className="hover:text-accent transition-colors">{record.contact_email}</a> : <span className="text-muted">-</span>}
                </td>
                <td className="px-3 py-2 text-xs text-foreground border-r border-border">
                  {record.contact_phone ? <a href={`tel:${record.contact_phone}`} className="hover:text-accent transition-colors">{record.contact_phone}</a> : <span className="text-muted">-</span>}
                </td>
                <td className="px-3 py-2 text-xs text-foreground border-r border-border">{record.source || "-"}</td>

                {/* Closed Date (editable) */}
                <td className="px-3 py-2 text-xs border-r border-border">
                  <input
                    type="date"
                    value={record.closed_date ? new Date(record.closed_date).toISOString().slice(0, 10) : ""}
                    onChange={(e) => updateSalesRecord(record.opportunity_id, { closed_date: e.target.value || null })}
                    className="bg-transparent border-none text-xs text-foreground focus:outline-none cursor-pointer [color-scheme:dark] w-full"
                  />
                </td>

                {/* Fees Quoted (editable) */}
                <td className="px-3 py-2 text-xs border-r border-border cursor-pointer" onClick={() => startEdit(record.opportunity_id, "fees_quoted", String(record.fees_quoted || ""))}>
                  {editingCell?.oppId === record.opportunity_id && editingCell?.field === "fees_quoted" ? (
                    <input autoFocus type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit}
                      onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                      className="w-full bg-background border border-accent rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none" />
                  ) : (
                    <span className={record.fees_quoted ? "text-foreground" : "text-muted/40 italic"}>
                      {record.fees_quoted ? `₹${Number(record.fees_quoted).toLocaleString()}` : "Click to add..."}
                    </span>
                  )}
                </td>

                {/* Fees Collected (editable) */}
                <td className="px-3 py-2 text-xs border-r border-border cursor-pointer" onClick={() => startEdit(record.opportunity_id, "fees_collected", String(record.fees_collected || ""))}>
                  {editingCell?.oppId === record.opportunity_id && editingCell?.field === "fees_collected" ? (
                    <input autoFocus type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit}
                      onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                      className="w-full bg-background border border-accent rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none" />
                  ) : (
                    <span className={record.fees_collected ? "text-green-400" : "text-muted/40 italic"}>
                      {record.fees_collected ? `₹${Number(record.fees_collected).toLocaleString()}` : "Click to add..."}
                    </span>
                  )}
                </td>

                {/* Pending Amount (auto-calculated, read-only) */}
                <td className="px-3 py-2 text-xs border-r border-border">
                  <span className={record.pending_amount > 0 ? "text-amber-400 font-medium" : "text-muted"}>
                    {record.pending_amount > 0 ? `₹${Number(record.pending_amount).toLocaleString()}` : "₹0"}
                  </span>
                </td>

                {/* Payment Mode (dropdown) */}
                <td className="px-2 py-1.5 border-r border-border">
                  <select
                    value={record.payment_mode || ""}
                    onChange={(e) => updateSalesRecord(record.opportunity_id, { payment_mode: e.target.value || null })}
                    className="w-full bg-transparent text-xs text-foreground border-none focus:outline-none cursor-pointer [&>option]:bg-surface"
                  >
                    <option value="">Select...</option>
                    {PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </td>

                {/* Invoice Number (editable) */}
                <td className="px-3 py-2 text-xs border-r border-border cursor-pointer" onClick={() => startEdit(record.opportunity_id, "invoice_number", record.invoice_number || "")}>
                  {editingCell?.oppId === record.opportunity_id && editingCell?.field === "invoice_number" ? (
                    <input autoFocus type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit}
                      onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                      className="w-full bg-background border border-accent rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none" />
                  ) : (
                    <span className={record.invoice_number ? "text-foreground" : "text-muted/40 italic"}>{record.invoice_number || "Click to add..."}</span>
                  )}
                </td>

                {/* Collection Status (dropdown) */}
                <td className="px-2 py-1.5 border-r border-border">
                  <CollectionStatusDropdown
                    current={record.collection_status}
                    onChange={(s) => updateSalesRecord(record.opportunity_id, { collection_status: s })}
                  />
                </td>

                {/* Onboarding Status (dropdown) */}
                <td className="px-2 py-1.5 border-r border-border">
                  <select
                    value={record.onboarding_status || "not_started"}
                    onChange={(e) => updateSalesRecord(record.opportunity_id, { onboarding_status: e.target.value })}
                    className="w-full bg-transparent text-xs text-foreground border-none focus:outline-none cursor-pointer [&>option]:bg-surface"
                  >
                    {ONBOARDING_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </td>

                {/* Notes (editable) */}
                <td className="px-3 py-2 text-xs border-r border-border cursor-pointer" onClick={() => startEdit(record.opportunity_id, "notes", record.sales_notes || "")}>
                  {editingCell?.oppId === record.opportunity_id && editingCell?.field === "notes" ? (
                    <input autoFocus type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit}
                      onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                      className="w-full bg-background border border-accent rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none" />
                  ) : (
                    <span className={record.sales_notes ? "text-foreground" : "text-muted/40 italic"}>{record.sales_notes || "Click to add..."}</span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {record.contact_phone && <a href={`tel:${record.contact_phone}`} className="p-1 rounded hover:bg-green-500/10 text-muted hover:text-green-400 transition-colors" title="Call"><Phone className="w-3.5 h-3.5" /></a>}
                    {record.contact_email && <a href={`mailto:${record.contact_email}`} className="p-1 rounded hover:bg-blue-500/10 text-muted hover:text-blue-400 transition-colors" title="Email"><Mail className="w-3.5 h-3.5" /></a>}
                    {record.contact_phone && <a href={`https://wa.me/${record.contact_phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-green-500/10 text-muted hover:text-green-400 transition-colors" title="WhatsApp"><MessageSquare className="w-3.5 h-3.5" /></a>}
                    <button
                      onClick={() => setPaymentLinkRecord(record)}
                      className={`p-1 rounded hover:bg-indigo-500/10 transition-colors ${record.payment_link_url ? "text-indigo-400" : "text-muted hover:text-indigo-400"}`}
                      title={record.payment_link_url ? "Resend Payment Link" : "Send Payment Link"}
                    >
                      <IndianRupee className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payment Link Modal */}
      {paymentLinkRecord && (
        <PaymentLinkModal
          open={!!paymentLinkRecord}
          onClose={() => setPaymentLinkRecord(null)}
          customerName={paymentLinkRecord.contact_name}
          customerEmail={paymentLinkRecord.contact_email}
          customerPhone={paymentLinkRecord.contact_phone}
          amount={paymentLinkRecord.pending_amount > 0 ? paymentLinkRecord.pending_amount : paymentLinkRecord.fees_quoted}
          opportunityId={paymentLinkRecord.opportunity_id}
          onSuccess={(data) => {
            updateSalesRecord(paymentLinkRecord.opportunity_id, {
              payment_link_id: data.id,
              payment_link_url: data.short_url,
              payment_link_sent_at: new Date().toISOString(),
            });
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

/* ── Collection Status Dropdown ─────────────────────── */

function CollectionStatusDropdown({ current, onChange }: { current: string; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const cfg = COLLECTION_STATUSES.find((c) => c.value === current) || COLLECTION_STATUSES[0];

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className={`w-full flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md border ${cfg.bg} ${cfg.color} transition-colors`}>
        <cfg.icon className="w-3 h-3" />
        {cfg.label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-36 bg-surface border border-border rounded-lg shadow-xl z-30 py-1">
            {COLLECTION_STATUSES.map((s) => (
              <button key={s.value} onClick={() => { onChange(s.value); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${current === s.value ? "bg-accent/5 font-medium" : "hover:bg-surface-hover"} ${s.color}`}>
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
