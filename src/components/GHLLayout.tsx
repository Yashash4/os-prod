"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Shell from "./Shell";
import { LayoutDashboard, Calendar, Target } from "lucide-react";

const sidebarItems = [
  { name: "Dashboard", href: "/m/sales/ghl", icon: LayoutDashboard },
  { name: "Calendar", href: "/m/sales/ghl/calendar", icon: Calendar },
  { name: "Opportunities", href: "/m/sales/ghl/opportunities", icon: Target },
];

interface GHLLayoutProps {
  children: React.ReactNode;
}

export default function GHLLayout({ children }: GHLLayoutProps) {
  const pathname = usePathname();

  return (
    <Shell userName="Yash" onSignOut={() => {}}>
      <div className="flex min-h-[calc(100vh-48px)]">
        {/* Sidebar */}
        <aside className="w-52 border-r border-border bg-surface flex-shrink-0">
          <nav className="p-3 space-y-1">
            {sidebarItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/m/sales/ghl" &&
                  pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-accent/10 text-accent"
                      : "text-muted hover:text-foreground hover:bg-surface-hover"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1">{children}</div>
      </div>
    </Shell>
  );
}
