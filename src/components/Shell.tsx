"use client";

import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Breadcrumb from "./Breadcrumb";
import { buildBreadcrumbFromPath } from "@/lib/modules";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, Settings, Shield } from "lucide-react";
import NavTree from "./NavTree";
import NotificationDropdown from "./NotificationDropdown";
import { usePermissions } from "@/hooks/usePermissions";

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { scope } = usePermissions("admin");

  const pathSegments = pathname.startsWith("/m/")
    ? pathname.replace("/m/", "").split("/").filter(Boolean)
    : [];

  const breadcrumbItems =
    pathSegments.length > 0
      ? buildBreadcrumbFromPath(pathSegments)
      : [{ label: "APEX OS", href: "/" }];

  const displayName = user?.full_name || user?.email?.split("@")[0] || "";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-surface border-b border-border">
        <div className="flex items-center justify-between px-4 h-12">
          <div className="flex items-center gap-3">
            <NavTree />
            <Link href="/" className="flex-shrink-0 -my-1">
              <Image
                src="/logo.png"
                alt="Apex"
                width={120}
                height={120}
                className="invert mix-blend-screen h-9 w-auto"
              />
            </Link>
            <div className="w-px h-5 bg-border" />
            <Breadcrumb items={breadcrumbItems} />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            <NotificationDropdown />
            {displayName && (
              <Link
                href="/settings/profile"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-hover transition-colors"
                title="My Profile"
              >
                <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                  <span className="text-[10px] font-semibold text-background">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-xs text-muted hidden sm:block">
                  {displayName}
                </span>
                {scope && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider hidden sm:block ${
                    scope === "admin" ? "bg-accent/15 text-accent" :
                    scope === "manager" ? "bg-blue-500/15 text-blue-400" :
                    scope === "client" ? "bg-purple-500/15 text-purple-400" :
                    "bg-surface-hover text-muted"
                  }`}>
                    {scope}
                  </span>
                )}
              </Link>
            )}
            <Link
              href="/settings/profile"
              className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              title="Settings"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>
            <button
              onClick={signOut}
              className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
