"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAllowedModules } from "@/hooks/useAllowedModules";
import Shell from "@/components/Shell";

interface ModuleGuardProps {
  /** The module slug to check access for (e.g. "payments", "hr", "sales") */
  moduleSlug: string;
  children: React.ReactNode;
}

/**
 * Wraps a module's content and redirects to home if the user
 * doesn't have access to the specified module.
 */
export default function ModuleGuard({ moduleSlug, children }: ModuleGuardProps) {
  const { canAccess, loaded, isAdmin } = useAllowedModules();
  const router = useRouter();

  const hasAccess = isAdmin || canAccess(moduleSlug);

  useEffect(() => {
    if (loaded && !hasAccess) {
      router.replace("/");
    }
  }, [loaded, hasAccess, router]);

  if (!loaded) {
    return (
      <Shell>
        <div className="flex items-center justify-center h-[calc(100vh-49px)]">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </Shell>
    );
  }

  if (!hasAccess) return null;

  return <>{children}</>;
}
