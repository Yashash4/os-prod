"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import AuthGuard from "@/components/AuthGuard";
import ModuleCard from "@/components/ModuleCard";
import { MODULE_REGISTRY } from "@/lib/modules";
import { useAuth } from "@/contexts/AuthContext";
import type { Module } from "@/types";
import { apiFetch } from "@/lib/api-fetch";

type ModuleLike = Omit<Module, "id" | "created_at"> | Module;

export default function Home() {
  const { user, role } = useAuth();
  const [modules, setModules] = useState<ModuleLike[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      if (!role || !user) {
        // No role assigned — show static top-level as fallback
        setModules(
          MODULE_REGISTRY.filter((m) => m.parent_slug === null && m.is_active)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        );
        setLoaded(true);
        return;
      }

      try {
        const res = await apiFetch(`/api/modules/effective?role_id=${role.id}&user_id=${user.id}`);
        const data = await res.json();
        const effective: Module[] = data.modules || [];
        const topLevel = effective.filter((m: Module) => m.parent_slug === null);
        setModules(topLevel);
      } catch {
        setModules(
          MODULE_REGISTRY.filter((m) => m.parent_slug === null && m.is_active)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        );
      } finally {
        setLoaded(true);
      }
    }
    load();
  }, [user, role]);

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
        </div>
      </Shell>
    </AuthGuard>
  );
}
