"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Shell from "@/components/Shell";
import ModuleGuard from "@/components/ModuleGuard";
import { useAllowedModules } from "@/hooks/useAllowedModules";
import {
  LayoutDashboard,
  Users,
  Building2,
  BadgeCheck,
  Target,
  IndianRupee,
  Wallet,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon | null;
  separator?: boolean;
}

const HR_NAV: NavItem[] = [
  { name: "Dashboard", href: "/m/hr/dashboard", icon: LayoutDashboard },
  { name: "Employees", href: "/m/hr/employees", icon: Users },
  { name: "Departments", href: "/m/hr/departments", icon: Building2 },
  { name: "Designations", href: "/m/hr/designations", icon: BadgeCheck },
  { name: "Performance", href: "", icon: null, separator: true },
  { name: "KPIs & KRAs", href: "/m/hr/kpis", icon: Target },
  { name: "Compensation", href: "", icon: null, separator: true },
  { name: "Salary", href: "/m/hr/salary", icon: IndianRupee },
  { name: "Payroll Tracker", href: "/m/hr/payroll", icon: Wallet },
  { name: "System", href: "", icon: null, separator: true },
  { name: "Settings", href: "/m/hr/settings", icon: Settings },
];

export default function HRLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { filterNav, canAccessPath, loaded } = useAllowedModules();

  if (pathname === "/m/hr") {
    return <>{children}</>;
  }

  if (loaded && !canAccessPath(pathname)) {
    return (
      <ModuleGuard moduleSlug="hr">
        <Shell>
          <div className="flex items-center justify-center h-[calc(100vh-48px)]">
            <p className="text-muted text-sm">You don&apos;t have access to this page.</p>
          </div>
        </Shell>
      </ModuleGuard>
    );
  }

  const visibleNav = filterNav(HR_NAV);

  return (
    <ModuleGuard moduleSlug="hr">
    <Shell>
      <div className="flex h-[calc(100vh-48px)] overflow-hidden">
        <aside className="w-52 border-r border-border bg-surface flex-shrink-0 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs text-muted uppercase tracking-wider px-3 mb-2">
              HR
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
                  pathname === item.href || pathname.startsWith(item.href + "/");
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
