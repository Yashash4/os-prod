"use client";

import { useEffect, useState, useCallback } from "react";
import { Building2, Plus, Loader2, Pencil, Trash2, Users } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

interface Department {
  id: string;
  name: string;
  description: string | null;
  head_employee_id: string | null;
  head: { id: string; full_name: string } | null;
  is_active: boolean;
  employee_count: number;
  created_at: string;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/hr/departments");
      const data = await res.json();
      setDepartments(data.departments || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAdd() {
    if (!formName.trim()) return;
    await apiFetch("/api/hr/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formName.trim(), description: formDesc.trim() || null }),
    });
    setFormName(""); setFormDesc(""); setShowForm(false);
    fetchData();
  }

  async function handleSave() {
    if (!editId || !formName.trim()) return;
    await apiFetch("/api/hr/departments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editId, name: formName.trim(), description: formDesc.trim() || null }),
    });
    setEditId(null); setFormName(""); setFormDesc("");
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this department?")) return;
    await apiFetch(`/api/hr/departments?id=${id}`, { method: "DELETE" });
    fetchData();
  }

  function startEdit(d: Department) {
    setEditId(d.id);
    setFormName(d.name);
    setFormDesc(d.description || "");
    setShowForm(false);
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold">Departments</h1>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditId(null); setFormName(""); setFormDesc(""); }}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Department
        </button>
      </div>

      {(showForm || editId) && (
        <div className="card border border-border rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-medium">{editId ? "Edit Department" : "New Department"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text" placeholder="Name" value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="bg-background/50 border border-border rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text" placeholder="Description" value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              className="bg-background/50 border border-border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={editId ? handleSave : handleAdd}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">
              {editId ? "Save" : "Add"}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); }}
              className="px-4 py-2 border border-border rounded-lg text-sm text-muted hover:text-foreground transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((d) => (
          <div key={d.id} className="card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-foreground">{d.name}</h3>
                {d.description && <p className="text-xs text-muted mt-0.5">{d.description}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(d)} className="text-muted hover:text-accent p-1">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(d.id)} className="text-muted hover:text-red-400 p-1">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-muted">
                <Users className="w-3.5 h-3.5" />
                <span>{d.employee_count} {d.employee_count === 1 ? "employee" : "employees"}</span>
              </div>
            </div>
            {d.head && (
              <p className="text-xs text-muted">
                Head: <span className="text-foreground">{d.head.full_name}</span>
              </p>
            )}
          </div>
        ))}
        {departments.length === 0 && !loading && (
          <p className="text-muted text-sm col-span-full text-center py-12">No departments yet</p>
        )}
      </div>
    </div>
  );
}
