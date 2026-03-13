"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-fetch";
import type { PermissionMatrix } from "@/types";

interface PermissionsResponse {
  scopeLevel: "admin" | "manager" | "employee" | "client";
  dataVisibility: "all" | "team" | "self";
  canDelete: boolean;
  actions: Record<string, PermissionMatrix>;
}

interface UsePermissionsResult {
  /** Scope level slug for the current user */
  scope: PermissionsResponse["scopeLevel"] | null;
  /** Data visibility tier */
  dataVisibility: PermissionsResponse["dataVisibility"] | null;
  /** Whether the user can delete (admin-only) */
  canDelete: boolean;
  /** Full actions map keyed by sub-module slug */
  actions: Record<string, PermissionMatrix>;
  /** Check if user can perform action on a sub-module */
  canDo: (subModuleSlug: string, action: keyof PermissionMatrix) => boolean;
  /** Loading state */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
}

// Module-level cache to avoid refetching across components using the same parent module
const cache = new Map<string, { data: PermissionsResponse; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches and caches permissions for all sub-modules under a parent module.
 *
 * @param parentModuleSlug — the parent module slug (e.g. "hr", "finance", "tasks")
 */
export function usePermissions(parentModuleSlug: string): UsePermissionsResult {
  const { user, isAdmin } = useAuth();
  const [data, setData] = useState<PermissionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }

    // Admins get full access — skip API call
    if (isAdmin) {
      setData({
        scopeLevel: "admin",
        dataVisibility: "all",
        canDelete: true,
        actions: {},
      });
      setLoading(false);
      return;
    }

    // Check cache
    const cacheKey = `${user.id}:${parentModuleSlug}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    // Avoid duplicate fetches for the same slug in the same component lifecycle
    if (fetchedRef.current === cacheKey) return;
    fetchedRef.current = cacheKey;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    apiFetch(`/api/user/permissions?module=${encodeURIComponent(parentModuleSlug)}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: PermissionsResponse) => {
        cache.set(cacheKey, { data: json, timestamp: Date.now() });
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load permissions");
        setLoading(false);
        fetchedRef.current = null;
      });

    return () => {
      controller.abort();
    };
  }, [user, isAdmin, parentModuleSlug]);

  const canDo = useCallback(
    (subModuleSlug: string, action: keyof PermissionMatrix): boolean => {
      // While loading, deny by default
      if (!data) return false;
      // Admin override
      if (isAdmin || data.scopeLevel === "admin") return true;
      // canDelete is special — admin-only
      if (action === "canDelete") return data.canDelete;
      // Look up the sub-module's permission matrix
      const matrix = data.actions[subModuleSlug];
      if (!matrix) return false;
      return matrix[action] ?? false;
    },
    [data, isAdmin]
  );

  return {
    scope: data?.scopeLevel ?? null,
    dataVisibility: data?.dataVisibility ?? null,
    canDelete: data?.canDelete ?? false,
    actions: data?.actions ?? {},
    canDo,
    loading,
    error,
  };
}

/** Invalidate cached permissions (call after admin changes permissions) */
export function invalidatePermissionsCache(parentModuleSlug?: string) {
  if (parentModuleSlug) {
    for (const key of cache.keys()) {
      if (key.endsWith(`:${parentModuleSlug}`)) cache.delete(key);
    }
  } else {
    cache.clear();
  }
}
