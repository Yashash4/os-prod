"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import { useAuth } from "@/contexts/AuthContext";
import { Users, Key, Shield, ScrollText, Mail } from "lucide-react";
import { useEffect } from "react";

const ADMIN_NAV = [
  { name: "People", href: "/m/admin/people", icon: Users },
  { name: "Roles", href: "/m/admin/roles", icon: Key },
  { name: "Permissions", href: "/m/admin/permissions", icon: Shield },
  { name: "Audit Log", href: "/m/admin/audit-log", icon: ScrollText },
  { name: "Email Templates", href: "/m/admin/email-templates", icon: Mail },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace("/");
    }
  }, [loading, isAdmin, router]);

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center h-[calc(100vh-49px)]">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </Shell>
    );
  }

  if (!isAdmin) {
    return (
      <Shell>
        <div className="flex items-center justify-center h-[calc(100vh-49px)]">
          <div className="text-center space-y-2">
            <p className="text-foreground font-medium">Access Denied</p>
            <p className="text-sm text-muted">You do not have admin privileges to view this page.</p>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex h-[calc(100vh-49px)] overflow-hidden">
        <aside className="w-52 border-r border-border bg-surface flex-shrink-0 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs text-muted uppercase tracking-wider px-3 mb-2">
              Admin
            </p>
            <div className="h-px bg-border mb-2" />
            <nav className="space-y-0.5">
              {ADMIN_NAV.map((item) => {
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
