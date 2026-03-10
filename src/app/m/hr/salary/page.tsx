"use client";

import { useEffect, useState, useCallback } from "react";
import { IndianRupee, Loader2, Plus, History } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

interface Employee { id: string; full_name: string; }
interface Salary {
  id: string;
  employee_id: string;
  base_salary: number;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
  created_at: string;
}

interface CommissionRule {
  id: string;
  rule_name: string;
  type: string;
  value: number | null;
  metric: string;
  is_active: boolean;
}

function rupees(paise: number) {
  return "₹" + (paise / 100).toLocaleString("en-IN");
}

export default function SalaryPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmp, setSelectedEmp] = useState("");
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [commRules, setCommRules] = useState<CommissionRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [showRevise, setShowRevise] = useState(false);
  const [newAmount, setNewAmount] = useState("");
  const [newFrom, setNewFrom] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [showAddComm, setShowAddComm] = useState(false);
  const [commName, setCommName] = useState("");
  const [commType, setCommType] = useState("percentage");
  const [commValue, setCommValue] = useState("");
  const [commMetric, setCommMetric] = useState("");

  useEffect(() => {
    apiFetch("/api/hr/employees").then((r) => r.json()).then((d) => {
      setEmployees((d.employees || []).map((e: Employee & Record<string, unknown>) => ({ id: e.id, full_name: e.full_name })));
    });
  }, []);

  const fetchSalary = useCallback(async (empId: string) => {
    if (!empId) { setSalaries([]); setCommRules([]); return; }
    setLoading(true);
    const [salRes, commRes] = await Promise.all([
      apiFetch(`/api/hr/salaries?employee_id=${empId}`),
      apiFetch(`/api/hr/commission-rules?employee_id=${empId}`),
    ]);
    const salData = await salRes.json();
    const commData = await commRes.json();
    setSalaries(salData.salaries || []);
    setCommRules(commData.rules || []);
    setLoading(false);
  }, []);

  useEffect(() => { if (selectedEmp) fetchSalary(selectedEmp); }, [selectedEmp, fetchSalary]);

  const current = salaries.find((s) => !s.effective_to);
  const history = salaries.filter((s) => s.effective_to);

  async function handleRevise() {
    if (!newAmount || !newFrom) return;
    await apiFetch("/api/hr/salaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee_id: selectedEmp,
        base_salary: Math.round(parseFloat(newAmount) * 100),
        effective_from: newFrom,
        notes: newNotes || null,
      }),
    });
    setNewAmount(""); setNewFrom(""); setNewNotes(""); setShowRevise(false);
    fetchSalary(selectedEmp);
  }

  async function handleAddComm() {
    if (!commName || !commMetric) return;
    await apiFetch("/api/hr/commission-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee_id: selectedEmp,
        rule_name: commName,
        type: commType,
        value: commValue ? parseFloat(commValue) : null,
        metric: commMetric,
      }),
    });
    setCommName(""); setCommType("percentage"); setCommValue(""); setCommMetric(""); setShowAddComm(false);
    fetchSalary(selectedEmp);
  }

  async function handleDeleteComm(id: string) {
    await apiFetch(`/api/hr/commission-rules?id=${id}`, { method: "DELETE" });
    fetchSalary(selectedEmp);
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <IndianRupee className="w-6 h-6 text-accent" />
        <h1 className="text-2xl font-bold">Salary Management</h1>
        {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
      </div>

      {/* Employee Selector */}
      <select value={selectedEmp} onChange={(e) => setSelectedEmp(e.target.value)}
        className="bg-background/50 border border-border rounded-lg px-4 py-2.5 text-sm w-80">
        <option value="">Select Employee</option>
        {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
      </select>

      {selectedEmp && (
        <>
          {/* Current Salary */}
          <div className="card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-muted uppercase tracking-wider">Current Salary</h2>
              <button onClick={() => setShowRevise(!showRevise)}
                className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent/90 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Revise
              </button>
            </div>
            {current ? (
              <div>
                <p className="text-3xl font-bold text-foreground">{rupees(current.base_salary)}<span className="text-sm text-muted font-normal"> /month</span></p>
                <p className="text-xs text-muted mt-1">Effective from {current.effective_from}</p>
                {current.notes && <p className="text-xs text-muted mt-1">Notes: {current.notes}</p>}
              </div>
            ) : (
              <p className="text-muted text-sm">No salary record set</p>
            )}
          </div>

          {/* Revise Form */}
          {showRevise && (
            <div className="card border border-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-medium">Revise Salary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted mb-1 block">Amount (₹)</label>
                  <input type="number" placeholder="Monthly salary in ₹" value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="bg-background/50 border border-border rounded-lg px-3 py-2 text-sm w-full" />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Effective From</label>
                  <input type="date" value={newFrom} onChange={(e) => setNewFrom(e.target.value)}
                    className="bg-background/50 border border-border rounded-lg px-3 py-2 text-sm w-full" />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Notes</label>
                  <input type="text" placeholder="Reason for revision" value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    className="bg-background/50 border border-border rounded-lg px-3 py-2 text-sm w-full" />
                </div>
              </div>
              <button onClick={handleRevise}
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">
                Save Revision
              </button>
            </div>
          )}

          {/* Salary History */}
          {history.length > 0 && (
            <div className="card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-muted" />
                <h3 className="text-sm font-medium text-muted uppercase tracking-wider">History</h3>
              </div>
              <div className="space-y-2">
                {history.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div>
                      <span className="font-medium text-foreground">{rupees(s.base_salary)}</span>
                      <span className="text-xs text-muted ml-2">{s.effective_from} → {s.effective_to}</span>
                    </div>
                    {s.notes && <span className="text-xs text-muted">{s.notes}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Commission Rules */}
          <div className="card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-muted uppercase tracking-wider">Commission Rules</h3>
              <button onClick={() => setShowAddComm(!showAddComm)}
                className="text-xs text-accent hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Rule
              </button>
            </div>

            {showAddComm && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 p-3 bg-surface rounded-lg">
                <input type="text" placeholder="Rule Name" value={commName}
                  onChange={(e) => setCommName(e.target.value)}
                  className="bg-background/50 border border-border rounded px-2 py-1.5 text-xs" />
                <select value={commType} onChange={(e) => setCommType(e.target.value)}
                  className="bg-background/50 border border-border rounded px-2 py-1.5 text-xs">
                  <option value="percentage">Percentage</option>
                  <option value="flat_per_unit">Flat per Unit</option>
                </select>
                <input type="number" placeholder="Value (% or ₹)" value={commValue}
                  onChange={(e) => setCommValue(e.target.value)}
                  className="bg-background/50 border border-border rounded px-2 py-1.5 text-xs" />
                <input type="text" placeholder="Metric (e.g. revenue)" value={commMetric}
                  onChange={(e) => setCommMetric(e.target.value)}
                  className="bg-background/50 border border-border rounded px-2 py-1.5 text-xs" />
                <button onClick={handleAddComm}
                  className="col-span-2 md:col-span-4 px-3 py-1.5 bg-accent text-white rounded text-xs font-medium">
                  Save Rule
                </button>
              </div>
            )}

            {commRules.length > 0 ? (
              <div className="space-y-2">
                {commRules.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 text-sm">
                    <div>
                      <span className="font-medium text-foreground">{r.rule_name}</span>
                      <span className="text-xs text-muted ml-2">
                        {r.type === "percentage" ? `${r.value}%` : `₹${((r.value || 0) / 100).toFixed(0)}/unit`} of {r.metric}
                      </span>
                    </div>
                    <button onClick={() => handleDeleteComm(r.id)} className="text-muted hover:text-red-400 text-xs">Remove</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">No commission rules set</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
