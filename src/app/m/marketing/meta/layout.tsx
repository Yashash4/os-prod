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
  ClipboardList,
  Palette,
  Wallet,
  UserCheck,
  BarChart3,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon | null;
  separator?: boolean;
}

const META_NAV: NavItem[] = [
  { name: "Meta Data", href: "", icon: null, separator: true },
  { name: "Dashboard", href: "/m/marketing/meta", icon: LayoutDashboard },
  { name: "Campaigns", href: "/m/marketing/meta/campaigns", icon: Megaphone },
  { name: "Ad Sets", href: "/m/marketing/meta/adsets", icon: Layers },
  { name: "Ads", href: "/m/marketing/meta/ads", icon: ImageIcon },
  { name: "Sheets", href: "", icon: null, separator: true },
  { name: "Campaign Tracker", href: "/m/marketing/meta/campaign-tracker", icon: ClipboardList },
  { name: "Creative Tracker", href: "/m/marketing/meta/creative-tracker", icon: Palette },
  { name: "Budget Planner", href: "/m/marketing/meta/budget-planner", icon: Wallet },
  { name: "Conversion Log", href: "/m/marketing/meta/conversion-log", icon: UserCheck },
  { name: "Insights", href: "", icon: null, separator: true },
  { name: "Analytics", href: "/m/marketing/meta/analytics", icon: PieChart },
  { name: "Creative Analysis", href: "/m/marketing/meta/creative-analysis", icon: BarChart3 },
  { name: "Audience Insights", href: "/m/marketing/meta/audience-insights", icon: Users },
];

export default function MetaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <Shell>
      <div className="flex h-[calc(100vh-48px)] overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 border-r border-border bg-surface flex-shrink-0 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs text-muted uppercase tracking-wider px-3 mb-2">
              Meta Ads
            </p>
            <nav className="space-y-0.5">
              {META_NAV.map((item, idx) => {
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
                  item.href === "/m/marketing/meta"
                    ? pathname === "/m/marketing/meta"
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

        {/* Content */}
        <div className="flex-1 min-w-0 overflow-auto">{children}</div>
      </div>
    </Shell>
  );
}
