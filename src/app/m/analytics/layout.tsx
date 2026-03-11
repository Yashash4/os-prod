"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Shell from "@/components/Shell";
import ModuleGuard from "@/components/ModuleGuard";
import { useAllowedModules } from "@/hooks/useAllowedModules";
import {
  LayoutDashboard,
  Share2,
  Search,
  CreditCard,
  TrendingUp,
  Zap,
  Target,
  ClipboardList,
} from "lucide-react";

const ANALYTICS_NAV: ({ name: string; href: string; icon: typeof LayoutDashboard } | { separator: true; label: string })[] = [
  { name: "Overview", href: "/m/analytics/overview", icon: LayoutDashboard },
  { name: "Meta Ads", href: "/m/analytics/meta-ads", icon: Share2 },
  { name: "SEO", href: "/m/analytics/seo", icon: Search },
  { name: "Payments", href: "/m/analytics/payments", icon: CreditCard },
  { name: "Sales", href: "/m/analytics/sales", icon: TrendingUp },
  { name: "GHL Dashboard", href: "/m/analytics/ghl", icon: Zap },
  { name: "Cohort Tracker", href: "/m/analytics/cohort-tracker", icon: Target },
  { separator: true, label: "Sheets" },
  { name: "Daily Sheet", href: "/m/analytics/daily-sheet", icon: ClipboardList },
];

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { filterNav, canAccessPath, loaded } = useAllowedModules();

  // Landing page (module card grid) renders without sidebar
  if (pathname === "/m/analytics") {
    return <>{children}</>;
  }

  // Block access to sub-pages the user doesn't have permission for
  if (loaded && !canAccessPath(pathname)) {
    return (
      <ModuleGuard moduleSlug="analytics">
        <Shell>
          <div className="flex items-center justify-center h-[calc(100vh-48px)]">
            <p className="text-muted text-sm">You don&apos;t have access to this page.</p>
          </div>
        </Shell>
      </ModuleGuard>
    );
  }

  const visibleNav = filterNav(ANALYTICS_NAV);

  return (
    <ModuleGuard moduleSlug="analytics">
    <Shell>
      <div className="flex h-[calc(100vh-48px)] overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 border-r border-border bg-surface flex-shrink-0 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs text-muted uppercase tracking-wider px-3 mb-2">
              Analytics
            </p>
            <nav className="space-y-0.5">
              {visibleNav.map((item, idx) => {
                if ("separator" in item) {
                  return (
                    <div key={`sep-${idx}`} className="pt-3 pb-1">
                      <p className="text-xs text-muted uppercase tracking-wider px-3">{item.label}</p>
                    </div>
                  );
                }
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-accent/10 text-accent"
                        : "text-muted hover:text-foreground hover:bg-surface-hover"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0 overflow-auto">{children}</div>
      </div>
    </Shell>
    </ModuleGuard>
  );
}
