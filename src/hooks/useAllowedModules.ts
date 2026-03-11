"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-fetch";
import type { Module } from "@/types";

/**
 * Fetches the set of module slugs the current user is allowed to access.
 * Returns an empty set (deny-all) on error or when no role is assigned.
 * Admins get access to everything (returns null = no filtering needed).
 */
export function useAllowedModules() {
  const { user, role, isAdmin } = useAuth();
  const [allowedSlugs, setAllowedSlugs] = useState<Set<string> | null>(null);
  const [allowedPaths, setAllowedPaths] = useState<Set<string> | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setAllowedSlugs(new Set());
      setAllowedPaths(new Set());
      setLoaded(true);
      return;
    }

    if (isAdmin) {
      setAllowedSlugs(null);
      setAllowedPaths(null);
      setLoaded(true);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams();
    if (role) params.set("role_id", role.id);
    params.set("user_id", user.id);

    apiFetch(`/api/modules/effective?${params.toString()}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const modules: Module[] = data.modules || [];
        setAllowedSlugs(new Set(modules.map((m) => m.slug)));
        setAllowedPaths(new Set(modules.map((m) => m.path)));
        setLoaded(true);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setAllowedSlugs(new Set());
        setAllowedPaths(new Set());
        setLoaded(true);
      });

    return () => controller.abort();
  }, [user, role, isAdmin]);

  /** Check if a module slug is allowed. */
  const canAccess = useCallback((slug: string): boolean => {
    if (allowedSlugs === null) return true;
    return allowedSlugs.has(slug);
  }, [allowedSlugs]);

  /** Check if a module path (href) is allowed. */
  const canAccessPath = useCallback((path: string): boolean => {
    if (allowedPaths === null) return true;
    return allowedPaths.has(path);
  }, [allowedPaths]);

  /**
   * Filter sidebar nav items to only show ones the user has access to.
   * Items with separator: true are kept if at least one following non-separator item is allowed.
   */
  const filterNav = useCallback(<T extends { href?: string; separator?: boolean }>(items: T[]): T[] => {
    if (allowedPaths === null) return items; // admin sees all

    const filtered: T[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.separator) {
        // Keep separator only if at least one following item is allowed
        const hasFollowingAllowed = items.slice(i + 1).some(
          (next) => !next.separator && next.href && allowedPaths.has(next.href)
        );
        if (hasFollowingAllowed) filtered.push(item);
      } else if (item.href && allowedPaths.has(item.href)) {
        filtered.push(item);
      }
    }
    return filtered;
  }, [allowedPaths]);

  return { allowedSlugs, allowedPaths, loaded, canAccess, canAccessPath, filterNav, isAdmin };
}
