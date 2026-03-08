"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Shell from "@/components/Shell";
import { LayoutDashboard, Calendar, Target } from "lucide-react";

const GHL_NAV = [
  { name: "Dashboard", href: "/m/sales/ghl", icon: LayoutDashboard },
  { name: "Calendar", href: "/m/sales/ghl/calendar", icon: Calendar },
  { name: "Opportunities", href: "/m/sales/ghl/opportunities", icon: Target },
];

export default function GHLLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <Shell>
      <div className="flex h-[calc(100vh-48px)] overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 border-r border-border bg-surface flex-shrink-0 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs text-muted uppercase tracking-wider px-3 mb-2">
              GHL
            </p>
            <nav className="space-y-0.5">
              {GHL_NAV.map((item) => {
                const isActive =
                  item.href === "/m/sales/ghl"
                    ? pathname === "/m/sales/ghl"
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

        {/* Content - overflow contained here */}
        <div className="flex-1 min-w-0 overflow-auto">{children}</div>
      </div>
    </Shell>
  );
}
