"use client";

import { useEffect, useState, useCallback } from "react";
import { UserPlus, Trash2, Edit3, Check, X } from "lucide-react";
import InviteUserModal from "@/components/admin/InviteUserModal";
import type { Role } from "@/types";
import { apiFetch } from "@/lib/api-fetch";

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: Role | null;
  created_at: string;
}

export default function PeoplePage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editName, setEditName] = useState("");

  const fetchData = useCallback(async () => {
    setFetchError("");
    try {
      const [usersRes, rolesRes] = await Promise.all([
        apiFetch("/api/admin/users"),
        apiFetch("/api/admin/roles"),
      ]);
      const usersData = await usersRes.json();
      const rolesData = await rolesRes.json();
      setUsers(usersData.users || []);
      setRoles(rolesData.roles || []);
    } catch {
      setFetchError("Failed to load users. Please try refreshing the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleDelete(userId: string, name: string) {
    if (!confirm(`Delete user "${name || "this user"}"? This cannot be undone.`)) return;
    try {
      const res = await apiFetch(`/api/admin/users?user_id=${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete user");
      fetchData();
    } catch {
      alert("Failed to delete user. Please try again.");
    }
  }

  function startEdit(user: UserRow) {
    setEditingId(user.id);
    setEditName(user.full_name || "");
    setEditRole(user.role?.id || "");
  }

  async function saveEdit(userId: string) {
    try {
      const res = await apiFetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, full_name: editName, role_id: editRole || null }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setEditingId(null);
      fetchData();
    } catch {
      alert("Failed to save changes. Please try again.");
    }
  }

  function getInitials(name: string | null, email: string) {
    if (name) {
      return name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email?.[0]?.toUpperCase() || "?";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {fetchError && (
        <div className="mb-4 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center justify-between">
          {fetchError}
          <button onClick={fetchData} className="text-xs text-accent hover:underline ml-4">Retry</button>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">People</h1>
          <p className="text-sm text-muted mt-0.5">
            {users.length} team member{users.length !== 1 ? "s" : ""}. Invite users and assign roles.
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-background text-sm rounded-lg hover:bg-accent/90 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Invite User
        </button>
      </div>

      <div className="space-y-2">
        {users.map((user) => (
          <div
            key={user.id}
            className="border border-border rounded-lg p-4 hover:bg-surface-hover/30 transition-colors"
          >
            {editingId === user.id ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-accent">
                    {getInitials(user.full_name, user.email)}
                  </span>
                </div>
                <div className="flex-1 flex items-center gap-3 flex-wrap">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Full name"
                    className="px-3 py-1.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent w-48"
                  />
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="px-3 py-1.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent w-40"
                  >
                    <option value="">No role</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-1">
                    <button onClick={() => saveEdit(user.id)} className="p-1.5 text-green-400 hover:bg-green-400/10 rounded-lg" title="Save">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 text-muted hover:bg-surface-hover rounded-lg" title="Cancel">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-accent">
                      {getInitials(user.full_name, user.email)}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-foreground">
                        {user.full_name || "Unnamed"}
                      </h3>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          user.role
                            ? "bg-accent/10 text-accent"
                            : "bg-surface text-muted"
                        }`}
                      >
                        {user.role?.name || "No role"}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      {user.email}
                      <span className="ml-2 text-foreground/30">
                        · Joined {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(user)}
                    className="p-2 text-muted hover:text-foreground hover:bg-surface-hover rounded-lg transition-colors"
                    title="Edit user"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(user.id, user.full_name || user.email)}
                    className="p-2 text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    title="Delete user"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {users.length === 0 && (
          <div className="text-center py-12 text-muted border border-border rounded-lg">
            No team members yet. Invite someone to get started.
          </div>
        )}
      </div>

      <InviteUserModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onSuccess={fetchData}
        roles={roles}
      />
    </div>
  );
}
