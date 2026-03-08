"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Shell from "@/components/Shell";
import {
  LayoutDashboard,
  Megaphone,
  Layers,
  ImageIcon,
  PieChart,
} from "lucide-react";

const META_NAV = [
  { name: "Dashboard", href: "/m/marketing/meta", icon: LayoutDashboard },
  { name: "Campaigns", href: "/m/marketing/meta/campaigns", icon: Megaphone },
  { name: "Ad Sets", href: "/m/marketing/meta/adsets", icon: Layers },
  { name: "Ads", href: "/m/marketing/meta/ads", icon: ImageIcon },
  { name: "Analytics", href: "/m/marketing/meta/analytics", icon: PieChart },
];

export default function MetaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <Shell userName="Yash" onSignOut={() => {}}>
      <div className="flex h-[calc(100vh-48px)] overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 border-r border-border bg-surface flex-shrink-0 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs text-muted uppercase tracking-wider px-3 mb-2">
              Meta Ads
            </p>
            <nav className="space-y-0.5">
              {META_NAV.map((item) => {
                const isActive =
                  item.href === "/m/marketing/meta"
                    ? pathname === "/m/marketing/meta"
                    : pathname === item.href || pathname.startsWith(item.href + "/") || pathname.startsWith(item.href + "?");
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
