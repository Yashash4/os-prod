"use client";

import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import type { PermissionMatrix } from "@/types";

interface PermissionGateProps {
  /** Parent module slug (e.g. "hr", "finance", "tasks") */
  module: string;
  /** Sub-module slug (e.g. "employees", "expenses", "tasks-my") */
  subModule: string;
  /** Action to check (e.g. "canCreate", "canEdit", "canDelete", "canApprove", "canExport") */
  action: keyof PermissionMatrix;
  /** Content to render if permitted */
  children: ReactNode;
  /** Optional fallback if denied (default: render nothing) */
  fallback?: ReactNode;
}

/**
 * Conditionally renders children based on user's permission for a specific action
 * on a sub-module. Renders nothing (or fallback) if the user lacks permission.
 *
 * Usage:
 * ```tsx
 * <PermissionGate module="hr" subModule="employees" action="canCreate">
 *   <button onClick={handleAdd}>Add Employee</button>
 * </PermissionGate>
 * ```
 */
export default function PermissionGate({
  module,
  subModule,
  action,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { canDo, loading } = usePermissions(module);

  // While loading, hide the gated content to avoid flash of unauthorized UI
  if (loading) return null;

  if (canDo(subModule, action)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
