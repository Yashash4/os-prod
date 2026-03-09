"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  Wallet,
  TrendingUp,
  TrendingDown,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

/* ── Types ─────────────────────────────────────────── */

interface Campaign {
  id: string;
  name: string;
  status: string;
}

interface InsightRow {
  campaign_id?: string;
  spend?: string;
}

interface BudgetPlan {
  id: string;
  campaign_id: string;
  campaign_name: string;
  period_start: string;
  period_end: string;
  planned_budget: number;
  actual_spend: number;
  notes: string;
}

/* ── Helpers ───────────────────────────────────────── */

function currency(val: number) {
  return `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function varianceColor(pct: number) {
  if (pct <= 100) return "text-green-400";
  if (pct <= 120) return "text-amber-400";
  return "text-red-400";
}

function statusLabel(planned: number, actual: number) {
  if (planned === 0) return { text: "No Budget", cls: "bg-gray-500/15 text-gray-400 border-gray-500/30" };
  const pct = (actual / planned) * 100;
  if (pct <= 90) return { text: "Under Budget", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" };
  if (pct <= 100) return { text: "On Track", cls: "bg-green-500/15 text-green-400 border-green-500/30" };
  return { text: "Over Budget", cls: "bg-red-500/15 text-red-400 border-red-500/30" };
}

/* ── Main Component ────────────────────────────────── */

export default function BudgetPlannerPage() {
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formCampaignId, setFormCampaignId] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formBudget, setFormBudget] = useState("");

  // Inline edit state
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    setError("");
    try {
      const [plansRes, bulkRes] = await Promise.all([
        apiFetch("/api/meta/budget-plans"),
        apiFetch("/api/meta/campaign-insights-bulk?date_preset=this_month"),
      ]);
      const plansData = await plansRes.json();
      const bulkData = await bulkRes.json();

      if (plansData.error) throw new Error(plansData.error);

      // Build spend lookup by campaign_id
      const spendMap: Record<string, number> = {};
      (bulkData.insights || []).forEach((row: InsightRow) => {
        if (row.campaign_id) {
          spendMap[row.campaign_id] = parseFloat(row.spend || "0");
        }
      });

      // Build campaigns list from insights
      const campList: Campaign[] = (bulkData.insights || [])
        .filter((r: InsightRow) => r.campaign_id)
        .map((r: InsightRow & { campaign_name?: string }) => ({
          id: r.campaign_id!,
          name: r.campaign_name || r.campaign_id!,
          status: "ACTIVE",
        }));
      setCampaigns(campList);

      // Merge actual spend into plans
      const mergedPlans = (plansData.plans || []).map((p: BudgetPlan) => ({
        ...p,
        actual_spend: spendMap[p.campaign_id] ?? p.actual_spend ?? 0,
      }));
      setPlans(mergedPlans);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!formCampaignId || !formStart || !formEnd || !formBudget) return;
    setSaving(true);
    try {
      const camp = campaigns.find((c) => c.id === formCampaignId);
      const res = await apiFetch("/api/meta/budget-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: formCampaignId,
          campaign_name: camp?.name || formCampaignId,
          period_start: formStart,
          period_end: formEnd,
          planned_budget: parseFloat(formBudget),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setShowForm(false);
      setFormCampaignId("");
      setFormStart("");
      setFormEnd("");
      setFormBudget("");
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleNotesUpdate(id: string) {
    try {
      await apiFetch("/api/meta/budget-plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, notes: notesValue }),
      });
      setPlans((prev) =>
        prev.map((p) => (p.id === id ? { ...p, notes: notesValue } : p))
      );
    } catch {
      // silent fail — revert will happen on next fetch
    }
    setEditingNotes(null);
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/meta/budget-plans?id=${id}`, { method: "DELETE" });
      setPlans((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // silent
    }
  }

  /* ── Stats ────────────────────────────────────────── */

  const stats = useMemo(() => {
    const totalPlanned = plans.reduce((s, p) => s + p.planned_budget, 0);
    const totalSpent = plans.reduce((s, p) => s + p.actual_spend, 0);
    const variance = totalPlanned - totalSpent;
    return { totalPlanned, totalSpent, variance };
  }, [plans]);

  /* ── Render ───────────────────────────────────────── */

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-accent mr-2" />
        <span className="text-sm text-muted">Loading budget plans...</span>
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
            <h1 className="text-xl font-bold text-foreground tracking-tight">Budget Planner</h1>
            <p className="text-muted text-xs mt-0.5">Planned vs actual budget tracking</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-2 bg-accent/15 text-accent border border-accent/30 rounded-lg text-sm font-medium hover:bg-accent/25 transition-colors"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancel" : "Add Budget Plan"}
        </button>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">{error}</div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted text-xs mb-1">
            <Wallet className="w-3.5 h-3.5" />
            Total Planned
          </div>
          <p className="text-lg font-bold text-foreground">{currency(stats.totalPlanned)}</p>
        </div>
        <div className="card rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted text-xs mb-1">
            <TrendingUp className="w-3.5 h-3.5" />
            Total Spent
          </div>
          <p className="text-lg font-bold text-foreground">{currency(stats.totalSpent)}</p>
        </div>
        <div className="card rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted text-xs mb-1">
            {stats.variance >= 0 ? (
              <TrendingDown className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <TrendingUp className="w-3.5 h-3.5 text-red-400" />
            )}
            Variance
          </div>
          <p className={`text-lg font-bold ${stats.variance >= 0 ? "text-green-400" : "text-red-400"}`}>
            {stats.variance >= 0 ? "+" : ""}{currency(stats.variance)}
          </p>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="card rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">New Budget Plan</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="text-xs text-muted mb-1 block">Campaign</label>
              <select
                value={formCampaignId}
                onChange={(e) => setFormCampaignId(e.target.value)}
                className="w-full px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
              >
                <option value="">Select campaign</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Period Start</label>
              <input
                type="date"
                value={formStart}
                onChange={(e) => setFormStart(e.target.value)}
                className="w-full px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Period End</label>
              <input
                type="date"
                value={formEnd}
                onChange={(e) => setFormEnd(e.target.value)}
                className="w-full px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Planned Budget (₹)</label>
              <input
                type="number"
                value={formBudget}
                onChange={(e) => setFormBudget(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={saving || !formCampaignId || !formStart || !formEnd || !formBudget}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent text-black rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-surface/80">
                <th className="text-left py-3 px-4 text-xs text-muted font-medium">Campaign</th>
                <th className="text-left py-3 px-3 text-xs text-muted font-medium">Period</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Planned (₹)</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Actual (₹)</th>
                <th className="text-right py-3 px-3 text-xs text-muted font-medium">Variance</th>
                <th className="text-center py-3 px-3 text-xs text-muted font-medium">Status</th>
                <th className="text-left py-3 px-3 text-xs text-muted font-medium">Notes</th>
                <th className="w-10 py-3 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const varianceAmt = plan.planned_budget - plan.actual_spend;
                const variancePct = plan.planned_budget > 0 ? (plan.actual_spend / plan.planned_budget) * 100 : 0;
                const status = statusLabel(plan.planned_budget, plan.actual_spend);

                return (
                  <tr key={plan.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                    <td className="py-3 px-4 text-foreground font-medium truncate max-w-[200px]">
                      {plan.campaign_name}
                    </td>
                    <td className="py-3 px-3 text-xs text-muted">
                      {formatDate(plan.period_start)} — {formatDate(plan.period_end)}
                    </td>
                    <td className="py-3 px-3 text-right text-xs text-foreground">
                      {currency(plan.planned_budget)}
                    </td>
                    <td className="py-3 px-3 text-right text-xs text-foreground">
                      {currency(plan.actual_spend)}
                    </td>
                    <td className="py-3 px-3 text-right text-xs">
                      <span className={varianceColor(variancePct)}>
                        {varianceAmt >= 0 ? "+" : ""}{currency(varianceAmt)}
                        <span className="ml-1 text-[10px] opacity-70">({variancePct.toFixed(1)}%)</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${status.cls}`}>
                        {status.text}
                      </span>
                    </td>
                    <td className="py-3 px-3 min-w-[150px]">
                      {editingNotes === plan.id ? (
                        <input
                          autoFocus
                          value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          onBlur={() => handleNotesUpdate(plan.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleNotesUpdate(plan.id);
                            if (e.key === "Escape") setEditingNotes(null);
                          }}
                          className="w-full px-2 py-1 bg-background/50 border border-border rounded text-foreground text-xs focus:outline-none focus:border-accent"
                        />
                      ) : (
                        <span
                          onClick={() => {
                            setEditingNotes(plan.id);
                            setNotesValue(plan.notes || "");
                          }}
                          className="text-xs text-muted cursor-pointer hover:text-foreground transition-colors block truncate"
                        >
                          {plan.notes || "Click to add notes..."}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <button
                        onClick={() => handleDelete(plan.id)}
                        className="p-1 text-muted hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {plans.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted text-sm">
                    <Wallet className="w-8 h-8 text-muted/30 mx-auto mb-2" />
                    No budget plans yet. Click &quot;Add Budget Plan&quot; to get started.
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
