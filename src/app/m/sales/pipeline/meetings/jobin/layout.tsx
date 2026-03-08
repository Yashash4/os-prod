"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Shell from "@/components/Shell";
import { ClipboardList, Calendar, DollarSign, BarChart3 } from "lucide-react";

const JOBIN_NAV = [
  { name: "Meet Management", href: "/m/sales/pipeline/meetings/jobin/meet-management", icon: ClipboardList },
  { name: "Sales Management", href: "/m/sales/pipeline/meetings/jobin/sales-management", icon: DollarSign },
  { name: "Analytics", href: "/m/sales/pipeline/meetings/jobin/analytics", icon: BarChart3 },
  { name: "Calendar", href: "/m/sales/pipeline/meetings/jobin/calendar", icon: Calendar },
];

export default function JobinLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <Shell>
      <div className="flex h-[calc(100vh-49px)] overflow-hidden">
        <aside className="w-52 border-r border-border bg-surface flex-shrink-0 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs text-muted uppercase tracking-wider px-3 mb-2">
              Jobin
            </p>
            <div className="h-px bg-border mb-2" />
            <nav className="space-y-0.5">
              {JOBIN_NAV.map((item) => {
                const isActive =
                  item.href === "/m/sales/pipeline/meetings/jobin"
                    ? pathname === "/m/sales/pipeline/meetings/jobin"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors relative ${
                      isActive
                        ? "bg-accent/10 text-accent"
                        : "text-muted hover:text-foreground hover:bg-surface-hover"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-accent rounded-full" />
                    )}
                    <item.icon className="w-4 h-4" />
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
  );
}
