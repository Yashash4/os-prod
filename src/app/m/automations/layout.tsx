"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Shell from "@/components/Shell";
import ModuleGuard from "@/components/ModuleGuard";
import { useAllowedModules } from "@/hooks/useAllowedModules";
import { Send, FileText, PenTool } from "lucide-react";

const EMAIL_NAV = [
  { name: "Sent Invoices", href: "/m/automations/email", icon: Send },
  { name: "Templates", href: "/m/automations/email/templates", icon: FileText },
  { name: "Compose", href: "/m/automations/email/compose", icon: PenTool },
];

export default function AutomationsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { filterNav, canAccessPath, loaded } = useAllowedModules();

  if (loaded && !canAccessPath(pathname)) {
    return (
      <ModuleGuard moduleSlug="automations">
        <Shell>
          <div className="flex items-center justify-center h-[calc(100vh-49px)]">
            <p className="text-muted text-sm">You don&apos;t have access to this page.</p>
          </div>
        </Shell>
      </ModuleGuard>
    );
  }

  const visibleNav = filterNav(EMAIL_NAV);

  return (
    <ModuleGuard moduleSlug="automations">
    <Shell>
      <div className="flex h-[calc(100vh-49px)] overflow-hidden">
        <aside className="w-52 border-r border-border bg-surface flex-shrink-0 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs text-muted uppercase tracking-wider px-3 mb-2">
              Email
            </p>
            <div className="h-px bg-border mb-2" />
            <nav className="space-y-0.5">
              {visibleNav.map((item) => {
                const isActive =
                  item.href === "/m/automations/email"
                    ? pathname === "/m/automations/email"
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
    </ModuleGuard>
  );
}
