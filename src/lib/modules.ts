import type { Module } from "@/types";

// Static module registry - used as fallback and for module metadata
// Actual access control is handled by Supabase role_modules table
export const MODULE_REGISTRY: Omit<Module, "id" | "created_at">[] = [
  {
    name: "Sales",
    slug: "sales",
    description: "Sales pipeline, CRM, and revenue tracking",
    icon: "TrendingUp",
    parent_slug: null,
    path: "/m/sales",
    order: 1,
    is_active: true,
  },
  {
    name: "GHL",
    slug: "ghl",
    description: "GoHighLevel integration",
    icon: "Zap",
    parent_slug: "sales",
    path: "/m/sales/ghl",
    order: 1,
    is_active: true,
  },
  {
    name: "Calendar",
    slug: "calendar",
    description: "Appointments and bookings",
    icon: "Calendar",
    parent_slug: "ghl",
    path: "/m/sales/ghl/calendar",
    order: 1,
    is_active: true,
  },
  {
    name: "Opportunities",
    slug: "opportunities",
    description: "Pipeline and deals",
    icon: "Target",
    parent_slug: "ghl",
    path: "/m/sales/ghl/opportunities",
    order: 2,
    is_active: true,
  },
  // ── Marketing ─────────────────────────────────────
  {
    name: "Marketing",
    slug: "marketing",
    description: "Ad campaigns, analytics, and marketing tools",
    icon: "Megaphone",
    parent_slug: null,
    path: "/m/marketing",
    order: 2,
    is_active: true,
  },
  {
    name: "Meta",
    slug: "meta",
    description: "Facebook & Instagram Ads",
    icon: "Share2",
    parent_slug: "marketing",
    path: "/m/marketing/meta",
    order: 1,
    is_active: true,
  },
  {
    name: "Campaigns",
    slug: "meta-campaigns",
    description: "Ad campaigns overview",
    icon: "BarChart3",
    parent_slug: "meta",
    path: "/m/marketing/meta/campaigns",
    order: 1,
    is_active: true,
  },
  {
    name: "Ad Sets",
    slug: "meta-adsets",
    description: "Ad set management",
    icon: "Layers",
    parent_slug: "meta",
    path: "/m/marketing/meta/adsets",
    order: 2,
    is_active: true,
  },
  {
    name: "Ads",
    slug: "meta-ads",
    description: "Individual ads",
    icon: "Image",
    parent_slug: "meta",
    path: "/m/marketing/meta/ads",
    order: 3,
    is_active: true,
  },
  {
    name: "Analytics",
    slug: "meta-analytics",
    description: "Demographic & breakdown analytics",
    icon: "PieChart",
    parent_slug: "meta",
    path: "/m/marketing/meta/analytics",
    order: 4,
    is_active: true,
  },
];

// Map icon names to actual Lucide icon components (used in components)
export const ICON_MAP: Record<string, string> = {
  TrendingUp: "TrendingUp",
  Zap: "Zap",
  Calendar: "Calendar",
  Target: "Target",
  Users: "Users",
  BookOpen: "BookOpen",
  DollarSign: "DollarSign",
  BarChart3: "BarChart3",
  Settings: "Settings",
  ClipboardList: "ClipboardList",
  MessageSquare: "MessageSquare",
  Package: "Package",
  Megaphone: "Megaphone",
  Share2: "Share2",
  Layers: "Layers",
  Image: "Image",
  PieChart: "PieChart",
};

export function getModuleBySlug(slug: string) {
  return MODULE_REGISTRY.find((m) => m.slug === slug);
}

export function getChildrenByParentSlug(parentSlug: string) {
  return MODULE_REGISTRY.filter((m) => m.parent_slug === parentSlug);
}

export function buildBreadcrumbFromPath(pathSegments: string[]) {
  const breadcrumbs = [{ label: "APEX OS", href: "/" }];

  let currentPath = "/m";
  for (const segment of pathSegments) {
    currentPath += `/${segment}`;
    const mod = MODULE_REGISTRY.find((m) => m.path === currentPath);
    breadcrumbs.push({
      label: mod?.name || segment,
      href: currentPath,
    });
  }

  return breadcrumbs;
}
