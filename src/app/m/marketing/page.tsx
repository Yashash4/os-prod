"use client";

import Shell from "@/components/Shell";
import ModuleCard from "@/components/ModuleCard";
import { MODULE_REGISTRY } from "@/lib/modules";

export default function MarketingPage() {
  const children = MODULE_REGISTRY.filter(
    (m) => m.parent_slug === "marketing" && m.is_active
  );

  return (
    <Shell userName="Yash" onSignOut={() => {}}>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">Marketing</h1>
          <p className="text-muted text-sm mt-1">
            Ad campaigns, analytics, and marketing tools
          </p>
        </div>

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
      </div>
    </Shell>
  );
}
