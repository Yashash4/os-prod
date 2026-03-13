"use client";

import { Fragment, useEffect, useState, useMemo, useCallback } from "react";
import {
  Users, Plus, Loader2, Search, Trash2, ChevronDown, ChevronUp, Save, Shield,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import PermissionGate from "@/components/PermissionGate";

interface Employee {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  department_id: string | null;
  designation_id: string | null;
  employment_type: string;
  join_date: string | null;
  status: string;
  exit_date: string | null;
  reporting_to: string | null;
  user_id: string | null;
  department: { id: string; name: string } | null;
  designation: { id: string; title: string; level: string } | null;
  manager: { id: string; full_name: string } | null;
}

interface Dept { id: string; name: string; }
interface Desg { id: string; title: string; level: string; }
interface SystemUser { id: string; email: string; full_name: string | null; }

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/15 text-green-400",
  on_leave: "bg-amber-500/15 text-amber-400",
  notice_period: "bg-orange-500/15 text-orange-400",
  exited: "bg-red-500/15 text-red-400",
};

const TYPE_LABELS: Record<string, string> = {
  full_time: "Full Time",
  part_time: "Part Time",
  contract: "Contract",
  intern: "Intern",
};

const INPUT = "bg-background/50 border border-border rounded-lg px-3 py-1.5 text-sm w-full";
const LABEL = "text-[11px] text-muted uppercase tracking-wider mb-1 block";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [designations, setDesignations] = useState<Desg[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState("");

  // Form
  const [fn, setFn] = useState("");
  const [fe, setFe] = useState("");
  const [fp, setFp] = useState("");
  const [fd, setFd] = useState("");
  const [fdes, setFdes] = useState("");
  const [ft, setFt] = useState("full_time");
  const [fj, setFj] = useState("");
  const [fr, setFr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function showToast(msg: string, duration = 2000) {
    setToast(msg);
    setTimeout(() => setToast(""), duration);
  }

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [empRes, deptRes, desgRes, usersRes] = await Promise.allSettled([
      apiFetch("/api/hr/employees").then((r) => r.json()),
      apiFetch("/api/hr/departments").then((r) => r.json()),
      apiFetch("/api/hr/designations").then((r) => r.json()),
      apiFetch("/api/admin/users").then((r) => r.json()),
    ]);

    if (empRes.status === "fulfilled") setEmployees(empRes.value.employees || []);
    if (deptRes.status === "fulfilled") setDepartments((deptRes.value.departments || []).map((x: Dept & Record<string, unknown>) => ({ id: x.id, name: x.name })));
    if (desgRes.status === "fulfilled") setDesignations((desgRes.value.designations || []).map((x: Desg & Record<string, unknown>) => ({ id: x.id, title: x.title, level: x.level })));
    if (usersRes.status === "fulfilled") setSystemUsers((usersRes.value.users || []).map((u: SystemUser & Record<string, unknown>) => ({ id: u.id, email: u.email, full_name: u.full_name })));

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    let list = employees;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        e.full_name.toLowerCase().includes(q) ||
        (e.email && e.email.toLowerCase().includes(q))
      );
    }
    if (deptFilter !== "all") list = list.filter((e) => e.department_id === deptFilter);
    if (statusFilter !== "all") list = list.filter((e) => e.status === statusFilter);
    return list;
  }, [employees, search, deptFilter, statusFilter]);

  async function handleAdd() {
    if (!fn.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/hr/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fn.trim(), email: fe || null, phone: fp || null,
          department_id: fd || null, designation_id: fdes || null,
          employment_type: ft, join_date: fj || null, reporting_to: fr || null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || "Failed to add employee", 4000);
        return;
      }

      setFn(""); setFe(""); setFp(""); setFd(""); setFdes(""); setFt("full_time"); setFj(""); setFr("");
      setShowForm(false);

      if (data.auto_created_user) {
        showToast(`Employee added — Invite email sent to ${fe} to set their password`, 6000);
      } else {
        showToast("Employee added");
      }
      fetchData();
    } catch (err) {
      console.error("Add employee failed:", err);
      showToast("Failed to add employee — check console for details", 4000);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(id: string, field: string, value: string | null) {
    // Optimistic update for simple fields
    setEmployees((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      const updated = { ...e, [field]: value };
      // Also update nested objects for display
      if (field === "department_id") {
        updated.department = value ? departments.find((d) => d.id === value) || null : null;
      }
      if (field === "designation_id") {
        updated.designation = value ? designations.find((d) => d.id === value) || null : null;
      }
      if (field === "reporting_to") {
        const mgr = value ? employees.find((emp) => emp.id === value) : null;
        updated.manager = mgr ? { id: mgr.id, full_name: mgr.full_name } : null;
      }
      return updated;
    }));

    await apiFetch("/api/hr/employees", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [field]: value }),
    });
    showToast("Saved");
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this employee?")) return;
    await apiFetch(`/api/hr/employees?id=${id}`, { method: "DELETE" });
    showToast("Employee removed");
    fetchData();
  }

  function initials(name: string) {
    return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold">Employees</h1>
          <span className="text-sm text-muted">({filtered.length})</span>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
        </div>
        <PermissionGate module="hr" subModule="hr-employees" action="canCreate">
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">
            <Plus className="w-4 h-4" /> Add Employee
          </button>
        </PermissionGate>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input type="text" placeholder="Search by name or email..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 bg-background/50 border border-border rounded-lg text-sm w-64" />
        </div>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
          className="bg-background/50 border border-border rounded-lg px-3 py-1.5 text-sm">
          <option value="all">All Departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-background/50 border border-border rounded-lg px-3 py-1.5 text-sm capitalize">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="on_leave">On Leave</option>
          <option value="notice_period">Notice Period</option>
          <option value="exited">Exited</option>
        </select>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-medium">New Employee</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className={LABEL}>Full Name *</label>
              <input type="text" value={fn} onChange={(e) => setFn(e.target.value)} className={INPUT} /></div>
            <div><label className={LABEL}>Email</label>
              <input type="email" value={fe} onChange={(e) => setFe(e.target.value)} className={INPUT} /></div>
            <div><label className={LABEL}>Phone</label>
              <input type="text" value={fp} onChange={(e) => setFp(e.target.value)} className={INPUT} /></div>
            <div><label className={LABEL}>Department</label>
              <select value={fd} onChange={(e) => setFd(e.target.value)} className={INPUT}>
                <option value="">—</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select></div>
            <div><label className={LABEL}>Designation</label>
              <select value={fdes} onChange={(e) => setFdes(e.target.value)} className={INPUT}>
                <option value="">—</option>
                {designations.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select></div>
            <div><label className={LABEL}>Type</label>
              <select value={ft} onChange={(e) => setFt(e.target.value)} className={INPUT}>
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
              </select></div>
            <div><label className={LABEL}>Join Date</label>
              <input type="date" value={fj} onChange={(e) => setFj(e.target.value)} className={INPUT} /></div>
            <div><label className={LABEL}>Reports To</label>
              <select value={fr} onChange={(e) => setFr(e.target.value)} className={INPUT}>
                <option value="">—</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select></div>
          </div>
          <button onClick={handleAdd} disabled={submitting || !fn.trim()}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Adding..." : "Add Employee"}
          </button>
        </div>
      )}

      {/* Employee List */}
      <div className="space-y-2">
        {filtered.map((e) => (
          <div key={e.id} className="card border border-border rounded-xl overflow-hidden">
            {/* Summary Row */}
            <div
              className="flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-surface-hover transition-colors"
              onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
            >
              <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center text-xs font-semibold text-accent flex-shrink-0">
                {initials(e.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{e.full_name}</p>
                <p className="text-xs text-muted truncate">
                  {[e.designation?.title, e.department?.name].filter(Boolean).join(" · ") || "No role assigned"}
                </p>
              </div>
              {e.user_id && (
                <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-500/15 text-blue-400 flex-shrink-0" title="Has system access">
                  <Shield className="w-3 h-3" /> Access
                </span>
              )}
              <span className={`text-xs px-2.5 py-1 rounded-full capitalize flex-shrink-0 ${STATUS_COLORS[e.status] || ""}`}>
                {e.status.replace("_", " ")}
              </span>
              <span className="text-xs text-muted flex-shrink-0">{TYPE_LABELS[e.employment_type]}</span>
              <span className="text-xs text-muted flex-shrink-0 w-20">{e.join_date || "—"}</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                {expandedId === e.id ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
              </div>
            </div>

            {/* Editable Detail Panel */}
            {expandedId === e.id && (
              <div className="border-t border-border bg-surface/30 px-5 py-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Full Name */}
                  <div>
                    <label className={LABEL}>Full Name</label>
                    <input type="text" defaultValue={e.full_name}
                      onBlur={(ev) => { if (ev.target.value !== e.full_name) handleUpdate(e.id, "full_name", ev.target.value); }}
                      className={INPUT} />
                  </div>
                  {/* Email */}
                  <div>
                    <label className={LABEL}>Email</label>
                    <input type="email" defaultValue={e.email || ""}
                      onBlur={(ev) => { if (ev.target.value !== (e.email || "")) handleUpdate(e.id, "email", ev.target.value || null); }}
                      className={INPUT} />
                  </div>
                  {/* Phone */}
                  <div>
                    <label className={LABEL}>Phone</label>
                    <input type="text" defaultValue={e.phone || ""}
                      onBlur={(ev) => { if (ev.target.value !== (e.phone || "")) handleUpdate(e.id, "phone", ev.target.value || null); }}
                      className={INPUT} />
                  </div>
                  {/* Department */}
                  <div>
                    <label className={LABEL}>Department</label>
                    <select value={e.department_id || ""}
                      onChange={(ev) => handleUpdate(e.id, "department_id", ev.target.value || null)}
                      className={INPUT}>
                      <option value="">—</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  {/* Designation */}
                  <div>
                    <label className={LABEL}>Designation</label>
                    <select value={e.designation_id || ""}
                      onChange={(ev) => handleUpdate(e.id, "designation_id", ev.target.value || null)}
                      className={INPUT}>
                      <option value="">—</option>
                      {designations.map((d) => <option key={d.id} value={d.id}>{d.title} ({d.level})</option>)}
                    </select>
                  </div>
                  {/* Employment Type */}
                  <div>
                    <label className={LABEL}>Employment Type</label>
                    <select value={e.employment_type}
                      onChange={(ev) => handleUpdate(e.id, "employment_type", ev.target.value)}
                      className={INPUT}>
                      <option value="full_time">Full Time</option>
                      <option value="part_time">Part Time</option>
                      <option value="contract">Contract</option>
                      <option value="intern">Intern</option>
                    </select>
                  </div>
                  {/* Status */}
                  <div>
                    <label className={LABEL}>Status</label>
                    <select value={e.status}
                      onChange={(ev) => handleUpdate(e.id, "status", ev.target.value)}
                      className={INPUT}>
                      <option value="active">Active</option>
                      <option value="on_leave">On Leave</option>
                      <option value="notice_period">Notice Period</option>
                      <option value="exited">Exited</option>
                    </select>
                  </div>
                  {/* Reports To */}
                  <div>
                    <label className={LABEL}>Reports To</label>
                    <select value={e.reporting_to || ""}
                      onChange={(ev) => handleUpdate(e.id, "reporting_to", ev.target.value || null)}
                      className={INPUT}>
                      <option value="">—</option>
                      {employees.filter((emp) => emp.id !== e.id).map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                      ))}
                    </select>
                  </div>
                  {/* Join Date */}
                  <div>
                    <label className={LABEL}>Join Date</label>
                    <input type="date" value={e.join_date || ""}
                      onChange={(ev) => handleUpdate(e.id, "join_date", ev.target.value || null)}
                      className={INPUT} />
                  </div>
                  {/* Exit Date */}
                  <div>
                    <label className={LABEL}>Exit Date</label>
                    <input type="date" value={e.exit_date || ""}
                      onChange={(ev) => handleUpdate(e.id, "exit_date", ev.target.value || null)}
                      className={INPUT} />
                  </div>
                  {/* Linked User */}
                  <div className="col-span-2">
                    <label className={LABEL}>Linked User (System Access)</label>
                    <select value={e.user_id || ""}
                      onChange={(ev) => handleUpdate(e.id, "user_id", ev.target.value || null)}
                      className={INPUT}>
                      <option value="">— No linked user —</option>
                      {systemUsers
                        .filter((u) => u.id === e.user_id || !employees.some((emp) => emp.user_id === u.id))
                        .map((u) => (
                          <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.email})</option>
                        ))}
                    </select>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <Save className="w-3.5 h-3.5" />
                    Changes auto-save on edit
                  </div>
                  <PermissionGate module="hr" subModule="hr-employees" action="canDelete">
                    <button onClick={() => handleDelete(e.id)}
                      className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Remove Employee
                    </button>
                  </PermissionGate>
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && !loading && (
          <div className="text-center py-16 text-muted text-sm">No employees found</div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-surface border border-border rounded-lg px-4 py-2.5 shadow-lg text-sm text-foreground z-50 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
          {toast}
        </div>
      )}
    </div>
  );
}
