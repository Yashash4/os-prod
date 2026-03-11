"use client";

import Shell from "@/components/Shell";
import ModuleGuard from "@/components/ModuleGuard";

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleGuard moduleSlug="marketing">
    <Shell>
      <div className="h-[calc(100vh-48px)] overflow-hidden">
        {children}
      </div>
    </Shell>
    </ModuleGuard>
  );
}
