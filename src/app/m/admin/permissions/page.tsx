"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronRight, ChevronDown, Search } from "lucide-react";
import type { Role, Module } from "@/types";
import { apiFetch } from "@/lib/api-fetch";

interface RoleModule {
  role_id: string;
  module_id: string;
}

interface UserForOverride {
  id: string;
  email: string;
  full_name: string | null;
  role: Role | null;
}

interface UserOverride {
  user_id: string;
  module_id: string;
  access_type: "grant" | "revoke";
}

type Tab = "roles" | "users";

interface ModuleNode {
  module: Module;
  children: ModuleNode[];
}

function buildTree(modules: Module[]): ModuleNode[] {
  const map = new Map<string, ModuleNode>();
  const roots: ModuleNode[] = [];

  for (const m of modules) {
    map.set(m.slug, { module: m, children: [] });
  }
  for (const m of modules) {
    const node = map.get(m.slug)!;
    if (m.parent_slug && map.has(m.parent_slug)) {
      map.get(m.parent_slug)!.children.push(node);
    } else if (!m.parent_slug) {
      roots.push(node);
    }
  }
  return roots;
}

function Toggle({
  enabled,
  onToggle,
  disabled,
  ring,
}: {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
  ring?: "green" | "red" | null;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
        enabled ? "bg-accent" : "bg-border"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${
        ring === "green"
          ? "ring-2 ring-green-500/40"
          : ring === "red"
          ? "ring-2 ring-red-500/40"
          : ""
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
          enabled ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function PermissionsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [roleModules, setRoleModules] = useState<RoleModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("roles");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const [users, setUsers] = useState<UserForOverride[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userOverrides, setUserOverrides] = useState<UserOverride[]>([]);

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await apiFetch("/api/admin/permissions");
      const data = await res.json();
      setRoles(data.roles || []);
      setModules(data.modules || []);
      setRoleModules(data.roleModules || []);
      setSelectedRoleId((prev) => {
        if (!prev && data.roles?.length) return data.roles[0].id;
        return prev;
      });
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiFetch("/api/admin/users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      // silently fail
    }
  }, []);

  const fetchUserOverrides = useCallback(async (userId: string) => {
    if (!userId) { setUserOverrides([]); return; }
    try {
      const res = await apiFetch(`/api/admin/permissions?user_id=${userId}`);
      const data = await res.json();
      setUserOverrides(data.userOverrides || []);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
    fetchUsers();
  }, [fetchPermissions, fetchUsers]);

  useEffect(() => {
    if (selectedUserId) fetchUserOverrides(selectedUserId);
  }, [selectedUserId, fetchUserOverrides]);

  const tree = buildTree(modules);

  // Expand all top-level on first load
  useEffect(() => {
    if (tree.length > 0 && expandedSlugs.size === 0) {
      setExpandedSlugs(new Set(tree.map((n) => n.module.slug)));
    }
  }, [tree, expandedSlugs.size]);

  function toggleExpand(slug: string) {
    setExpandedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function hasAccess(moduleId: string) {
    return roleModules.some(
      (rm) => rm.role_id === selectedRoleId && rm.module_id === moduleId
    );
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  async function toggleRoleModule(moduleId: string) {
    const mod = modules.find((m) => m.id === moduleId);
    const enabled = !hasAccess(moduleId);
    setSaving((prev) => new Set(prev).add(moduleId));

    // Optimistic update
    if (enabled) {
      setRoleModules((prev) => [...prev, { role_id: selectedRoleId, module_id: moduleId }]);
    } else {
      setRoleModules((prev) =>
        prev.filter((rm) => !(rm.role_id === selectedRoleId && rm.module_id === moduleId))
      );
    }

    const res = await apiFetch("/api/admin/permissions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role_id: selectedRoleId,
        module_id: moduleId,
        action: enabled ? "grant" : "revoke",
      }),
    });

    setSaving((prev) => {
      const next = new Set(prev);
      next.delete(moduleId);
      return next;
    });

    if (res.ok) {
      showToast(`${mod?.name || "Module"} ${enabled ? "enabled" : "disabled"}`);
    } else {
      showToast("Failed to save — please retry");
      // Revert optimistic update
      fetchPermissions();
    }
  }

  function getOverride(moduleId: string): "grant" | "revoke" | null {
    return userOverrides.find((uo) => uo.module_id === moduleId)?.access_type || null;
  }

  function getUserRoleAccess(moduleId: string): boolean {
    const user = users.find((u) => u.id === selectedUserId);
    if (!user?.role) return false;
    return roleModules.some(
      (rm) => rm.role_id === user.role!.id && rm.module_id === moduleId
    );
  }

  async function toggleUserOverride(moduleId: string) {
    const current = getOverride(moduleId);
    const roleHas = getUserRoleAccess(moduleId);

    setSaving((prev) => new Set(prev).add(moduleId));

    try {
      let res: Response;
      if (current) {
        res = await apiFetch(`/api/admin/permissions?user_id=${selectedUserId}&module_id=${moduleId}`, { method: "DELETE" });
      } else if (roleHas) {
        res = await apiFetch("/api/admin/permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: selectedUserId, module_id: moduleId, access_type: "revoke" }),
        });
      } else {
        res = await apiFetch("/api/admin/permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: selectedUserId, module_id: moduleId, access_type: "grant" }),
        });
      }

      if (!res.ok) throw new Error("Failed to update override");

      fetchUserOverrides(selectedUserId);
      const mod = modules.find((m) => m.id === moduleId);
      showToast(`${mod?.name || "Module"} override updated`);
    } catch {
      showToast("Failed to save — please retry");
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(moduleId);
        return next;
      });
    }
  }

  function renderModuleRow(node: ModuleNode, depth: number, mode: "role" | "user") {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedSlugs.has(node.module.slug);
    const isSaving = saving.has(node.module.id);

    const matchesSearch =
      !search ||
      node.module.name.toLowerCase().includes(search.toLowerCase());

    const childMatchesSearch =
      !search ||
      node.children.some((c) =>
        c.module.name.toLowerCase().includes(search.toLowerCase())
      );

    if (search && !matchesSearch && !childMatchesSearch) return null;

    let enabled = false;
    let ring: "green" | "red" | null = null;
    let onToggle: () => void;

    if (mode === "role") {
      enabled = hasAccess(node.module.id);
      onToggle = () => toggleRoleModule(node.module.id);
    } else {
      const override = getOverride(node.module.id);
      const roleHas = getUserRoleAccess(node.module.id);
      enabled = override === "grant" ? true : override === "revoke" ? false : roleHas;
      ring = override === "grant" ? "green" : override === "revoke" ? "red" : null;
      onToggle = () => toggleUserOverride(node.module.id);
    }

    return (
      <div key={node.module.id}>
        <div
          className={`flex items-center gap-3 py-2 px-3 border-b border-border/50 hover:bg-surface-hover/30 transition-colors ${
            depth === 0 ? "bg-surface/30" : ""
          }`}
          style={{ paddingLeft: `${12 + depth * 20}px` }}
        >
          {/* Expand/collapse */}
          <div className="w-5 flex-shrink-0">
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(node.module.slug)}
                className="p-0.5 text-muted hover:text-foreground"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : null}
          </div>

          {/* Toggle */}
          <Toggle
            enabled={enabled}
            onToggle={onToggle}
            disabled={isSaving}
            ring={ring}
          />

          {/* Label */}
          <span
            className={`text-sm flex-1 min-w-0 ${
              depth === 0
                ? "font-medium text-foreground"
                : "text-muted"
            } ${enabled ? "" : "opacity-60"}`}
          >
            {node.module.name}
          </span>

          {/* Override badge */}
          {mode === "user" && ring && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                ring === "green"
                  ? "bg-green-500/15 text-green-400"
                  : "bg-red-500/15 text-red-400"
              }`}
            >
              {ring === "green" ? "override: granted" : "override: revoked"}
            </span>
          )}
        </div>

        {/* Children */}
        {isExpanded &&
          hasChildren &&
          node.children
            .sort((a, b) => a.module.order - b.module.order)
            .map((child) => renderModuleRow(child, depth + 1, mode))}
      </div>
    );
  }

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const selectedUser = users.find((u) => u.id === selectedUserId);
  const enabledCount = roleModules.filter((rm) => rm.role_id === selectedRoleId).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Permissions</h1>
        <p className="text-sm text-muted mt-0.5">
          Control which modules each role or user can access
        </p>
      </div>

      <div className="flex gap-1 mb-6 bg-surface border border-border rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("roles")}
          className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
            tab === "roles" ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"
          }`}
        >
          Role Permissions
        </button>
        <button
          onClick={() => setTab("users")}
          className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
            tab === "users" ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"
          }`}
        >
          User Overrides
        </button>
      </div>

      {tab === "roles" && (
        <>
          <div className="mb-4">
            <label className="block text-xs text-muted uppercase tracking-wider mb-2">
              User Role
            </label>
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:border-accent w-full max-w-sm"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}{r.description ? ` — ${r.description}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search modules..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:border-accent"
            />
          </div>

          {selectedRole && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-surface px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  Modules for {selectedRole.name}
                </span>
                <span className="text-xs text-muted">
                  {enabledCount} of {modules.length} enabled
                </span>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {tree.map((node) => renderModuleRow(node, 0, "role"))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === "users" && (
        <>
          <div className="mb-4">
            <label className="block text-xs text-muted uppercase tracking-wider mb-2">
              Select User
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:border-accent w-full max-w-sm"
            >
              <option value="">Choose a user...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email}{u.role ? ` (${u.role.name})` : " (No role)"}
                </option>
              ))}
            </select>
          </div>

          {selectedUser && (
            <>
              <p className="text-xs text-muted mb-4">
                Toggle to override {selectedUser.full_name || selectedUser.email}&apos;s role permissions.
                Colored rings indicate manual overrides.
              </p>
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-surface px-4 py-3 border-b border-border flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    Module access for {selectedUser.full_name || selectedUser.email}
                  </span>
                  <span className="text-xs text-muted">
                    Role: {selectedUser.role?.name || "None"}
                    {userOverrides.length > 0 &&
                      ` · ${userOverrides.length} override${userOverrides.length > 1 ? "s" : ""}`}
                  </span>
                </div>
                <div className="max-h-[60vh] overflow-y-auto">
                  {tree.map((node) => renderModuleRow(node, 0, "user"))}
                </div>
              </div>
            </>
          )}
        </>
      )}
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-surface border border-border rounded-lg px-4 py-2.5 shadow-lg text-sm text-foreground animate-in fade-in slide-in-from-bottom-2 z-50 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
          {toast}
        </div>
      )}
    </div>
  );
}
