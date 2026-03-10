"use client";

import { useEffect, useState, useCallback } from "react";
import { BadgeCheck, Plus, Loader2, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

interface Designation {
  id: string;
  title: string;
  level: string;
  department_id: string | null;
  role_id: string | null;
  department: { id: string; name: string } | null;
  is_active: boolean;
}

interface Department {
  id: string;
  name: string;
}

interface Role {
  id: string;
  name: string;
}

const LEVELS = ["intern", "junior", "mid", "senior", "lead", "manager", "head", "director"];

export default function DesignationsPage() {
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formLevel, setFormLevel] = useState("mid");
  const [formDept, setFormDept] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [desRes, deptRes, rolesRes] = await Promise.all([
        apiFetch("/api/hr/designations"),
        apiFetch("/api/hr/departments"),
        apiFetch("/api/admin/roles"),
      ]);
      const desData = await desRes.json();
      const deptData = await deptRes.json();
      const rolesData = await rolesRes.json();
      setDesignations(desData.designations || []);
      setDepartments((deptData.departments || []).map((d: Department & Record<string, unknown>) => ({ id: d.id, name: d.name })));
      setRoles((rolesData.roles || []).map((r: Role & Record<string, unknown>) => ({ id: r.id, name: r.name })));
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAdd() {
    if (!formTitle.trim()) return;
    await apiFetch("/api/hr/designations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: formTitle.trim(), level: formLevel, department_id: formDept || null }),
    });
    setFormTitle(""); setFormLevel("mid"); setFormDept(""); setShowForm(false);
    fetchData();
  }

  async function handleUpdate(id: string, field: string, value: string) {
    setDesignations((prev) => prev.map((d) => d.id === id ? { ...d, [field]: value } : d));
    await apiFetch("/api/hr/designations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [field]: value }),
    });
  }

  async function handleDelete(id: string) {
    setDesignations((prev) => prev.filter((d) => d.id !== id));
    await apiFetch(`/api/hr/designations?id=${id}`, { method: "DELETE" });
  }

  const LEVEL_COLORS: Record<string, string> = {
    intern: "bg-zinc-500/15 text-zinc-400",
    junior: "bg-blue-500/15 text-blue-400",
    mid: "bg-cyan-500/15 text-cyan-400",
    senior: "bg-green-500/15 text-green-400",
    lead: "bg-amber-500/15 text-amber-400",
    manager: "bg-orange-500/15 text-orange-400",
    head: "bg-purple-500/15 text-purple-400",
    director: "bg-red-500/15 text-red-400",
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BadgeCheck className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold">Designations</h1>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Designation
        </button>
      </div>

      {showForm && (
        <div className="card border border-border rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-medium">New Designation</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="text" placeholder="Title" value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="bg-background/50 border border-border rounded-lg px-3 py-2 text-sm" />
            <select value={formLevel} onChange={(e) => setFormLevel(e.target.value)}
              className="bg-background/50 border border-border rounded-lg px-3 py-2 text-sm capitalize">
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select value={formDept} onChange={(e) => setFormDept(e.target.value)}
              className="bg-background/50 border border-border rounded-lg px-3 py-2 text-sm">
              <option value="">No department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <button onClick={handleAdd}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">
            Add
          </button>
        </div>
      )}

      <div className="card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface">
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Level</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Mapped Role</th>
              <th className="px-4 py-3 font-medium w-10"></th>
            </tr>
          </thead>
          <tbody>
            {designations.map((d) => (
              <tr key={d.id} className="border-b border-border/50 hover:bg-surface-hover">
                <td className="px-4 py-2 font-medium text-foreground">{d.title}</td>
                <td className="px-4 py-2">
                  <select value={d.level}
                    onChange={(e) => handleUpdate(d.id, "level", e.target.value)}
                    className={`text-xs px-2 py-1 rounded-full border-0 ${LEVEL_COLORS[d.level] || ""}`}>
                    {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2 text-muted">{d.department?.name || "-"}</td>
                <td className="px-4 py-2 text-muted">
                  {d.role_id ? (roles.find((r) => r.id === d.role_id)?.name || "—") : "—"}
                </td>
                <td className="px-4 py-2">
                  <button onClick={() => handleDelete(d.id)} className="text-muted hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {designations.length === 0 && !loading && (
              <tr><td colSpan={5} className="py-12 text-center text-muted">No designations yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
