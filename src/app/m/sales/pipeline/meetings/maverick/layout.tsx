"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Shell from "@/components/Shell";
import { ClipboardList, Calendar, DollarSign, BarChart3 } from "lucide-react";

const MAVERICK_NAV = [
  { name: "Meet Management", href: "/m/sales/pipeline/meetings/maverick/meet-management", icon: ClipboardList },
  { name: "Sales Management", href: "/m/sales/pipeline/meetings/maverick/sales-management", icon: DollarSign },
  { name: "Analytics", href: "/m/sales/pipeline/meetings/maverick/analytics", icon: BarChart3 },
  { name: "Calendar", href: "/m/sales/pipeline/meetings/maverick/calendar", icon: Calendar },
];

export default function MaverickLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <Shell userName="Yash" onSignOut={() => {}}>
      <div className="flex h-[calc(100vh-48px)] overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 border-r border-border bg-surface flex-shrink-0 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs text-muted uppercase tracking-wider px-3 mb-2">
              Maverick
            </p>
            <nav className="space-y-0.5">
              {MAVERICK_NAV.map((item) => {
                const isActive =
                  item.href === "/m/sales/pipeline/meetings/maverick"
                    ? pathname === "/m/sales/pipeline/meetings/maverick"
                    : pathname.startsWith(item.href);
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
