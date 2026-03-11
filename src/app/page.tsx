"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import AuthGuard from "@/components/AuthGuard";
import ModuleCard from "@/components/ModuleCard";

import { useAuth } from "@/contexts/AuthContext";
import { MODULE_REGISTRY } from "@/lib/modules";
import type { Module } from "@/types";
import { apiFetch } from "@/lib/api-fetch";

type ModuleLike = Omit<Module, "id" | "created_at"> | Module;

export default function Home() {
  const { user, role, isAdmin } = useAuth();
  const [modules, setModules] = useState<ModuleLike[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user) {
        setModules([]);
        setLoaded(true);
        return;
      }

      // Admins see all top-level modules
      if (isAdmin) {
        setModules(
          MODULE_REGISTRY.filter((m) => m.parent_slug === null && m.is_active)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        );
        setLoaded(true);
        return;
      }

      try {
        const params = new URLSearchParams();
        if (role) params.set("role_id", role.id);
        params.set("user_id", user.id);
        const res = await apiFetch(`/api/modules/effective?${params.toString()}`);
        const data = await res.json();
        const effective: Module[] = data.modules || [];
        const topLevel = effective.filter((m: Module) => m.parent_slug === null);
        setModules(topLevel);
      } catch {
        // On API failure, show nothing rather than leaking all modules
        setModules([]);
      } finally {
        setLoaded(true);
      }
    }
    load();
  }, [user, role, isAdmin]);

  const displayModules = loaded ? modules : [];

  return (
    <AuthGuard>
      <Shell>
        <div className="p-6 max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground">
              Welcome back{user?.full_name ? `, ${user.full_name}` : ""}
            </h1>
            <p className="text-muted text-sm mt-1">
              Select a module to get started
            </p>
          </div>

          {loaded && displayModules.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted text-sm">
                No modules have been assigned to your account yet.
              </p>
              <p className="text-muted/60 text-xs mt-1">
                Contact your administrator to get access.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 max-w-2xl">
              {displayModules.map((mod, i) => (
                <ModuleCard
                  key={mod.slug}
                  name={mod.name}
                  description={mod.description}
                  icon={mod.icon}
                  href={mod.path}
                  index={i}
                />
              ))}
            </div>
          )}
        </div>
      </Shell>
    </AuthGuard>
  );
}
