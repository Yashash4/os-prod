"use client";

import { useEffect, useState, useCallback } from "react";
import { Wallet, Plus, Loader2, X } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import PermissionGate from "@/components/PermissionGate";

/* ── Types ─────────────────────────────────────────── */

interface Budget {
  id: string;
  name: string;
  department: string | null;
  month: string;
  planned_amount: number;
}

interface CategorySpend {
  name: string;
  amount: number;
}

const INR = (n: number) => "₹" + n.toLocaleString("en-IN");

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* ── Component ─────────────────────────────────────── */

export default function BudgetsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [actualSpend, setActualSpend] = useState(0);
  const [catSpend, setCatSpend] = useState<CategorySpend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", department: "", planned_amount: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const y = parseInt(month.split("-")[0]);
      const m = parseInt(month.split("-")[1]);
      const lastDay = new Date(y, m, 0).getDate();
      const from = `${month}-01`;
      const to = `${month}-${String(lastDay).padStart(2, "0")}`;

      const [budRes, sumRes] = await Promise.all([
        apiFetch(`/api/finance/budgets?month=${month}`),
        apiFetch(`/api/finance/summary?from=${from}&to=${to}`),
      ]);
      const budData = await budRes.json();
      const sumData = await sumRes.json();
      if (budData.error) throw new Error(budData.error);
      setBudgets(budData.budgets || []);
      setActualSpend(sumData.total_expenses || 0);
      setCatSpend(sumData.by_category || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!form.name || !form.planned_amount) return;
    try {
      const res = await apiFetch("/api/finance/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          department: form.department || null,
          month,
          planned_amount: parseFloat(form.planned_amount),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setBudgets((prev) => [data.budget, ...prev]);
      setForm({ name: "", department: "", planned_amount: "" });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  const totalPlanned = budgets.reduce((s, b) => s + (b.planned_amount || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20 flex items-center justify-between">
          {error}
          <button onClick={() => setError("")}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="w-5 h-5 text-accent" />
          <h1 className="text-lg font-bold">Budget Tracking</h1>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent [color-scheme:dark]"
          />
          <PermissionGate module="finance" subModule="finance-budgets" action="canCreate">
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 bg-accent text-white px-3 py-1.5 rounded-lg text-sm hover:bg-accent/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Budget
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Budget name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
            />
            <input
              type="text"
              placeholder="Department"
              value={form.department}
              onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
            />
            <input
              type="number"
              placeholder="Planned amount *"
              value={form.planned_amount}
              onChange={(e) => setForm((f) => ({ ...f, planned_amount: e.target.value }))}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex gap-2">
            <PermissionGate module="finance" subModule="finance-budgets" action="canCreate">
              <button
                onClick={handleCreate}
                className="bg-accent text-white px-4 py-2 rounded-lg text-sm hover:bg-accent/90 transition-colors"
              >
                Create Budget
              </button>
            </PermissionGate>
            <button
              onClick={() => setShowForm(false)}
              className="border border-border text-muted px-4 py-2 rounded-lg text-sm hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Overview */}
      {totalPlanned > 0 && (
        <div className="border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted">
              Overall: {INR(actualSpend)} of {INR(totalPlanned)} spent
            </span>
            <span className="text-sm font-semibold">
              {Math.round((actualSpend / totalPlanned) * 100)}%
            </span>
          </div>
          <div className="w-full bg-border rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                actualSpend / totalPlanned > 0.8
                  ? "bg-red-500"
                  : actualSpend / totalPlanned > 0.6
                  ? "bg-amber-500"
                  : "bg-green-500"
              }`}
              style={{ width: `${Math.min((actualSpend / totalPlanned) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Budget Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {budgets.map((b) => {
          // Find actual spend for this budget (approximate: proportional to total planned)
          const budgetActual = totalPlanned > 0
            ? (b.planned_amount / totalPlanned) * actualSpend
            : 0;
          const pct = b.planned_amount > 0 ? Math.round((budgetActual / b.planned_amount) * 100) : 0;
          const colorClass =
            pct > 80 ? "text-red-400" : pct > 60 ? "text-amber-400" : "text-green-400";
          const barColor =
            pct > 80 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-green-500";

          return (
            <div key={b.id} className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">{b.name}</h3>
                  {b.department && (
                    <p className="text-xs text-muted">{b.department}</p>
                  )}
                </div>
                <span className={`text-lg font-bold ${colorClass}`}>{pct}%</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Spent: {INR(Math.round(budgetActual))}</span>
                <span>Planned: {INR(b.planned_amount)}</span>
              </div>
              <div className="w-full bg-border rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {budgets.length === 0 && !loading && (
        <div className="text-center py-16 text-muted text-sm">
          No budgets set for {new Date(month + "-01").toLocaleString("en-IN", { month: "long", year: "numeric" })}
        </div>
      )}

      {/* Category Spend Breakdown */}
      {catSpend.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Spending by Category</h3>
          </div>
          <div className="divide-y divide-border/50">
            {catSpend.map((c) => (
              <div key={c.name} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm">{c.name}</span>
                <span className="text-sm font-medium">{INR(c.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
