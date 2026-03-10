"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Shell from "@/components/Shell";
import { ClipboardList, Calendar, DollarSign, BarChart3, FileSpreadsheet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon | null;
  separator?: boolean;
}

const JOBIN_NAV: NavItem[] = [
  { name: "Meet Management", href: "/m/sales/pipeline/meetings/jobin/meet-management", icon: ClipboardList },
  { name: "Sales Management", href: "/m/sales/pipeline/meetings/jobin/sales-management", icon: DollarSign },
  { name: "Calendar", href: "/m/sales/pipeline/meetings/jobin/calendar", icon: Calendar },
  { name: "Sheets", href: "", icon: null, separator: true },
  { name: "Meeting Sheet", href: "/m/sales/pipeline/meetings/jobin/meeting-sheet", icon: FileSpreadsheet },
  { name: "Insights", href: "", icon: null, separator: true },
  { name: "Analytics", href: "/m/sales/pipeline/meetings/jobin/analytics", icon: BarChart3 },
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
            <nav className="space-y-0.5">
              {JOBIN_NAV.map((item, idx) => {
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
  );
}
