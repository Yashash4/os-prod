"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import Shell from "@/components/Shell";
import { ClipboardList, Calendar, DollarSign, BarChart3, FileSpreadsheet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ModuleGuard from "@/components/ModuleGuard";
import { useAllowedModules } from "@/hooks/useAllowedModules";

interface NavItem {
  name: string;
  subPath: string;
  icon: LucideIcon | null;
  separator?: boolean;
}

const REP_NAV: NavItem[] = [
  { name: "Meet Management", subPath: "meet-management", icon: ClipboardList },
  { name: "Sales Management", subPath: "sales-management", icon: DollarSign },
  { name: "Calendar", subPath: "calendar", icon: Calendar },
  { name: "Sheets", subPath: "", icon: null, separator: true },
  { name: "Meeting Sheet", subPath: "meeting-sheet", icon: FileSpreadsheet },
  { name: "Insights", subPath: "", icon: null, separator: true },
  { name: "Analytics", subPath: "analytics", icon: BarChart3 },
];

function SalesRepLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const repId = searchParams.get("repId") || "";
  const repLabel = searchParams.get("repLabel") || "Sales Rep";
  const { canAccessPath, loaded } = useAllowedModules();

  // If we're on the listing page (no repId), just render children
  if (!repId) return <ModuleGuard moduleSlug="sales"><Shell>{children}</Shell></ModuleGuard>;

  if (loaded && !canAccessPath(pathname)) {
    return (
      <ModuleGuard moduleSlug="sales">
        <Shell>
          <div className="flex items-center justify-center h-[calc(100vh-49px)]">
            <p className="text-muted text-sm">You don&apos;t have access to this page.</p>
          </div>
        </Shell>
      </ModuleGuard>
    );
  }

  const basePath = "/m/sales/pipeline/meetings/sales-reps";
  const qs = `?repId=${repId}&repLabel=${encodeURIComponent(repLabel)}`;

  return (
    <ModuleGuard moduleSlug="sales">
    <Shell>
      <div className="flex h-[calc(100vh-49px)] overflow-hidden">
        <aside className="w-52 border-r border-border bg-surface flex-shrink-0 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs text-muted uppercase tracking-wider px-3 mb-2">
              {repLabel}
            </p>
            <nav className="space-y-0.5">
              {REP_NAV.map((item, idx) => {
                if (item.separator) {
                  return (
                    <div key={`sep-${idx}`} className="pt-3 pb-1 px-3">
                      <div className="border-t border-border" />
                      <p className="text-[10px] text-muted/50 uppercase tracking-widest mt-2">
                        {item.name}
                      </p>
                    </div>
                  );
                }

                const href = `${basePath}/${item.subPath}${qs}`;
                const isActive = pathname.includes(item.subPath);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.subPath}
                    href={href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-accent/10 text-accent"
                        : "text-muted hover:text-foreground hover:bg-surface-hover"
                    }`}
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>
        <div className="flex-1 min-w-0 overflow-auto">{children}</div>
      </div>
    </Shell>
    </ModuleGuard>
  );
}

export default function SalesRepLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#B8860B] border-t-transparent" /></div>}>
      <SalesRepLayoutInner>{children}</SalesRepLayoutInner>
    </Suspense>
  );
}
