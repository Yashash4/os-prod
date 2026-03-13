"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  UserCheck,
  Flame,
  CheckCircle2,
  IndianRupee,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import PermissionGate from "@/components/PermissionGate";

/* ── Types ─────────────────────────────────────────── */

interface Campaign {
  id: string;
  name: string;
}

interface Lead {
  id: string;
  campaign_id: string;
  campaign_name: string;
  lead_name: string;
  phone: string;
  quality: "hot" | "warm" | "cold" | "junk";
  status: "new" | "contacted" | "qualified" | "converted" | "lost";
  revenue_amount: number;
  notes: string;
  date: string;
}

/* ── Helpers ───────────────────────────────────────── */

function currency(val: number) {
  return `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const QUALITY_COLORS: Record<string, string> = {
  hot: "bg-red-500/15 text-red-400 border-red-500/30",
  warm: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  cold: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  junk: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  contacted: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  qualified: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  converted: "bg-green-500/15 text-green-400 border-green-500/30",
  lost: "bg-red-500/15 text-red-400 border-red-500/30",
};

const QUALITY_OPTIONS = ["hot", "warm", "cold", "junk"] as const;
const STATUS_OPTIONS = ["new", "contacted", "qualified", "converted", "lost"] as const;

/* ── Main Component ────────────────────────────────── */

export default function ConversionLogPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [date, setDate] = useState(todayStr);
  const [qualityFilter, setQualityFilter] = useState<string>("all");
  const [saving, setSaving] = useState(false);

  // Add form state
  const [formCampaignId, setFormCampaignId] = useState("");
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formQuality, setFormQuality] = useState<Lead["quality"]>("warm");
  const [formStatus, setFormStatus] = useState<Lead["status"]>("new");
  const [formRevenue, setFormRevenue] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Inline edit state
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [editingRevenue, setEditingRevenue] = useState<string | null>(null);
  const [revenueValue, setRevenueValue] = useState("");

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [leadsRes, bulkRes] = await Promise.all([
        apiFetch(`/api/meta/conversion-log?date=${date}`),
        apiFetch("/api/meta/campaign-insights-bulk?date_preset=last_30d"),
      ]);
      const leadsData = await leadsRes.json();
      const bulkData = await bulkRes.json();

      if (leadsData.error) throw new Error(leadsData.error);

      setLeads(leadsData.leads || []);

      const campList: Campaign[] = (bulkData.insights || [])
        .filter((r: { campaign_id?: string }) => r.campaign_id)
        .map((r: { campaign_id?: string; campaign_name?: string }) => ({
          id: r.campaign_id!,
          name: r.campaign_name || r.campaign_id!,
        }));
      setCampaigns(campList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  async function handleAdd() {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const camp = campaigns.find((c) => c.id === formCampaignId);
      const res = await apiFetch("/api/meta/conversion-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: formCampaignId,
          campaign_name: camp?.name || formCampaignId || "Unknown",
          lead_name: formName,
          phone: formPhone,
          quality: formQuality,
          status: formStatus,
          revenue_amount: parseFloat(formRevenue) || 0,
          notes: formNotes,
          date,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      // Reset form
      setFormCampaignId("");
      setFormName("");
      setFormPhone("");
      setFormQuality("warm");
      setFormStatus("new");
      setFormRevenue("");
      setFormNotes("");
      fetchLeads();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add lead");
    } finally {
      setSaving(false);
    }
  }

  async function handleFieldUpdate(id: string, field: string, value: string | number) {
    try {
      await apiFetch("/api/meta/conversion-log", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, [field]: value }),
      });
      setLeads((prev) =>
        prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
      );
    } catch {
      // silent
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/meta/conversion-log?id=${id}`, { method: "DELETE" });
      setLeads((prev) => prev.filter((l) => l.id !== id));
    } catch {
      // silent
    }
  }

  /* ── Stats ────────────────────────────────────────── */

  const stats = useMemo(() => {
    const total = leads.length;
    const hotWarm = leads.filter((l) => l.quality === "hot" || l.quality === "warm").length;
    const converted = leads.filter((l) => l.status === "converted").length;
    const revenue = leads
      .filter((l) => l.status === "converted")
      .reduce((s, l) => s + (l.revenue_amount || 0), 0);
    return { total, hotWarm, converted, revenue };
  }, [leads]);

  const filtered = useMemo(() => {
    if (qualityFilter === "all") return leads;
    return leads.filter((l) => l.quality === qualityFilter);
  }, [leads, qualityFilter]);

  /* ── Render ───────────────────────────────────────── */

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-accent mr-2" />
        <span className="text-sm text-muted">Loading conversion log...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Conversion Log</h1>
            <p className="text-muted text-xs mt-0.5">Manual lead quality tracking</p>
          </div>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
        />
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">{error}</div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted text-xs mb-1">
            <UserCheck className="w-3.5 h-3.5" />
            Total Leads
          </div>
          <p className="text-lg font-bold text-foreground">{stats.total}</p>
        </div>
        <div className="card rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted text-xs mb-1">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            Hot / Warm
          </div>
          <p className="text-lg font-bold text-foreground">{stats.hotWarm}</p>
        </div>
        <div className="card rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted text-xs mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            Converted
          </div>
          <p className="text-lg font-bold text-foreground">{stats.converted}</p>
        </div>
        <div className="card rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted text-xs mb-1">
            <IndianRupee className="w-3.5 h-3.5 text-accent" />
            Revenue
          </div>
          <p className="text-lg font-bold text-accent">{currency(stats.revenue)}</p>
        </div>
      </div>

      {/* Quality Filter Pills */}
      <div className="flex items-center gap-1.5">
        {["all", ...QUALITY_OPTIONS].map((q) => {
          const count = q === "all" ? leads.length : leads.filter((l) => l.quality === q).length;
          return (
            <button
              key={q}
              onClick={() => setQualityFilter(q)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                qualityFilter === q
                  ? "bg-accent/15 text-accent border border-accent/30"
                  : "bg-surface border border-border text-muted hover:text-foreground"
              }`}
            >
              {q === "all" ? "All" : q.charAt(0).toUpperCase() + q.slice(1)} ({count})
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-surface/80">
                <th className="text-left py-3 px-4 text-xs text-muted font-medium">Campaign</th>
                <th className="text-left py-3 px-3 text-xs text-muted font-medium">Lead Name</th>
                <th className="text-left py-3 px-3 text-xs text-muted font-medium">Phone</th>
                <th className="text-center py-3 px-3 text-xs text-muted font-medium">Quality</th>
                <th className="text-center py-3 px-3 text-xs text-muted font-medium">Status</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Revenue (₹)</th>
                <th className="text-left py-3 px-3 text-xs text-muted font-medium">Notes</th>
                <th className="w-10 py-3 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {/* Add Lead Row */}
              <tr className="border-b border-border/50 bg-accent/[0.03]">
                <td className="py-2 px-4">
                  <select
                    value={formCampaignId}
                    onChange={(e) => setFormCampaignId(e.target.value)}
                    className="w-full px-2 py-1.5 bg-background/50 border border-border rounded text-foreground text-xs focus:outline-none focus:border-accent"
                  >
                    <option value="">Campaign...</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2 px-3">
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Lead name *"
                    className="w-full px-2 py-1.5 bg-background/50 border border-border rounded text-foreground text-xs focus:outline-none focus:border-accent"
                  />
                </td>
                <td className="py-2 px-3">
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="Phone"
                    className="w-full px-2 py-1.5 bg-background/50 border border-border rounded text-foreground text-xs focus:outline-none focus:border-accent"
                  />
                </td>
                <td className="py-2 px-3">
                  <select
                    value={formQuality}
                    onChange={(e) => setFormQuality(e.target.value as Lead["quality"])}
                    className="w-full px-2 py-1.5 bg-background/50 border border-border rounded text-foreground text-xs focus:outline-none focus:border-accent"
                  >
                    {QUALITY_OPTIONS.map((q) => (
                      <option key={q} value={q}>{q.charAt(0).toUpperCase() + q.slice(1)}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2 px-3">
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as Lead["status"])}
                    className="w-full px-2 py-1.5 bg-background/50 border border-border rounded text-foreground text-xs focus:outline-none focus:border-accent"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    value={formRevenue}
                    onChange={(e) => setFormRevenue(e.target.value)}
                    placeholder="0"
                    className="w-full px-2 py-1.5 bg-background/50 border border-border rounded text-foreground text-xs focus:outline-none focus:border-accent text-right"
                  />
                </td>
                <td className="py-2 px-3">
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Notes"
                    className="w-full px-2 py-1.5 bg-background/50 border border-border rounded text-foreground text-xs focus:outline-none focus:border-accent"
                  />
                </td>
                <td className="py-2 px-2">
                  <PermissionGate module="marketing" subModule="marketing-meta-conversion-log" action="canCreate">
                    <button
                      onClick={handleAdd}
                      disabled={saving || !formName.trim()}
                      className="p-1.5 bg-accent text-black rounded hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Add Lead"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>
                  </PermissionGate>
                </td>
              </tr>

              {/* Data Rows */}
              {filtered.map((lead) => (
                <tr key={lead.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                  <td className="py-3 px-4 text-foreground text-xs truncate max-w-[180px]">
                    {lead.campaign_name}
                  </td>
                  <td className="py-3 px-3 text-foreground font-medium text-xs">
                    {lead.lead_name}
                  </td>
                  <td className="py-3 px-3 text-muted text-xs">
                    {lead.phone || "-"}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <PermissionGate module="marketing" subModule="marketing-meta-conversion-log" action="canEdit" fallback={
                      <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${QUALITY_COLORS[lead.quality]}`}>{lead.quality}</span>
                    }>
                      <select
                        value={lead.quality}
                        onChange={(e) => handleFieldUpdate(lead.id, "quality", e.target.value)}
                        className={`px-2 py-0.5 rounded-full border text-[11px] font-medium appearance-none text-center cursor-pointer focus:outline-none ${QUALITY_COLORS[lead.quality]}`}
                      >
                        {QUALITY_OPTIONS.map((q) => (
                          <option key={q} value={q}>{q.charAt(0).toUpperCase() + q.slice(1)}</option>
                        ))}
                      </select>
                    </PermissionGate>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <PermissionGate module="marketing" subModule="marketing-meta-conversion-log" action="canEdit" fallback={
                      <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${STATUS_COLORS[lead.status]}`}>{lead.status}</span>
                    }>
                      <select
                        value={lead.status}
                        onChange={(e) => handleFieldUpdate(lead.id, "status", e.target.value)}
                        className={`px-2 py-0.5 rounded-full border text-[11px] font-medium appearance-none text-center cursor-pointer focus:outline-none ${STATUS_COLORS[lead.status]}`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                    </PermissionGate>
                  </td>
                  <td className="py-3 px-3 text-right">
                    {editingRevenue === lead.id ? (
                      <input
                        autoFocus
                        type="number"
                        value={revenueValue}
                        onChange={(e) => setRevenueValue(e.target.value)}
                        onBlur={() => {
                          handleFieldUpdate(lead.id, "revenue_amount", parseFloat(revenueValue) || 0);
                          setEditingRevenue(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleFieldUpdate(lead.id, "revenue_amount", parseFloat(revenueValue) || 0);
                            setEditingRevenue(null);
                          }
                          if (e.key === "Escape") setEditingRevenue(null);
                        }}
                        className="w-20 px-2 py-1 bg-background/50 border border-border rounded text-foreground text-xs focus:outline-none focus:border-accent text-right"
                      />
                    ) : (
                      <span
                        onClick={() => {
                          setEditingRevenue(lead.id);
                          setRevenueValue(String(lead.revenue_amount || 0));
                        }}
                        className="text-xs text-foreground cursor-pointer hover:text-accent transition-colors"
                      >
                        {lead.revenue_amount ? currency(lead.revenue_amount) : "-"}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 min-w-[130px]">
                    {editingNotes === lead.id ? (
                      <input
                        autoFocus
                        value={notesValue}
                        onChange={(e) => setNotesValue(e.target.value)}
                        onBlur={() => {
                          handleFieldUpdate(lead.id, "notes", notesValue);
                          setEditingNotes(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleFieldUpdate(lead.id, "notes", notesValue);
                            setEditingNotes(null);
                          }
                          if (e.key === "Escape") setEditingNotes(null);
                        }}
                        className="w-full px-2 py-1 bg-background/50 border border-border rounded text-foreground text-xs focus:outline-none focus:border-accent"
                      />
                    ) : (
                      <span
                        onClick={() => {
                          setEditingNotes(lead.id);
                          setNotesValue(lead.notes || "");
                        }}
                        className="text-xs text-muted cursor-pointer hover:text-foreground transition-colors block truncate"
                      >
                        {lead.notes || "Click to add..."}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    <PermissionGate module="marketing" subModule="marketing-meta-conversion-log" action="canDelete">
                      <button
                        onClick={() => handleDelete(lead.id)}
                        className="p-1 text-muted hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </PermissionGate>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted text-sm">
                    <UserCheck className="w-8 h-8 text-muted/30 mx-auto mb-2" />
                    No leads logged for this date. Add one above.
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
