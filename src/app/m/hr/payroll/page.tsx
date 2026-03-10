"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Wallet, Loader2, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

interface SalaryCycle {
  id: string;
  employee_id: string;
  cycle_month: string;
  base_amount: number;
  commission_amount: number;
  deductions: number;
  net_amount: number;
  status: string;
  paid_date: string | null;
  employee: { id: string; full_name: string; department?: { id: string; name: string } | null } | null;
}

function rupees(paise: number) {
  return "₹" + (paise / 100).toLocaleString("en-IN");
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-zinc-500/15 text-zinc-400",
  calculated: "bg-blue-500/15 text-blue-400",
  approved: "bg-amber-500/15 text-amber-400",
  paid: "bg-green-500/15 text-green-400",
};

export default function PayrollPage() {
  const [cycles, setCycles] = useState<SalaryCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/hr/salary-cycles?cycle_month=${month}`);
      const data = await res.json();
      setCycles(data.cycles || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await apiFetch("/api/hr/salary-cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", cycle_month: month }),
      });
      const data = await res.json();
      setCycles(data.cycles || []);
    } catch { /* ignore */ }
    setGenerating(false);
  }

  async function handleUpdateField(id: string, field: string, value: string | number) {
    setCycles((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      const updated = { ...c, [field]: value };
      if (field !== "status" && field !== "paid_date" && field !== "notes") {
        updated.net_amount = updated.base_amount + updated.commission_amount - updated.deductions;
      }
      return updated;
    }));
    await apiFetch("/api/hr/salary-cycles", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [field]: value }),
    });
  }

  const stats = useMemo(() => ({
    totalBase: cycles.reduce((s, c) => s + c.base_amount, 0),
    totalComm: cycles.reduce((s, c) => s + c.commission_amount, 0),
    totalDed: cycles.reduce((s, c) => s + c.deductions, 0),
    totalNet: cycles.reduce((s, c) => s + c.net_amount, 0),
    paid: cycles.filter((c) => c.status === "paid").length,
  }), [cycles]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold">Payroll Tracker</h1>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
        </div>
        <div className="flex items-center gap-3">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="bg-background/50 border border-border rounded-lg px-3 py-2 text-sm" />
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />
            Generate
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Base Total", value: rupees(stats.totalBase) },
          { label: "Commission", value: rupees(stats.totalComm) },
          { label: "Deductions", value: rupees(stats.totalDed) },
          { label: "Net Payroll", value: rupees(stats.totalNet) },
          { label: "Paid", value: `${stats.paid} / ${cycles.length}` },
        ].map((s) => (
          <div key={s.label} className="card border border-border rounded-xl p-4">
            <p className="text-xs text-muted">{s.label}</p>
            <p className="text-lg font-semibold mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface">
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium text-right">Base</th>
                <th className="px-4 py-3 font-medium text-right">Commission</th>
                <th className="px-4 py-3 font-medium text-right">Deductions</th>
                <th className="px-4 py-3 font-medium text-right">Net</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-surface-hover">
                  <td className="px-4 py-2 font-medium text-foreground">{c.employee?.full_name || "Unknown"}</td>
                  <td className="px-4 py-2 text-muted text-xs">{c.employee?.department?.name || "-"}</td>
                  <td className="px-4 py-2 text-right">{rupees(c.base_amount)}</td>
                  <td className="px-4 py-2 text-right">
                    <input type="number" value={(c.commission_amount / 100).toFixed(0)}
                      onChange={(e) => handleUpdateField(c.id, "commission_amount", Math.round(parseFloat(e.target.value || "0") * 100))}
                      className="bg-transparent border-0 text-right w-24 text-sm focus:bg-background/50 focus:border focus:border-border rounded px-1" />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input type="number" value={(c.deductions / 100).toFixed(0)}
                      onChange={(e) => handleUpdateField(c.id, "deductions", Math.round(parseFloat(e.target.value || "0") * 100))}
                      className="bg-transparent border-0 text-right w-24 text-sm focus:bg-background/50 focus:border focus:border-border rounded px-1" />
                  </td>
                  <td className="px-4 py-2 text-right font-medium">{rupees(c.net_amount)}</td>
                  <td className="px-4 py-2">
                    <select value={c.status}
                      onChange={(e) => handleUpdateField(c.id, "status", e.target.value)}
                      className={`text-xs px-2 py-1 rounded-full border-0 capitalize ${STATUS_COLORS[c.status] || ""}`}>
                      <option value="pending">Pending</option>
                      <option value="calculated">Calculated</option>
                      <option value="approved">Approved</option>
                      <option value="paid">Paid</option>
                    </select>
                  </td>
                </tr>
              ))}
              {cycles.length === 0 && !loading && (
                <tr><td colSpan={7} className="py-12 text-center text-muted">
                  No payroll data for {month}. Click &quot;Generate&quot; to create entries.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
