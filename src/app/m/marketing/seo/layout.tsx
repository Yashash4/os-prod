"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Shell from "@/components/Shell";
import {
  LayoutDashboard,
  TrendingUp,
  FileSearch,
  Tag,
  Map as MapIcon,
  MapPin,
} from "lucide-react";

const SEO_NAV = [
  { name: "Dashboard", href: "/m/marketing/seo", icon: LayoutDashboard },
  { name: "Search Performance", href: "/m/marketing/seo/performance", icon: TrendingUp },
  { name: "Pages & Indexing", href: "/m/marketing/seo/indexing", icon: FileSearch },
  { name: "Keywords", href: "/m/marketing/seo/keywords", icon: Tag },
  { name: "Sitemap", href: "/m/marketing/seo/sitemap", icon: MapIcon },
  { name: "Google Business", href: "/m/marketing/seo/business", icon: MapPin },
];

export default function SeoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <Shell>
      <div className="flex h-[calc(100vh-48px)] overflow-hidden">
        <aside className="w-52 border-r border-border bg-surface flex-shrink-0 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs text-muted uppercase tracking-wider px-3 mb-2">
              SEO
            </p>
            <nav className="space-y-0.5">
              {SEO_NAV.map((item) => {
                const isActive =
                  item.href === "/m/marketing/seo"
                    ? pathname === "/m/marketing/seo"
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

        <div className="flex-1 min-w-0 overflow-auto">{children}</div>
      </div>
    </Shell>
  );
}
