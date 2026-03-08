"use client";

import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Breadcrumb from "./Breadcrumb";
import { buildBreadcrumbFromPath } from "@/lib/modules";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, Bell } from "lucide-react";
import NavTree from "./NavTree";

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

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
            <button className="relative p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-accent rounded-full" />
            </button>
            {displayName && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg">
                <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                  <span className="text-[10px] font-semibold text-background">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-xs text-muted hidden sm:block">
                  {displayName}
                </span>
              </div>
            )}
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
