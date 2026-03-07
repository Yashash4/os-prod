"use client";

import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Breadcrumb from "./Breadcrumb";
import { buildBreadcrumbFromPath } from "@/lib/modules";
import { LogOut, Bell } from "lucide-react";

interface ShellProps {
  children: React.ReactNode;
  userName?: string;
  onSignOut?: () => void;
}

export default function Shell({ children, userName, onSignOut }: ShellProps) {
  const pathname = usePathname();

  const pathSegments = pathname.startsWith("/m/")
    ? pathname.replace("/m/", "").split("/").filter(Boolean)
    : [];

  const breadcrumbItems =
    pathSegments.length > 0
      ? buildBreadcrumbFromPath(pathSegments)
      : [{ label: "APEX OS", href: "/" }];

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed top bar */}
      <header className="sticky top-0 z-50 bg-surface border-b border-border">
        <div className="flex items-center justify-between px-4 h-12">
          {/* Logo + Breadcrumb */}
          <div className="flex items-center gap-2">
            <Link href="/" className="flex-shrink-0 -my-1">
              <Image
                src="/logo.png"
                alt="Apex"
                width={120}
                height={120}
                className="invert mix-blend-screen h-10 w-auto"
              />
            </Link>
            <Breadcrumb items={breadcrumbItems} />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3 flex-shrink-0 ml-4">
            <button className="text-muted hover:text-foreground transition-colors">
              <Bell className="w-4 h-4" />
            </button>
            {userName && (
              <span className="text-sm text-muted hidden sm:block">
                {userName}
              </span>
            )}
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="text-muted hover:text-foreground transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main>{children}</main>
    </div>
  );
}
