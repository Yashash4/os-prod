"use client";

import { useEffect, useState, useCallback } from "react";
import { Settings, Link2, Unlink, BadgeCheck, Loader2, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

interface Employee {
  id: string;
  full_name: string;
  email: string | null;
  user_id: string | null;
  department_id: string | null;
  designation_id: string | null;
  status: string;
}

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role_id: string | null;
}

interface Designation {
  id: string;
  title: string;
  level: string;
  department_id: string | null;
  role_id: string | null;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

const INPUT = "bg-background/50 border border-border rounded-lg px-3 py-2 text-sm w-full";

export default function HRSettingsPage() {
  const [unlinkedEmployees, setUnlinkedEmployees] = useState<Employee[]>([]);
  const [linkedEmployees, setLinkedEmployees] = useState<Employee[]>([]);
  const [unlinkedUsers, setUnlinkedUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Track which user is selected per employee for linking
  const [linkSelections, setLinkSelections] = useState<Record<string, string>>({});

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/hr/settings");
      const d = await res.json();
      setUnlinkedEmployees(d.unlinked_employees || []);
      setLinkedEmployees(d.linked_employees || []);
      setUnlinkedUsers(d.unlinked_users || []);
      setAllUsers(d.all_users || []);
      setDesignations(d.designations || []);
      setRoles(d.roles || []);
    } catch {
      showToast("Failed to load settings data", false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleLink(employeeId: string) {
    const userId = linkSelections[employeeId];
    if (!userId) return;
    try {
      const res = await apiFetch("/api/hr/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "link_user", employee_id: employeeId, user_id: userId }),
      });
      const d = await res.json();
      if (d.error) { showToast(d.error, false); return; }
      showToast("Employee linked to user", true);
      setLinkSelections((prev) => { const n = { ...prev }; delete n[employeeId]; return n; });
      fetchData();
    } catch { showToast("Failed to link", false); }
  }

  async function handleUnlink(employeeId: string) {
    try {
      const res = await apiFetch("/api/hr/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlink_user", employee_id: employeeId }),
      });
      const d = await res.json();
      if (d.error) { showToast(d.error, false); return; }
      showToast("Employee unlinked from user", true);
      fetchData();
    } catch { showToast("Failed to unlink", false); }
  }

  async function handleMapRole(designationId: string, roleId: string) {
    // Optimistic update
    setDesignations((prev) =>
      prev.map((d) => d.id === designationId ? { ...d, role_id: roleId || null } : d)
    );
    try {
      const res = await apiFetch("/api/hr/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "map_designation_role", designation_id: designationId, role_id: roleId || null }),
      });
      const d = await res.json();
      if (d.error) { showToast(d.error, false); fetchData(); return; }
      showToast("Designation mapped to role", true);
    } catch { showToast("Failed to map role", false); fetchData(); }
  }

  // Find suggested user match by email
  function getSuggestedUser(emp: Employee): User | undefined {
    if (!emp.email) return undefined;
    return unlinkedUsers.find((u) => u.email.toLowerCase() === emp.email?.toLowerCase());
  }

  // Get user info for a linked employee
  function getLinkedUser(emp: Employee): User | undefined {
    return allUsers.find((u) => u.id === emp.user_id);
  }

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
          toast.ok ? "bg-green-500/15 text-green-400 border border-green-500/30" : "bg-red-500/15 text-red-400 border border-red-500/30"
        }`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-accent" />
        <h1 className="text-2xl font-bold">HR Settings</h1>
        {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
      </div>

      {/* ── Section 1: User-Employee Linking ────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-semibold">User — Employee Linking</h2>
        </div>
        <p className="text-sm text-muted">
          Connect HR employees to APEX OS user accounts. When an employee is linked, they can log in and access modules based on their role.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{linkedEmployees.length}</p>
            <p className="text-xs text-muted">Linked</p>
          </div>
          <div className="card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{unlinkedEmployees.length}</p>
            <p className="text-xs text-muted">Unlinked Employees</p>
          </div>
          <div className="card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{unlinkedUsers.length}</p>
            <p className="text-xs text-muted">Unlinked Users</p>
          </div>
        </div>

        {/* Unlinked Employees */}
        {unlinkedEmployees.length > 0 && (
          <div className="card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-surface border-b border-border">
              <h3 className="text-sm font-medium text-muted">Unlinked Employees</h3>
            </div>
            <div className="divide-y divide-border/50">
              {unlinkedEmployees.map((emp) => {
                const suggested = getSuggestedUser(emp);
                const selectedUserId = linkSelections[emp.id] || "";
                return (
                  <div key={emp.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{emp.full_name}</p>
                      <p className="text-xs text-muted truncate">{emp.email || "No email"}</p>
                    </div>
                    {suggested && !selectedUserId && (
                      <button
                        onClick={() => setLinkSelections((prev) => ({ ...prev, [emp.id]: suggested.id }))}
                        className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 shrink-0"
                      >
                        <Sparkles className="w-3 h-3" />
                        Match: {suggested.full_name || suggested.email}
                      </button>
                    )}
                    <select
                      value={selectedUserId}
                      onChange={(e) => setLinkSelections((prev) => ({ ...prev, [emp.id]: e.target.value }))}
                      className={`${INPUT} max-w-[220px]`}
                    >
                      <option value="">Select user...</option>
                      {unlinkedUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name || u.email} ({u.email})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleLink(emp.id)}
                      disabled={!selectedUserId}
                      className="px-3 py-2 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                      <Link2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Linked Employees */}
        {linkedEmployees.length > 0 && (
          <div className="card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-surface border-b border-border">
              <h3 className="text-sm font-medium text-muted">Linked Employees</h3>
            </div>
            <div className="divide-y divide-border/50">
              {linkedEmployees.map((emp) => {
                const user = getLinkedUser(emp);
                return (
                  <div key={emp.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{emp.full_name}</p>
                      <p className="text-xs text-muted truncate">{emp.email || "—"}</p>
                    </div>
                    <div className="text-xs text-muted shrink-0">→</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-blue-400">
                        {user?.full_name || user?.email || "Unknown user"}
                      </p>
                      <p className="text-xs text-muted truncate">{user?.email || ""}</p>
                    </div>
                    <button
                      onClick={() => handleUnlink(emp.id)}
                      className="px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg text-xs shrink-0"
                      title="Unlink"
                    >
                      <Unlink className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && unlinkedEmployees.length === 0 && linkedEmployees.length === 0 && (
          <div className="text-center py-8 text-muted text-sm">No employees found</div>
        )}
      </div>

      {/* ── Section 2: Designation → Role Mapping ─────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BadgeCheck className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-semibold">Designation → Role Mapping</h2>
        </div>
        <p className="text-sm text-muted">
          Map HR designations to RBAC roles. When a new employee is created with a mapped designation,
          their user account will automatically receive the corresponding role.
        </p>

        <div className="card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface">
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-medium">Designation</th>
                <th className="px-4 py-3 font-medium">Level</th>
                <th className="px-4 py-3 font-medium">Mapped Role</th>
              </tr>
            </thead>
            <tbody>
              {designations.map((d) => (
                <tr key={d.id} className="border-b border-border/50 hover:bg-surface-hover">
                  <td className="px-4 py-2 font-medium">{d.title}</td>
                  <td className="px-4 py-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent capitalize">
                      {d.level}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={d.role_id || ""}
                      onChange={(e) => handleMapRole(d.id, e.target.value)}
                      className={`${INPUT} max-w-[200px]`}
                    >
                      <option value="">— No role —</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {designations.length === 0 && !loading && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-muted">No designations found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-start gap-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
          <span className="text-blue-400 text-sm">ℹ</span>
          <p className="text-xs text-blue-400/80">
            Role mapping is applied automatically when creating new employees. Changing a mapping here does not retroactively update existing employees&apos; user roles.
          </p>
        </div>
      </div>
    </div>
  );
}
