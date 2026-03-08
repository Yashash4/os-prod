"use client";

import { use, useEffect, useState } from "react";
import Shell from "@/components/Shell";
import AuthGuard from "@/components/AuthGuard";
import ModuleCard from "@/components/ModuleCard";
import { getChildrenByParentSlug, MODULE_REGISTRY } from "@/lib/modules";
import { useAuth } from "@/contexts/AuthContext";
import type { Module } from "@/types";

type ModuleLike = Omit<Module, "id" | "created_at"> | Module;

interface ModulePageProps {
  params: Promise<{ slug: string[] }>;
}

export default function ModulePage({ params }: ModulePageProps) {
  const { slug } = use(params);
  const currentSlug = slug[slug.length - 1];
  const { user, role, isAdmin } = useAuth();
  const [filteredChildren, setFilteredChildren] = useState<ModuleLike[]>([]);
  const [loaded, setLoaded] = useState(false);

  const currentModule = MODULE_REGISTRY.find((m) => m.slug === currentSlug);
  const allChildren = getChildrenByParentSlug(currentSlug);

  useEffect(() => {
    async function load() {
      if (!role || !user) {
        setFilteredChildren(allChildren);
        setLoaded(true);
        return;
      }

      if (isAdmin) {
        setFilteredChildren(allChildren);
        setLoaded(true);
        return;
      }

      try {
        const res = await fetch(`/api/modules/effective?role_id=${role.id}&user_id=${user.id}`);
        const data = await res.json();
        const effective: Module[] = data.modules || [];
        const effectiveSlugs = new Set(effective.map((m: Module) => m.slug));
        const allowed = allChildren.filter((child) => effectiveSlugs.has(child.slug));
        setFilteredChildren(allowed);
      } catch {
        setFilteredChildren(allChildren);
      } finally {
        setLoaded(true);
      }
    }
    load();
  }, [user, role, isAdmin, currentSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthGuard>
      <Shell>
        <div className="p-6 max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground">
              {currentModule?.name || currentSlug}
            </h1>
            {currentModule?.description && (
              <p className="text-muted text-sm mt-1">
                {currentModule.description}
              </p>
            )}
          </div>

          {!loaded ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredChildren.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredChildren.map((mod, i) => (
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
          ) : (
            <div className="flex items-center justify-center h-64 rounded-lg border border-border bg-surface">
              <p className="text-muted text-sm">
                {currentModule?.name || currentSlug} module — coming soon
              </p>
            </div>
          )}
        </div>
      </Shell>
    </AuthGuard>
  );
}
