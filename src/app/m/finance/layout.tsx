"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Shell from "@/components/Shell";
import ModuleGuard from "@/components/ModuleGuard";
import { useAllowedModules } from "@/hooks/useAllowedModules";
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  FolderOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon | null;
  separator?: boolean;
}

const FINANCE_NAV: NavItem[] = [
  { name: "Dashboard", href: "/m/finance", icon: LayoutDashboard },
  { name: "Expenses", href: "/m/finance/expenses", icon: Receipt },
  { name: "Budgets", href: "/m/finance/budgets", icon: Wallet },
  { name: "Settings", href: "", icon: null, separator: true },
  { name: "Categories", href: "/m/finance/categories", icon: FolderOpen },
];

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { filterNav, canAccessPath, loaded } = useAllowedModules();

  if (loaded && !canAccessPath(pathname)) {
    return (
      <ModuleGuard moduleSlug="finance">
        <Shell>
          <div className="flex items-center justify-center h-[calc(100vh-48px)]">
            <p className="text-muted text-sm">You don&apos;t have access to this page.</p>
          </div>
        </Shell>
      </ModuleGuard>
    );
  }

  const visibleNav = filterNav(FINANCE_NAV);

  return (
    <ModuleGuard moduleSlug="finance">
      <Shell>
        <div className="flex h-[calc(100vh-48px)] overflow-hidden">
          <aside className="w-52 border-r border-border bg-surface flex-shrink-0 overflow-y-auto">
            <div className="p-3">
              <p className="text-xs text-muted uppercase tracking-wider px-3 mb-2">
                Finance
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
                    item.href === "/m/finance"
                      ? pathname === "/m/finance"
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
