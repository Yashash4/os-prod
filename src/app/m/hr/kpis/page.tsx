"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Target, Loader2, Plus, Star } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import PermissionGate from "@/components/PermissionGate";

interface KPI {
  id: string;
  name: string;
  description: string | null;
  department: { id: string; name: string } | null;
  unit: string;
  target_value: number;
  frequency: string;
}

interface KPIEntry {
  id: string;
  kpi_id: string;
  employee_id: string;
  period: string;
  actual_value: number;
  target_value: number;
  kpi: { id: string; name: string; unit: string } | null;
  employee: { id: string; full_name: string } | null;
}

interface KRA {
  id: string;
  employee_id: string;
  title: string;
  description: string | null;
  weightage: number;
  review_period: string;
  self_rating: number | null;
  manager_rating: number | null;
  status: string;
  employee: { id: string; full_name: string } | null;
}

interface Emp { id: string; full_name: string; }
interface Dept { id: string; name: string; }

type Tab = "kpi" | "kra";

export default function KPIsPage() {
  const [tab, setTab] = useState<Tab>("kpi");
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [entries, setEntries] = useState<KPIEntry[]>([]);
  const [kras, setKras] = useState<KRA[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);

  // KPI form
  const [showKPIForm, setShowKPIForm] = useState(false);
  const [kpiName, setKpiName] = useState("");
  const [kpiUnit, setKpiUnit] = useState("count");
  const [kpiTarget, setKpiTarget] = useState("");
  const [kpiDept, setKpiDept] = useState("");
  const [kpiFreq, setKpiFreq] = useState("monthly");

  // Entry form
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [entryKpi, setEntryKpi] = useState("");
  const [entryEmp, setEntryEmp] = useState("");
  const [entryPeriod, setEntryPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [entryActual, setEntryActual] = useState("");

  // KRA form
  const [showKRAForm, setShowKRAForm] = useState(false);
  const [kraEmp, setKraEmp] = useState("");
  const [kraTitle, setKraTitle] = useState("");
  const [kraWeight, setKraWeight] = useState("");
  const [kraPeriod, setKraPeriod] = useState("");

  // Filters
  const [filterEmp, setFilterEmp] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState(() => new Date().toISOString().slice(0, 7));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiRes, entRes, kraRes, empRes, deptRes] = await Promise.all([
        apiFetch("/api/hr/kpis"),
        apiFetch(`/api/hr/kpi-entries?period=${filterPeriod}`),
        apiFetch("/api/hr/kras"),
        apiFetch("/api/hr/employees"),
        apiFetch("/api/hr/departments"),
      ]);
      const [kpiData, entData, kraData, empData, deptData] = await Promise.all([
        kpiRes.json(), entRes.json(), kraRes.json(), empRes.json(), deptRes.json(),
      ]);
      setKpis(kpiData.kpis || []);
      setEntries(entData.entries || []);
      setKras(kraData.kras || []);
      setEmployees((empData.employees || []).map((e: Emp & Record<string, unknown>) => ({ id: e.id, full_name: e.full_name })));
      setDepartments((deptData.departments || []).map((d: Dept & Record<string, unknown>) => ({ id: d.id, name: d.name })));
    } catch { /* ignore */ }
    setLoading(false);
  }, [filterPeriod]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredEntries = useMemo(() => {
    if (filterEmp === "all") return entries;
    return entries.filter((e) => e.employee_id === filterEmp);
  }, [entries, filterEmp]);

  const filteredKras = useMemo(() => {
    if (filterEmp === "all") return kras;
    return kras.filter((k) => k.employee_id === filterEmp);
  }, [kras, filterEmp]);

  async function handleAddKPI() {
    if (!kpiName) return;
    await apiFetch("/api/hr/kpis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: kpiName, unit: kpiUnit, target_value: parseFloat(kpiTarget) || 0,
        department_id: kpiDept || null, frequency: kpiFreq,
      }),
    });
    setKpiName(""); setKpiTarget(""); setShowKPIForm(false); fetchData();
  }

  async function handleLogEntry() {
    if (!entryKpi || !entryEmp) return;
    const kpi = kpis.find((k) => k.id === entryKpi);
    await apiFetch("/api/hr/kpi-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kpi_id: entryKpi, employee_id: entryEmp, period: entryPeriod,
        actual_value: parseFloat(entryActual) || 0, target_value: kpi?.target_value || 0,
      }),
    });
    setEntryActual(""); setShowEntryForm(false); fetchData();
  }

  async function handleAddKRA() {
    if (!kraEmp || !kraTitle || !kraPeriod) return;
    await apiFetch("/api/hr/kras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee_id: kraEmp, title: kraTitle, weightage: parseFloat(kraWeight) || 0,
        review_period: kraPeriod,
      }),
    });
    setKraTitle(""); setKraWeight(""); setShowKRAForm(false); fetchData();
  }

  async function handleRateKRA(id: string, field: "self_rating" | "manager_rating", value: number) {
    setKras((prev) => prev.map((k) => k.id === id ? { ...k, [field]: value } : k));
    await apiFetch("/api/hr/kras", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [field]: value }),
    });
  }

  function achievement(actual: number, target: number) {
    if (!target) return 0;
    return Math.round((actual / target) * 100);
  }

  function achColor(pct: number) {
    if (pct >= 100) return "text-green-400";
    if (pct >= 70) return "text-amber-400";
    return "text-red-400";
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold">KPIs & KRAs</h1>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface border border-border rounded-lg p-1 w-fit">
        {(["kpi", "kra"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm transition-colors uppercase ${
              tab === t ? "bg-accent text-white" : "text-muted hover:text-foreground"
            }`}>
            {t === "kpi" ? "KPI Tracker" : "KRA Reviews"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={filterEmp} onChange={(e) => setFilterEmp(e.target.value)}
          className="bg-background/50 border border-border rounded-lg px-3 py-1.5 text-sm">
          <option value="all">All Employees</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
        {tab === "kpi" && (
          <input type="month" value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)}
            className="bg-background/50 border border-border rounded-lg px-3 py-1.5 text-sm" />
        )}
      </div>

      {/* KPI Tab */}
      {tab === "kpi" && (
        <>
          <div className="flex gap-2">
            <PermissionGate module="hr" subModule="hr-kpis" action="canCreate">
              <button onClick={() => setShowKPIForm(!showKPIForm)}
                className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-xs text-muted hover:text-foreground">
                <Plus className="w-3.5 h-3.5" /> Define KPI
              </button>
            </PermissionGate>
            <PermissionGate module="hr" subModule="hr-kpis" action="canCreate">
              <button onClick={() => setShowEntryForm(!showEntryForm)}
                className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium">
                <Plus className="w-3.5 h-3.5" /> Log Entry
              </button>
            </PermissionGate>
          </div>

          {showKPIForm && (
            <div className="card border border-border rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-medium">Define KPI</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <input type="text" placeholder="KPI Name" value={kpiName} onChange={(e) => setKpiName(e.target.value)}
                  className="bg-background/50 border border-border rounded px-2 py-1.5 text-xs" />
                <select value={kpiUnit} onChange={(e) => setKpiUnit(e.target.value)}
                  className="bg-background/50 border border-border rounded px-2 py-1.5 text-xs">
                  <option value="count">Count</option>
                  <option value="currency_paise">Currency (₹)</option>
                  <option value="percentage">Percentage</option>
                  <option value="hours">Hours</option>
                </select>
                <input type="number" placeholder="Target" value={kpiTarget} onChange={(e) => setKpiTarget(e.target.value)}
                  className="bg-background/50 border border-border rounded px-2 py-1.5 text-xs" />
                <select value={kpiDept} onChange={(e) => setKpiDept(e.target.value)}
                  className="bg-background/50 border border-border rounded px-2 py-1.5 text-xs">
                  <option value="">All Departments</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <select value={kpiFreq} onChange={(e) => setKpiFreq(e.target.value)}
                  className="bg-background/50 border border-border rounded px-2 py-1.5 text-xs">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
              <button onClick={handleAddKPI}
                className="px-3 py-1.5 bg-accent text-white rounded text-xs font-medium">Add KPI</button>
            </div>
          )}

          {showEntryForm && (
            <div className="card border border-border rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-medium">Log KPI Entry</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <select value={entryKpi} onChange={(e) => setEntryKpi(e.target.value)}
                  className="bg-background/50 border border-border rounded px-2 py-1.5 text-xs">
                  <option value="">Select KPI</option>
                  {kpis.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
                <select value={entryEmp} onChange={(e) => setEntryEmp(e.target.value)}
                  className="bg-background/50 border border-border rounded px-2 py-1.5 text-xs">
                  <option value="">Select Employee</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
                <input type="month" value={entryPeriod} onChange={(e) => setEntryPeriod(e.target.value)}
                  className="bg-background/50 border border-border rounded px-2 py-1.5 text-xs" />
                <input type="number" placeholder="Actual Value" value={entryActual}
                  onChange={(e) => setEntryActual(e.target.value)}
                  className="bg-background/50 border border-border rounded px-2 py-1.5 text-xs" />
              </div>
              <button onClick={handleLogEntry}
                className="px-3 py-1.5 bg-accent text-white rounded text-xs font-medium">Log Entry</button>
            </div>
          )}

          {/* KPI Entries Table */}
          <div className="card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface">
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">KPI</th>
                  <th className="px-4 py-3 font-medium text-right">Target</th>
                  <th className="px-4 py-3 font-medium text-right">Actual</th>
                  <th className="px-4 py-3 font-medium text-right">Achievement</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((e) => {
                  const ach = achievement(e.actual_value, e.target_value);
                  return (
                    <tr key={e.id} className="border-b border-border/50 hover:bg-surface-hover">
                      <td className="px-4 py-2 font-medium">{e.employee?.full_name || "Unknown"}</td>
                      <td className="px-4 py-2 text-muted">{e.kpi?.name || "Unknown"}</td>
                      <td className="px-4 py-2 text-right">{e.target_value}</td>
                      <td className="px-4 py-2 text-right font-medium">{e.actual_value}</td>
                      <td className={`px-4 py-2 text-right font-medium ${achColor(ach)}`}>{ach}%</td>
                    </tr>
                  );
                })}
                {filteredEntries.length === 0 && !loading && (
                  <tr><td colSpan={5} className="py-12 text-center text-muted">No entries for this period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* KRA Tab */}
      {tab === "kra" && (
        <>
          <PermissionGate module="hr" subModule="hr-kpis" action="canCreate">
            <button onClick={() => setShowKRAForm(!showKRAForm)}
              className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium">
              <Plus className="w-3.5 h-3.5" /> Add KRA
            </button>
          </PermissionGate>

          {showKRAForm && (
            <div className="card border border-border rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-medium">New KRA</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <select value={kraEmp} onChange={(e) => setKraEmp(e.target.value)}
                  className="bg-background/50 border border-border rounded px-2 py-1.5 text-xs">
                  <option value="">Employee</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
                <input type="text" placeholder="KRA Title" value={kraTitle}
                  onChange={(e) => setKraTitle(e.target.value)}
                  className="bg-background/50 border border-border rounded px-2 py-1.5 text-xs" />
                <input type="number" placeholder="Weightage (%)" value={kraWeight}
                  onChange={(e) => setKraWeight(e.target.value)}
                  className="bg-background/50 border border-border rounded px-2 py-1.5 text-xs" />
                <input type="text" placeholder="Period (e.g. Q1-2026)" value={kraPeriod}
                  onChange={(e) => setKraPeriod(e.target.value)}
                  className="bg-background/50 border border-border rounded px-2 py-1.5 text-xs" />
              </div>
              <button onClick={handleAddKRA}
                className="px-3 py-1.5 bg-accent text-white rounded text-xs font-medium">Add KRA</button>
            </div>
          )}

          {/* KRA Cards */}
          <div className="space-y-4">
            {filteredKras.map((k) => {
              const weighted = k.manager_rating ? (k.manager_rating * k.weightage / 100) : null;
              return (
                <div key={k.id} className="card border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-foreground">{k.title}</p>
                      <p className="text-xs text-muted">{k.employee?.full_name} | {k.review_period} | Weight: {k.weightage}%</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                      k.status === "reviewed" ? "bg-green-500/15 text-green-400" :
                      k.status === "review_pending" ? "bg-amber-500/15 text-amber-400" :
                      "bg-zinc-500/15 text-zinc-400"
                    }`}>{k.status.replace("_", " ")}</span>
                  </div>
                  <div className="flex items-center gap-6 mt-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">Self:</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} onClick={() => handleRateKRA(k.id, "self_rating", n)}>
                            <Star className={`w-4 h-4 ${(k.self_rating || 0) >= n ? "fill-amber-400 text-amber-400" : "text-zinc-600"}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">Manager:</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} onClick={() => handleRateKRA(k.id, "manager_rating", n)}>
                            <Star className={`w-4 h-4 ${(k.manager_rating || 0) >= n ? "fill-accent text-accent" : "text-zinc-600"}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    {weighted !== null && (
                      <span className="text-xs text-muted">Weighted: <span className="text-foreground font-medium">{weighted.toFixed(2)}</span></span>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredKras.length === 0 && !loading && (
              <p className="text-muted text-sm text-center py-12">No KRAs found</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
