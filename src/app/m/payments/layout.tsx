"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Shell from "@/components/Shell";
import {
  LayoutDashboard,
  Receipt,
  Landmark,
  FileText,
  ScrollText,
  PieChart,
  AlertTriangle,
  Send,
  ClipboardList,
  AlertCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ModuleGuard from "@/components/ModuleGuard";
import { useAllowedModules } from "@/hooks/useAllowedModules";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon | null;
  separator?: boolean;
}

const PAYMENTS_NAV: NavItem[] = [
  { name: "Dashboard", href: "/m/payments/dashboard", icon: LayoutDashboard },
  { name: "Transactions", href: "/m/payments/transactions", icon: Receipt },
  { name: "Settlements", href: "/m/payments/settlements", icon: Landmark },
  { name: "Invoices", href: "/m/payments/invoices", icon: FileText },
  { name: "Payment Pages", href: "/m/payments/payment-pages", icon: ScrollText },
  { name: "Sheets", href: "", icon: null, separator: true },
  { name: "Failed Payments", href: "/m/payments/failed-payments", icon: AlertTriangle },
  { name: "Send Links", href: "/m/payments/send-links", icon: Send },
  { name: "Collection Log", href: "/m/payments/collection-log", icon: ClipboardList },
  { name: "Outstanding", href: "/m/payments/outstanding", icon: AlertCircle },
  { name: "Insights", href: "", icon: null, separator: true },
  { name: "Analytics", href: "/m/payments/analytics", icon: PieChart },
];

export default function PaymentsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { filterNav, canAccessPath, loaded } = useAllowedModules();

  if (pathname === "/m/payments") {
    return <>{children}</>;
  }

  if (loaded && !canAccessPath(pathname)) {
    return (
      <ModuleGuard moduleSlug="payments">
        <Shell>
          <div className="flex items-center justify-center h-[calc(100vh-48px)]">
            <p className="text-muted text-sm">You don&apos;t have access to this page.</p>
          </div>
        </Shell>
      </ModuleGuard>
    );
  }

  const visibleNav = filterNav(PAYMENTS_NAV);

  return (
    <ModuleGuard moduleSlug="payments">
    <Shell>
      <div className="flex h-[calc(100vh-48px)] overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 border-r border-border bg-surface flex-shrink-0 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs text-muted uppercase tracking-wider px-3 mb-2">
              Payments
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

        {/* Content */}
        <div className="flex-1 min-w-0 overflow-auto">{children}</div>
      </div>
    </Shell>
    </ModuleGuard>
  );
}
