"use client";

import Shell from "@/components/Shell";
import ModuleCard from "@/components/ModuleCard";
import { MODULE_REGISTRY } from "@/lib/modules";

export default function Home() {
  const topLevelModules = MODULE_REGISTRY.filter(
    (m) => m.parent_slug === null && m.is_active
  );

  return (
    <Shell userName="Yash" onSignOut={() => {}}>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">
            Welcome back
          </h1>
          <p className="text-muted text-sm mt-1">
            Select a module to get started
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 max-w-2xl">
          {topLevelModules.map((mod, i) => (
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
  );
}
