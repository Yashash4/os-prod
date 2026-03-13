"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Edit3, Check, X, Shield } from "lucide-react";
import type { Role } from "@/types";
import { apiFetch } from "@/lib/api-fetch";
import PermissionGate from "@/components/PermissionGate";

interface RoleWithCount extends Role {
  user_count: number;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await apiFetch("/api/admin/roles");
      const data = await res.json();
      setRoles(data.roles || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError("");
    const res = await apiFetch("/api/admin/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, description: newDesc, is_admin: newIsAdmin }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setShowAdd(false);
    setNewName("");
    setNewDesc("");
    setNewIsAdmin(false);
    fetchRoles();
  }

  async function handleSave(id: string) {
    setError("");
    const res = await apiFetch("/api/admin/roles", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editName, description: editDesc, is_admin: editIsAdmin }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setEditingId(null);
    fetchRoles();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}" role? Users assigned to it will lose access.`)) return;
    setError("");
    const res = await apiFetch(`/api/admin/roles?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    fetchRoles();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Roles</h1>
          <p className="text-sm text-muted mt-0.5">
            {roles.length} role{roles.length !== 1 ? "s" : ""} defined.
            Assign module permissions under Permissions tab.
          </p>
        </div>
        <PermissionGate module="admin" subModule="admin-roles" action="canCreate">
          <button
            onClick={() => { setShowAdd(true); setError(""); }}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-background text-sm rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Role
          </button>
        </PermissionGate>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Add role modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAdd(false)} />
          <div className="relative bg-surface border border-border rounded-xl shadow-xl w-full max-w-md p-6">
            <button onClick={() => setShowAdd(false)} className="absolute top-4 right-4 text-muted hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-semibold text-foreground mb-4">Create New Role</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm text-muted mb-1">Role Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Manager, Sales, Intern"
                  required
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Description</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Brief description of this role"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newIsAdmin}
                  onChange={(e) => setNewIsAdmin(e.target.checked)}
                  className="rounded border-border bg-background text-accent focus:ring-accent"
                />
                <span className="text-sm text-muted">Admin access (can manage users, roles & permissions)</span>
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-accent text-background rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  {saving ? "Creating..." : "Create Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Roles list */}
      <div className="space-y-3">
        {roles.map((role) => (
          <div
            key={role.id}
            className="border border-border rounded-lg p-4 hover:bg-surface-hover/30 transition-colors"
          >
            {editingId === role.id ? (
              <div className="space-y-3">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
                />
                <input
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsAdmin}
                    onChange={(e) => setEditIsAdmin(e.target.checked)}
                    className="rounded border-border bg-background text-accent focus:ring-accent"
                  />
                  <span className="text-sm text-muted">Admin access</span>
                </label>
                <div className="flex gap-2">
                  <button onClick={() => handleSave(role.id)} className="px-3 py-1.5 text-sm bg-accent text-background rounded-lg">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-sm text-muted hover:text-foreground border border-border rounded-lg">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-accent/8 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                      {role.name}
                      {role.is_admin && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20 font-medium">
                          Admin
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      {role.description || "No description"}
                      <span className="ml-2 text-foreground/40">
                        · {role.user_count} user{role.user_count !== 1 ? "s" : ""}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <PermissionGate module="admin" subModule="admin-roles" action="canEdit">
                    <button
                      onClick={() => {
                        setEditingId(role.id);
                        setEditName(role.name);
                        setEditDesc(role.description || "");
                        setEditIsAdmin(role.is_admin || false);
                      }}
                      className="p-2 text-muted hover:text-foreground hover:bg-surface-hover rounded-lg transition-colors"
                      title="Edit role"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </PermissionGate>
                  {!role.is_admin && (
                    <PermissionGate module="admin" subModule="admin-roles" action="canDelete">
                      <button
                        onClick={() => handleDelete(role.id, role.name)}
                        className="p-2 text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="Delete role"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </PermissionGate>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {roles.length === 0 && (
          <div className="text-center py-12 text-muted">
            No roles defined. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
