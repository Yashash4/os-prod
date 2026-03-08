"use client";

import Shell from "@/components/Shell";
import ModuleCard from "@/components/ModuleCard";
import { getChildrenByParentSlug } from "@/lib/modules";

export default function PaymentsPage() {
  const children = getChildrenByParentSlug("payments");

  return (
    <Shell>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">Payments</h1>
          <p className="text-muted text-sm mt-1">
            Payment tracking, settlements & revenue analytics
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
