"use client";

import Shell from "@/components/Shell";
import AuthGuard from "@/components/AuthGuard";
import ModuleCard from "@/components/ModuleCard";
import { getChildrenByParentSlug } from "@/lib/modules";
import { useAllowedModules } from "@/hooks/useAllowedModules";

export default function SalesPage() {
  const allChildren = getChildrenByParentSlug("sales");
  const { allowedSlugs, loaded } = useAllowedModules();

  const children = allowedSlugs
    ? allChildren.filter((m) => allowedSlugs.has(m.slug))
    : allChildren;

  return (
    <AuthGuard>
      <Shell>
        <div className="p-6 max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground">Sales</h1>
            <p className="text-muted text-sm mt-1">
              Sales pipeline, CRM, and revenue tracking
            </p>
          </div>

          {loaded && children.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted text-sm">No sub-modules available for your role.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {children.map((mod, i) => (
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
