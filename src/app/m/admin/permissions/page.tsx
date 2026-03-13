"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  Search,
  ChevronsUpDown,
  Loader2,
  Shield,
  Check,
  X,
} from "lucide-react";
import type { Role, Module, ScopeLevel } from "@/types";
import { apiFetch } from "@/lib/api-fetch";
import { invalidatePermissionsCache } from "@/hooks/usePermissions";

interface RoleModule {
  role_id: string;
  module_id: string;
}

interface RoleModulePermission {
  id?: string;
  role_id: string;
  module_id: string;
  can_read: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_approve: boolean;
  can_export: boolean;
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

type Tab = "access" | "permissions" | "users";

interface ModuleNode {
  module: Module;
  children: ModuleNode[];
}

const ACTIONS = ["can_read", "can_create", "can_edit", "can_approve", "can_export"] as const;
const ACTION_LABELS: Record<string, string> = {
  can_read: "Read",
  can_create: "Create",
  can_edit: "Edit",
  can_approve: "Approve",
  can_export: "Export",
};

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

function PermissionCheckbox({
  checked,
  onChange,
  disabled,
  saving,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  saving?: boolean;
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled || saving}
      className={`w-6 h-6 rounded border flex items-center justify-center transition-all ${
        disabled
          ? "opacity-30 cursor-not-allowed border-border"
          : saving
          ? "opacity-60 cursor-wait border-border"
          : checked
          ? "bg-accent border-accent text-white hover:bg-accent/80"
          : "border-border hover:border-accent/50 text-transparent hover:text-accent/30"
      }`}
    >
      {saving ? (
        <Loader2 className="w-3 h-3 animate-spin text-muted" />
      ) : (
        <Check className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

export default function PermissionsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [roleModules, setRoleModules] = useState<RoleModule[]>([]);
  const [roleModulePermissions, setRoleModulePermissions] = useState<RoleModulePermission[]>([]);
  const [scopeLevels, setScopeLevels] = useState<ScopeLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("permissions");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

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
      setRoleModulePermissions(data.roleModulePermissions || []);
      setScopeLevels(data.scopeLevels || []);
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
    if (!userId) {
      setUserOverrides([]);
      return;
    }
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

  function getPermission(moduleId: string): RoleModulePermission | null {
    return (
      roleModulePermissions.find(
        (rmp) => rmp.role_id === selectedRoleId && rmp.module_id === moduleId
      ) || null
    );
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  function collectExpandableSlugs(nodes: ModuleNode[]): string[] {
    const result: string[] = [];
    for (const node of nodes) {
      if (node.children.length > 0) {
        result.push(node.module.slug);
        result.push(...collectExpandableSlugs(node.children));
      }
    }
    return result;
  }

  function expandAll() {
    setExpandedSlugs(new Set(collectExpandableSlugs(tree)));
  }

  function collapseAll() {
    setExpandedSlugs(new Set());
  }

  async function bulkToggleAll(action: "grant" | "revoke") {
    if (!selectedRoleId || bulkSaving) return;

    const modulesToChange = modules.filter((m) => {
      const currentlyEnabled = hasAccess(m.id);
      return action === "grant" ? !currentlyEnabled : currentlyEnabled;
    });

    if (modulesToChange.length === 0) {
      showToast(
        action === "grant"
          ? "All modules already enabled"
          : "All modules already disabled"
      );
      return;
    }

    setBulkSaving(true);
    const ids = new Set(modulesToChange.map((m) => m.id));
    setSaving((prev) => new Set([...prev, ...ids]));

    if (action === "grant") {
      setRoleModules((prev) => [
        ...prev,
        ...modulesToChange.map((m) => ({
          role_id: selectedRoleId,
          module_id: m.id,
        })),
      ]);
    } else {
      setRoleModules((prev) =>
        prev.filter(
          (rm) => !(rm.role_id === selectedRoleId && ids.has(rm.module_id))
        )
      );
    }

    const results = await Promise.allSettled(
      modulesToChange.map((m) =>
        apiFetch("/api/admin/permissions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role_id: selectedRoleId,
            module_id: m.id,
            action,
          }),
        })
      )
    );

    const failed = results.filter(
      (r) =>
        r.status === "rejected" ||
        (r.status === "fulfilled" && !r.value.ok)
    );
    if (failed.length > 0) {
      showToast(`${failed.length} module(s) failed — refreshing`);
      fetchPermissions();
    } else {
      showToast(action === "grant" ? "All modules enabled" : "All modules disabled");
    }

    setSaving((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    setBulkSaving(false);
  }

  async function toggleRoleModule(moduleId: string) {
    const mod = modules.find((m) => m.id === moduleId);
    const enabled = !hasAccess(moduleId);
    setSaving((prev) => new Set(prev).add(moduleId));

    if (enabled) {
      setRoleModules((prev) => [
        ...prev,
        { role_id: selectedRoleId, module_id: moduleId },
      ]);
    } else {
      setRoleModules((prev) =>
        prev.filter(
          (rm) => !(rm.role_id === selectedRoleId && rm.module_id === moduleId)
        )
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
      fetchPermissions();
    }
  }

  async function togglePermission(
    moduleId: string,
    action: (typeof ACTIONS)[number]
  ) {
    const savingKey = `${moduleId}:${action}`;
    setSaving((prev) => new Set(prev).add(savingKey));

    const existing = getPermission(moduleId);
    const currentValue = existing ? existing[action] : false;
    const newValue = !currentValue;

    // Optimistic update
    setRoleModulePermissions((prev) => {
      const idx = prev.findIndex(
        (rmp) => rmp.role_id === selectedRoleId && rmp.module_id === moduleId
      );
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], [action]: newValue };
        return updated;
      }
      return [
        ...prev,
        {
          role_id: selectedRoleId,
          module_id: moduleId,
          can_read: action === "can_read" ? newValue : false,
          can_create: action === "can_create" ? newValue : false,
          can_edit: action === "can_edit" ? newValue : false,
          can_approve: action === "can_approve" ? newValue : false,
          can_export: action === "can_export" ? newValue : false,
        },
      ];
    });

    const base = existing
      ? { can_read: existing.can_read, can_create: existing.can_create, can_edit: existing.can_edit, can_approve: existing.can_approve, can_export: existing.can_export }
      : { can_read: false, can_create: false, can_edit: false, can_approve: false, can_export: false };
    const payload: Record<string, unknown> = {
      type: "permission_matrix",
      role_id: selectedRoleId,
      module_id: moduleId,
      ...base,
      [action]: newValue,
    };

    const res = await apiFetch("/api/admin/permissions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving((prev) => {
      const next = new Set(prev);
      next.delete(savingKey);
      return next;
    });

    if (res.ok) {
      invalidatePermissionsCache();
    } else {
      showToast("Failed to save — please retry");
      fetchPermissions();
    }
  }

  function getOverride(moduleId: string): "grant" | "revoke" | null {
    return (
      userOverrides.find((uo) => uo.module_id === moduleId)?.access_type ||
      null
    );
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
        res = await apiFetch(
          `/api/admin/permissions?user_id=${selectedUserId}&module_id=${moduleId}`,
          { method: "DELETE" }
        );
      } else if (roleHas) {
        res = await apiFetch("/api/admin/permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: selectedUserId,
            module_id: moduleId,
            access_type: "revoke",
          }),
        });
      } else {
        res = await apiFetch("/api/admin/permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: selectedUserId,
            module_id: moduleId,
            access_type: "grant",
          }),
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

  // --- Render helpers ---

  function renderAccessRow(node: ModuleNode, depth: number) {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedSlugs.has(node.module.slug);
    const isSaving = saving.has(node.module.id);
    const matchesSearch =
      !search || node.module.name.toLowerCase().includes(search.toLowerCase());
    const childMatchesSearch =
      !search ||
      node.children.some((c) =>
        c.module.name.toLowerCase().includes(search.toLowerCase())
      );
    if (search && !matchesSearch && !childMatchesSearch) return null;

    const isAdminRole = selectedRole?.is_admin === true;
    const enabled = isAdminRole ? true : hasAccess(node.module.id);

    return (
      <div key={node.module.id}>
        <div
          className={`flex items-center gap-3 py-2 px-3 border-b border-border/50 hover:bg-surface-hover/30 transition-colors ${
            depth === 0 ? "bg-surface/30" : ""
          }`}
          style={{ paddingLeft: `${12 + depth * 20}px` }}
        >
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
          <Toggle
            enabled={enabled}
            onToggle={() => toggleRoleModule(node.module.id)}
            disabled={isSaving || isAdminRole}
          />
          <span
            className={`text-sm flex-1 min-w-0 ${
              depth === 0
                ? "font-medium text-foreground"
                : "text-muted"
            } ${enabled ? "" : "opacity-60"}`}
          >
            {node.module.name}
          </span>
        </div>
        {isExpanded &&
          hasChildren &&
          node.children
            .sort((a, b) => a.module.order - b.module.order)
            .map((child) => renderAccessRow(child, depth + 1))}
      </div>
    );
  }

  function renderPermissionRow(node: ModuleNode, depth: number) {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedSlugs.has(node.module.slug);
    const matchesSearch =
      !search || node.module.name.toLowerCase().includes(search.toLowerCase());
    const childMatchesSearch =
      !search ||
      node.children.some((c) =>
        c.module.name.toLowerCase().includes(search.toLowerCase())
      );
    if (search && !matchesSearch && !childMatchesSearch) return null;

    const isAdminRole = selectedRole?.is_admin === true;
    const perm = getPermission(node.module.id);

    return (
      <div key={node.module.id}>
        <div
          className={`flex items-center gap-2 py-2 px-3 border-b border-border/50 hover:bg-surface-hover/30 transition-colors ${
            depth === 0 ? "bg-surface/30" : ""
          }`}
          style={{ paddingLeft: `${12 + depth * 20}px` }}
        >
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
          <span
            className={`text-sm min-w-0 w-44 flex-shrink-0 truncate ${
              depth === 0 ? "font-medium text-foreground" : "text-muted"
            }`}
          >
            {node.module.name}
          </span>
          <div className="flex items-center gap-4 ml-auto">
            {ACTIONS.map((action) => (
              <div
                key={action}
                className="w-14 flex items-center justify-center"
              >
                <PermissionCheckbox
                  checked={isAdminRole ? true : perm?.[action] ?? false}
                  onChange={() => togglePermission(node.module.id, action)}
                  disabled={isAdminRole}
                  saving={saving.has(`${node.module.id}:${action}`)}
                />
              </div>
            ))}
          </div>
        </div>
        {isExpanded &&
          hasChildren &&
          node.children
            .sort((a, b) => a.module.order - b.module.order)
            .map((child) => renderPermissionRow(child, depth + 1))}
      </div>
    );
  }

  function renderUserRow(node: ModuleNode, depth: number) {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedSlugs.has(node.module.slug);
    const isSaving = saving.has(node.module.id);
    const matchesSearch =
      !search || node.module.name.toLowerCase().includes(search.toLowerCase());
    const childMatchesSearch =
      !search ||
      node.children.some((c) =>
        c.module.name.toLowerCase().includes(search.toLowerCase())
      );
    if (search && !matchesSearch && !childMatchesSearch) return null;

    const override = getOverride(node.module.id);
    const roleHas = getUserRoleAccess(node.module.id);
    const enabled =
      override === "grant" ? true : override === "revoke" ? false : roleHas;
    const ring =
      override === "grant" ? "green" : override === "revoke" ? "red" : null;

    return (
      <div key={node.module.id}>
        <div
          className={`flex items-center gap-3 py-2 px-3 border-b border-border/50 hover:bg-surface-hover/30 transition-colors ${
            depth === 0 ? "bg-surface/30" : ""
          }`}
          style={{ paddingLeft: `${12 + depth * 20}px` }}
        >
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
          <Toggle
            enabled={enabled}
            onToggle={() => toggleUserOverride(node.module.id)}
            disabled={isSaving}
            ring={ring}
          />
          <span
            className={`text-sm flex-1 min-w-0 ${
              depth === 0 ? "font-medium text-foreground" : "text-muted"
            } ${enabled ? "" : "opacity-60"}`}
          >
            {node.module.name}
          </span>
          {ring && (
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
        {isExpanded &&
          hasChildren &&
          node.children
            .sort((a, b) => a.module.order - b.module.order)
            .map((child) => renderUserRow(child, depth + 1))}
      </div>
    );
  }

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const selectedUser = users.find((u) => u.id === selectedUserId);
  const enabledCount = roleModules.filter(
    (rm) => rm.role_id === selectedRoleId
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Permissions</h1>
        <p className="text-sm text-muted mt-0.5">
          Control module access, action-level permissions, and user overrides
        </p>
      </div>

      {/* Scope Levels legend */}
      {scopeLevels.length > 0 && (
        <div className="mb-6 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted uppercase tracking-wider flex items-center gap-1">
            <Shield className="w-3 h-3" /> Scope Levels
          </span>
          {scopeLevels.map((sl) => (
            <span
              key={sl.id}
              className={`text-[10px] px-2 py-1 rounded font-medium uppercase tracking-wider ${
                sl.slug === "admin"
                  ? "bg-accent/15 text-accent"
                  : sl.slug === "manager"
                  ? "bg-blue-500/15 text-blue-400"
                  : sl.slug === "client"
                  ? "bg-purple-500/15 text-purple-400"
                  : "bg-surface-hover text-muted"
              }`}
            >
              {sl.name} — {sl.data_visibility}
              {sl.can_delete ? " + delete" : ""}
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface border border-border rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("access")}
          className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
            tab === "access"
              ? "bg-accent/10 text-accent"
              : "text-muted hover:text-foreground"
          }`}
        >
          Module Access
        </button>
        <button
          onClick={() => setTab("permissions")}
          className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
            tab === "permissions"
              ? "bg-accent/10 text-accent"
              : "text-muted hover:text-foreground"
          }`}
        >
          Permission Matrix
        </button>
        <button
          onClick={() => setTab("users")}
          className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
            tab === "users"
              ? "bg-accent/10 text-accent"
              : "text-muted hover:text-foreground"
          }`}
        >
          User Overrides
        </button>
      </div>

      {/* Role selector (shared by access & permissions tabs) */}
      {(tab === "access" || tab === "permissions") && (
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
                  {r.name}
                  {r.description ? ` — ${r.description}` : ""}
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
        </>
      )}

      {/* Module Access tab (ON/OFF toggles) */}
      {tab === "access" && selectedRole && (
        <div className="border border-border rounded-lg overflow-hidden">
          {selectedRole.is_admin && (
            <div className="bg-accent/10 border-b border-accent/20 px-4 py-2.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
              <span className="text-xs text-accent">
                Admin roles have access to all modules by default
              </span>
            </div>
          )}
          <div className="bg-surface px-4 py-3 border-b border-border flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground flex-shrink-0">
              Modules for {selectedRole.name}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={expandAll}
                className="text-xs text-muted hover:text-foreground transition-colors flex items-center gap-1"
              >
                <ChevronsUpDown className="w-3 h-3" />
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="text-xs text-muted hover:text-foreground transition-colors flex items-center gap-1"
              >
                <ChevronsUpDown className="w-3 h-3 rotate-90" />
                Collapse All
              </button>
              <span className="text-border">|</span>
              {!selectedRole.is_admin && (
                <>
                  <button
                    onClick={() => bulkToggleAll("grant")}
                    disabled={bulkSaving}
                    className="text-xs text-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {bulkSaving ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : null}
                    Enable All
                  </button>
                  <button
                    onClick={() => bulkToggleAll("revoke")}
                    disabled={bulkSaving}
                    className="text-xs text-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {bulkSaving ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : null}
                    Disable All
                  </button>
                  <span className="text-border">|</span>
                </>
              )}
              <span className="text-xs text-muted">
                {selectedRole.is_admin ? modules.length : enabledCount} of{" "}
                {modules.length} enabled
              </span>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {tree.map((node) => renderAccessRow(node, 0))}
          </div>
        </div>
      )}

      {/* Permission Matrix tab */}
      {tab === "permissions" && selectedRole && (
        <div className="border border-border rounded-lg overflow-hidden">
          {selectedRole.is_admin && (
            <div className="bg-accent/10 border-b border-accent/20 px-4 py-2.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
              <span className="text-xs text-accent">
                Admin roles have all permissions by default. Delete is always
                admin-only.
              </span>
            </div>
          )}
          <div className="bg-surface px-4 py-3 border-b border-border flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground flex-shrink-0">
              Action permissions for {selectedRole.name}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={expandAll}
                className="text-xs text-muted hover:text-foreground transition-colors flex items-center gap-1"
              >
                <ChevronsUpDown className="w-3 h-3" />
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="text-xs text-muted hover:text-foreground transition-colors flex items-center gap-1"
              >
                <ChevronsUpDown className="w-3 h-3 rotate-90" />
                Collapse All
              </button>
            </div>
          </div>
          {/* Column headers */}
          <div className="flex items-center gap-2 py-2 px-3 bg-surface/60 border-b border-border text-[10px] uppercase tracking-wider text-muted">
            <div className="w-5 flex-shrink-0" />
            <div className="w-44 flex-shrink-0">Module</div>
            <div className="flex items-center gap-4 ml-auto">
              {ACTIONS.map((action) => (
                <div
                  key={action}
                  className="w-14 text-center"
                >
                  {ACTION_LABELS[action]}
                </div>
              ))}
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {tree.map((node) => renderPermissionRow(node, 0))}
          </div>
          <div className="bg-surface/60 px-4 py-2.5 border-t border-border flex items-center gap-2">
            <X className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs text-muted">
              Delete permission is admin-only and not configurable in the matrix
            </span>
          </div>
        </div>
      )}

      {/* User Overrides tab */}
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
                  {u.full_name || u.email}
                  {u.role ? ` (${u.role.name})` : " (No role)"}
                </option>
              ))}
            </select>
          </div>

          {selectedUser && (
            <>
              <p className="text-xs text-muted mb-4">
                Toggle to override{" "}
                {selectedUser.full_name || selectedUser.email}&apos;s role
                permissions. Colored rings indicate manual overrides.
              </p>
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-surface px-4 py-3 border-b border-border flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    Module access for{" "}
                    {selectedUser.full_name || selectedUser.email}
                  </span>
                  <span className="text-xs text-muted">
                    Role: {selectedUser.role?.name || "None"}
                    {userOverrides.length > 0 &&
                      ` · ${userOverrides.length} override${
                        userOverrides.length > 1 ? "s" : ""
                      }`}
                  </span>
                </div>
                <div className="max-h-[60vh] overflow-y-auto">
                  {tree.map((node) => renderUserRow(node, 0))}
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
