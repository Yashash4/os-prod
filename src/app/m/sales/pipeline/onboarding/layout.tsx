"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Shell from "@/components/Shell";
import { ClipboardList, BarChart3 } from "lucide-react";

const ONBOARDING_NAV = [
  { name: "Management", href: "/m/sales/pipeline/onboarding/management", icon: ClipboardList },
  { name: "Analytics", href: "/m/sales/pipeline/onboarding/analytics", icon: BarChart3 },
];

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <Shell userName="Yash" onSignOut={() => {}}>
      <div className="flex h-[calc(100vh-49px)] overflow-hidden">
        <aside className="w-52 border-r border-border bg-surface flex-shrink-0 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs text-muted uppercase tracking-wider px-3 mb-2">
              Onboarding
            </p>
            <div className="h-px bg-border mb-2" />
            <nav className="space-y-0.5">
              {ONBOARDING_NAV.map((item) => {
                const isActive = pathname.startsWith(item.href);
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
