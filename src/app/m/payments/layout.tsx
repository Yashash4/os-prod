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
} from "lucide-react";

const PAYMENTS_NAV = [
  { name: "Dashboard", href: "/m/payments/dashboard", icon: LayoutDashboard },
  { name: "Transactions", href: "/m/payments/transactions", icon: Receipt },
  { name: "Settlements", href: "/m/payments/settlements", icon: Landmark },
  { name: "Invoices", href: "/m/payments/invoices", icon: FileText },
  { name: "Payment Pages", href: "/m/payments/payment-pages", icon: ScrollText },
  { name: "Analytics", href: "/m/payments/analytics", icon: PieChart },
];

export default function PaymentsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Landing page (module card grid) renders without sidebar
  if (pathname === "/m/payments") {
    return <>{children}</>;
  }

  return (
    <Shell>
      <div className="flex h-[calc(100vh-48px)] overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 border-r border-border bg-surface flex-shrink-0 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs text-muted uppercase tracking-wider px-3 mb-2">
              Payments
            </p>
            <nav className="space-y-0.5">
              {PAYMENTS_NAV.map((item) => {
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
  );
}
