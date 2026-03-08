"use client";

import ModuleCard from "@/components/ModuleCard";
import { getChildrenByParentSlug, MODULE_REGISTRY } from "@/lib/modules";

export default function SocialPage() {
  const currentModule = MODULE_REGISTRY.find((m) => m.slug === "content-social");
  const children = getChildrenByParentSlug("content-social");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">
          {currentModule?.name || "Social Media"}
        </h1>
        <p className="text-muted text-sm mt-1">
          {currentModule?.description || "Social media content management"}
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
  );
}
