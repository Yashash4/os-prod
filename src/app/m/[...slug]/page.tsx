"use client";

import { use } from "react";
import Shell from "@/components/Shell";
import ModuleCard from "@/components/ModuleCard";
import { getChildrenByParentSlug, MODULE_REGISTRY } from "@/lib/modules";

interface ModulePageProps {
  params: Promise<{ slug: string[] }>;
}

export default function ModulePage({ params }: ModulePageProps) {
  const { slug } = use(params);
  const currentSlug = slug[slug.length - 1];

  const children = getChildrenByParentSlug(currentSlug);
  const currentModule = MODULE_REGISTRY.find((m) => m.slug === currentSlug);

  return (
    <Shell userName="Yash" onSignOut={() => {}}>
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

        {children.length > 0 ? (
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
        ) : (
          <div className="flex items-center justify-center h-64 rounded-lg border border-border bg-surface">
            <p className="text-muted text-sm">
              {currentModule?.name || currentSlug} module — coming soon
            </p>
          </div>
        )}
      </div>
    </Shell>
  );
}
