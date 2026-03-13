"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  CalendarDays,
  Plus,
  Loader2,
  Check,
  X,
  ChevronDown,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { useAuth } from "@/contexts/AuthContext";
import PermissionGate from "@/components/PermissionGate";

interface LeaveType {
  id: string;
  name: string;
  days_per_year: number;
  is_active: boolean;
}

interface LeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  total: number;
  used: number;
  leave_type: { id: string; name: string } | null;
}

interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: string;
  approved_by: string | null;
  created_at: string;
  leave_type: { id: string; name: string } | null;
  employee: { id: string; full_name: string; user_id: string | null } | null;
}

interface Employee {
  id: string;
  full_name: string;
  user_id: string | null;
  reporting_to: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  approved: "bg-green-500/15 text-green-400",
  rejected: "bg-red-500/15 text-red-400",
};

const BALANCE_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

const INPUT =
  "bg-background/50 border border-border rounded-lg px-3 py-1.5 text-sm w-full";
const LABEL = "text-[11px] text-muted uppercase tracking-wider mb-1 block";

export default function LeavesPage() {
  const { user, isAdmin } = useAuth();

  const [tab, setTab] = useState<"my" | "team">("my");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState("");

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [myEmployee, setMyEmployee] = useState<Employee | null>(null);

  // Form state
  const [fType, setFType] = useState("");
  const [fStart, setFStart] = useState("");
  const [fEnd, setFEnd] = useState("");
  const [fDays, setFDays] = useState(0);
  const [fReason, setFReason] = useState("");

  function showToast(msg: string, duration = 2500) {
    setToast(msg);
    setTimeout(() => setToast(""), duration);
  }

  // Calculate working days between two dates (simple: excludes weekends)
  function calcDays(start: string, end: string): number {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (e < s) return 0;
    let count = 0;
    const cur = new Date(s);
    while (cur <= e) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  useEffect(() => {
    if (fStart && fEnd) {
      setFDays(calcDays(fStart, fEnd));
    }
  }, [fStart, fEnd]);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [typesRes, empRes] = await Promise.allSettled([
      apiFetch("/api/hr/leave-types").then((r) => r.json()),
      apiFetch("/api/hr/employees").then((r) => r.json()),
    ]);

    let types: LeaveType[] = [];
    if (typesRes.status === "fulfilled") {
      types = typesRes.value.leave_types || [];
      setLeaveTypes(types);
    }

    let allEmps: Employee[] = [];
    let currentEmp: Employee | null = null;
    if (empRes.status === "fulfilled") {
      allEmps = (empRes.value.employees || []).map(
        (e: Record<string, unknown>) => ({
          id: e.id as string,
          full_name: e.full_name as string,
          user_id: (e.user_id as string) || null,
          reporting_to: (e.reporting_to as string) || null,
        })
      );
      setEmployees(allEmps);

      if (user?.id) {
        currentEmp = allEmps.find((e) => e.user_id === user.id) || null;
        setMyEmployee(currentEmp);
      }
    }

    // Fetch balances for current employee
    if (currentEmp) {
      const balRes = await apiFetch(
        `/api/hr/leave-balances?employee_id=${currentEmp.id}`
      )
        .then((r) => r.json())
        .catch(() => ({ balances: [] }));
      setBalances(balRes.balances || []);
    }

    // Fetch leave requests
    const leavesRes = await apiFetch("/api/hr/leaves")
      .then((r) => r.json())
      .catch(() => ({ leaves: [] }));
    setLeaves(leavesRes.leaves || []);

    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const myLeaves = useMemo(
    () =>
      myEmployee
        ? leaves.filter((l) => l.employee_id === myEmployee.id)
        : [],
    [leaves, myEmployee]
  );

  const displayedLeaves = tab === "my" ? myLeaves : leaves;

  async function handleApply() {
    if (!myEmployee || !fType || !fStart || !fEnd || fDays <= 0) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/hr/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: myEmployee.id,
          leave_type_id: fType,
          start_date: fStart,
          end_date: fEnd,
          days: fDays,
          reason: fReason || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to apply for leave", 4000);
        return;
      }
      setFType("");
      setFStart("");
      setFEnd("");
      setFDays(0);
      setFReason("");
      setShowForm(false);
      showToast("Leave request submitted");
      fetchData();
    } catch (err) {
      console.error("Apply leave failed:", err);
      showToast("Failed to apply for leave", 4000);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(id: string, status: "approved" | "rejected") {
    try {
      const res = await apiFetch("/api/hr/leaves", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status,
          approved_by: myEmployee?.id || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || `Failed to ${status} leave`, 4000);
        return;
      }
      showToast(`Leave ${status}`);
      fetchData();
    } catch (err) {
      console.error(`Leave ${status} failed:`, err);
      showToast(`Failed to ${status} leave`, 4000);
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  // Check if the current user is a manager or admin (can approve/reject)
  const canApprove = isAdmin || employees.some((e) => e.reporting_to === myEmployee?.id);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold">Leave Management</h1>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
        </div>
        <PermissionGate module="hr" subModule="hr-leaves" action="canCreate">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Apply for Leave
          </button>
        </PermissionGate>
      </div>

      {/* Leave Balance Cards */}
      {balances.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {balances.map((b, idx) => {
            const total = b.total || 0;
            const used = b.used || 0;
            const remaining = total - used;
            const pct = total > 0 ? (used / total) * 100 : 0;
            const color = BALANCE_COLORS[idx % BALANCE_COLORS.length];
            return (
              <div
                key={b.id}
                className="card border border-border rounded-xl p-4 space-y-2"
              >
                <p className="text-xs text-muted truncate">
                  {b.leave_type?.name || "Unknown"}
                </p>
                <p className="text-lg font-semibold">
                  {remaining}{" "}
                  <span className="text-xs text-muted font-normal">
                    / {total}
                  </span>
                </p>
                <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted">{used} used</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => setTab("my")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "my"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          My Leaves
        </button>
        <button
          onClick={() => setTab("team")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "team"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Team Leaves
        </button>
      </div>

      {/* Apply Form */}
      {showForm && (
        <div className="card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-medium">Apply for Leave</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className={LABEL}>Leave Type *</label>
              <div className="relative">
                <select
                  value={fType}
                  onChange={(e) => setFType(e.target.value)}
                  className={INPUT}
                >
                  <option value="">Select type</option>
                  {leaveTypes
                    .filter((t) => t.is_active)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={LABEL}>Start Date *</label>
              <input
                type="date"
                value={fStart}
                onChange={(e) => setFStart(e.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>End Date *</label>
              <input
                type="date"
                value={fEnd}
                onChange={(e) => setFEnd(e.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Days</label>
              <input
                type="number"
                value={fDays}
                readOnly
                className={`${INPUT} bg-surface cursor-not-allowed`}
              />
            </div>
            <div className="col-span-2 md:col-span-4">
              <label className={LABEL}>Reason</label>
              <textarea
                value={fReason}
                onChange={(e) => setFReason(e.target.value)}
                rows={2}
                className={INPUT}
                placeholder="Optional reason for leave..."
              />
            </div>
          </div>
          <button
            onClick={handleApply}
            disabled={submitting || !fType || !fStart || !fEnd || fDays <= 0}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      )}

      {/* Leave Requests Table */}
      <div className="card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface/50">
                {tab === "team" && (
                  <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wider font-medium">
                    Employee
                  </th>
                )}
                <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wider font-medium">
                  Type
                </th>
                <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wider font-medium">
                  Dates
                </th>
                <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wider font-medium">
                  Days
                </th>
                <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wider font-medium">
                  Reason
                </th>
                <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wider font-medium">
                  Status
                </th>
                {canApprove && tab === "team" && (
                  <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wider font-medium">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {displayedLeaves.map((l) => (
                <tr
                  key={l.id}
                  className="border-b border-border/50 hover:bg-surface-hover transition-colors"
                >
                  {tab === "team" && (
                    <td className="px-4 py-3 font-medium">
                      {l.employee?.full_name || "Unknown"}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {l.leave_type?.name || "Unknown"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {formatDate(l.start_date)} — {formatDate(l.end_date)}
                  </td>
                  <td className="px-4 py-3">{l.days}</td>
                  <td className="px-4 py-3 text-xs text-muted max-w-[200px] truncate">
                    {l.reason || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full capitalize ${
                        STATUS_COLORS[l.status] || ""
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                  {canApprove && tab === "team" && (
                    <td className="px-4 py-3">
                      {l.status === "pending" && (
                        <div className="flex items-center gap-1.5">
                          <PermissionGate module="hr" subModule="hr-leaves" action="canApprove">
                            <button
                              onClick={() => handleAction(l.id, "approved")}
                              className="p-1.5 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors"
                              title="Approve"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </PermissionGate>
                          <PermissionGate module="hr" subModule="hr-leaves" action="canApprove">
                            <button
                              onClick={() => handleAction(l.id, "rejected")}
                              className="p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                              title="Reject"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </PermissionGate>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {displayedLeaves.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={tab === "team" && canApprove ? 7 : tab === "team" ? 6 : 5}
                    className="text-center py-12 text-muted text-sm"
                  >
                    No leave requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
