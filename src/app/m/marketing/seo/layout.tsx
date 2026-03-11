"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Shell from "@/components/Shell";
import ModuleGuard from "@/components/ModuleGuard";
import { useAllowedModules } from "@/hooks/useAllowedModules";
import {
  LayoutDashboard,
  TrendingUp,
  FileSearch,
  Tag,
  Map as MapIcon,
  MapPin,
  Crosshair,
  CheckSquare,
  Swords,
  FileEdit,
  LineChart,
  HeartPulse,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon | null;
  separator?: boolean;
}

const SEO_NAV: NavItem[] = [
  { name: "Search Console", href: "", icon: null, separator: true },
  { name: "Dashboard", href: "/m/marketing/seo", icon: LayoutDashboard },
  { name: "Search Performance", href: "/m/marketing/seo/performance", icon: TrendingUp },
  { name: "Keywords", href: "/m/marketing/seo/keywords", icon: Tag },
  { name: "Pages & Indexing", href: "/m/marketing/seo/indexing", icon: FileSearch },
  { name: "Sitemap", href: "/m/marketing/seo/sitemap", icon: MapIcon },
  { name: "Sheets", href: "", icon: null, separator: true },
  { name: "Keyword Tracker", href: "/m/marketing/seo/keyword-tracker", icon: Crosshair },
  { name: "Task Log", href: "/m/marketing/seo/task-log", icon: CheckSquare },
  { name: "Competitor Tracker", href: "/m/marketing/seo/competitor-tracker", icon: Swords },
  { name: "Content Briefs", href: "/m/marketing/seo/content-briefs", icon: FileEdit },
  { name: "Insights", href: "", icon: null, separator: true },
  { name: "Rank Analysis", href: "/m/marketing/seo/rank-analysis", icon: LineChart },
  { name: "Page Health", href: "/m/marketing/seo/page-health", icon: HeartPulse },
  { name: "Google Business", href: "/m/marketing/seo/business", icon: MapPin },
];

export default function SeoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { filterNav, canAccessPath, loaded } = useAllowedModules();

  if (loaded && !canAccessPath(pathname)) {
    return (
      <ModuleGuard moduleSlug="marketing">
        <Shell>
          <div className="flex items-center justify-center h-[calc(100vh-48px)]">
            <p className="text-muted text-sm">You don&apos;t have access to this page.</p>
          </div>
        </Shell>
      </ModuleGuard>
    );
  }

  const visibleNav = filterNav(SEO_NAV);

  return (
    <ModuleGuard moduleSlug="marketing">
    <Shell>
      <div className="flex h-[calc(100vh-48px)] overflow-hidden">
        <aside className="w-52 border-r border-border bg-surface flex-shrink-0 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs text-muted uppercase tracking-wider px-3 mb-2">
              SEO
            </p>
            <nav className="space-y-0.5">
              {visibleNav.map((item, idx) => {
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

                const isActive =
                  item.href === "/m/marketing/seo"
                    ? pathname === "/m/marketing/seo"
                    : pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
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
