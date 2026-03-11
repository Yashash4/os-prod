"use client";

import { useEffect, useState, useMemo } from "react";
import { Landmark, TrendingDown, Wallet, Loader2, FolderOpen } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

/* ── Types ─────────────────────────────────────────── */

interface CategoryBreakdown {
  name: string;
  amount: number;
}

interface Summary {
  total_expenses: number;
  by_category: CategoryBreakdown[];
  period: { from: string; to: string };
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  paid_by: string | null;
  status: string;
  category: { name: string } | null;
}

interface Budget {
  id: string;
  name: string;
  planned_amount: number;
}

/* ── Date helpers ──────────────────────────────────── */

function getMonthRange(offset: number): { from: string; to: string; label: string } {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const lastDay = new Date(y, m, 0).getDate();
  const ms = String(m).padStart(2, "0");
  return {
    from: `${y}-${ms}-01`,
    to: `${y}-${ms}-${String(lastDay).padStart(2, "0")}`,
    label: d.toLocaleString("en-IN", { month: "long", year: "numeric" }),
  };
}

const DATE_RANGES = [
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "Last 3 Months", value: "last_3_months" },
];

function rangeForPreset(preset: string): { from: string; to: string } {
  if (preset === "last_month") {
    const r = getMonthRange(-1);
    return { from: r.from, to: r.to };
  }
  if (preset === "last_3_months") {
    const r3 = getMonthRange(-2);
    const r0 = getMonthRange(0);
    return { from: r3.from, to: r0.to };
  }
  // this_month
  const r = getMonthRange(0);
  return { from: r.from, to: r.to };
}

const INR = (n: number) => "₹" + n.toLocaleString("en-IN");

const PIE_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16",
];

/* ── Component ─────────────────────────────────────── */

export default function FinanceDashboard() {
  const [range, setRange] = useState("this_month");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { from, to } = rangeForPreset(range);
      try {
        const [sumRes, expRes, budRes] = await Promise.all([
          apiFetch(`/api/finance/summary?from=${from}&to=${to}`),
          apiFetch(`/api/finance/expenses?month=${from.slice(0, 7)}`),
          apiFetch(`/api/finance/budgets?month=${from.slice(0, 7)}`),
        ]);
        const sumData = await sumRes.json();
        const expData = await expRes.json();
        const budData = await budRes.json();
        setSummary(sumData.total_expenses !== undefined ? sumData : null);
        setExpenses((expData.records || []).slice(0, 10));
        setBudgets(budData.budgets || []);
      } catch {
        /* ignore */
      }
      setLoading(false);
    }
    load();
  }, [range]);

  const totalBudget = useMemo(
    () => budgets.reduce((s, b) => s + (b.planned_amount || 0), 0),
    [budgets]
  );

  const budgetPct = totalBudget > 0 && summary
    ? Math.round((summary.total_expenses / totalBudget) * 100)
    : 0;

  const topCategory = summary?.by_category?.[0]?.name || "N/A";

  // Build monthly trend data from recent expenses (group by month)
  const trendData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenses) {
      const m = e.date?.slice(0, 7) || "unknown";
      map[m] = (map[m] || 0) + e.amount;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({
        month: new Date(month + "-01").toLocaleString("en-IN", { month: "short" }),
        amount,
      }));
  }, [expenses]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Landmark className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold">Finance</h1>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
        </div>

        {/* Date range selector */}
        <div className="flex gap-2">
          {DATE_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                range === r.value
                  ? "bg-accent/10 border-accent/30 text-accent"
                  : "border-border text-muted hover:text-foreground hover:border-border/80"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <span className="text-xs text-muted">Total Expenses</span>
          </div>
          <p className="text-xl font-semibold">{INR(summary?.total_expenses || 0)}</p>
        </div>
        <div className="border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-muted">Budget Used</span>
          </div>
          <p className="text-xl font-semibold">
            {totalBudget > 0 ? `${budgetPct}%` : "No budget set"}
          </p>
          {totalBudget > 0 && (
            <div className="mt-2 w-full bg-border rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  budgetPct > 80 ? "bg-red-500" : budgetPct > 60 ? "bg-amber-500" : "bg-green-500"
                }`}
                style={{ width: `${Math.min(budgetPct, 100)}%` }}
              />
            </div>
          )}
        </div>
        <div className="border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <FolderOpen className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-muted">Top Category</span>
          </div>
          <p className="text-xl font-semibold">{topCategory}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bar Chart - Expense Trend */}
        <div className="border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-4">Expense Trend</h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={trendData}>
                <XAxis dataKey="month" tick={{ fill: "#888", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#888", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
                  labelStyle={{ color: "#ccc" }}
                  formatter={(value) => [INR(Number(value ?? 0)), "Amount"]}
                />
                <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted text-sm text-center py-12">No expense data</p>
          )}
        </div>

        {/* Pie Chart - Category Breakdown */}
        <div className="border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-4">By Category</h3>
          {summary && summary.by_category.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={250}>
                <PieChart>
                  <Pie
                    data={summary.by_category}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                  >
                    {summary.by_category.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
                    formatter={(value) => [INR(Number(value ?? 0)), "Amount"]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {summary.by_category.map((cat, i) => (
                  <div key={cat.name} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="text-muted flex-1 truncate">{cat.name}</span>
                    <span className="text-foreground">{INR(cat.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted text-sm text-center py-12">No category data</p>
          )}
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Recent Expenses</h3>
        </div>
        {expenses.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] text-muted uppercase border-b border-border/50 bg-surface">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">Paid By</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-muted">
                    {new Date(e.date).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-2.5 text-sm">{e.title}</td>
                  <td className="px-4 py-2.5 text-xs text-muted">{e.category?.name || "-"}</td>
                  <td className="px-4 py-2.5 text-sm text-right font-medium">{INR(e.amount)}</td>
                  <td className="px-4 py-2.5 text-xs text-muted">{e.paid_by || "-"}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full border ${
                        e.status === "approved"
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : e.status === "rejected"
                          ? "bg-red-500/10 text-red-400 border-red-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}
                    >
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted text-sm text-center py-8">No recent expenses</p>
        )}
      </div>
    </div>
  );
}
