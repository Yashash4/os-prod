"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-fetch";
import { MODULE_REGISTRY } from "@/lib/modules";
import {
  PanelLeft,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Zap,
  Calendar,
  Target,
  Users,
  DollarSign,
  BarChart3,
  Settings,
  ClipboardList,
  Megaphone,
  Share2,
  Layers,
  Image,
  PieChart,
  Search,
  FileSearch,
  Tag,
  MapPin,
  LayoutDashboard,
  FileText,
  PenTool,
  Film,
  CreditCard,
  Receipt,
  Landmark,
  ScrollText,
  Shield,
  Key,
  Map,
} from "lucide-react";
import type { Module } from "@/types";
import type { LucideIcon } from "lucide-react";

const ICON_COMPONENTS: Record<string, LucideIcon> = {
  TrendingUp,
  Zap,
  Calendar,
  Target,
  Users,
  DollarSign,
  BarChart3,
  Settings,
  ClipboardList,
  Megaphone,
  Share2,
  Layers,
  Image,
  PieChart,
  Search,
  FileSearch,
  Tag,
  MapIcon: Map,
  MapPin,
  LayoutDashboard,
  FileText,
  PenTool,
  Film,
  CreditCard,
  Receipt,
  Landmark,
  ScrollText,
  Shield,
  Key,
};

interface TreeNode {
  name: string;
  slug: string;
  icon: string;
  path: string;
  children: TreeNode[];
}

function buildTree(modules: typeof MODULE_REGISTRY, parentSlug: string | null): TreeNode[] {
  return modules
    .filter((m) => m.parent_slug === parentSlug && m.is_active)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((m) => ({
      name: m.name,
      slug: m.slug,
      icon: m.icon,
      path: m.path,
      children: buildTree(modules, m.slug),
    }));
}

function TreeItem({
  node,
  depth,
  pathname,
  expandedSlugs,
  toggleExpand,
  onNavigate,
}: {
  node: TreeNode;
  depth: number;
  pathname: string;
  expandedSlugs: Set<string>;
  toggleExpand: (slug: string) => void;
  onNavigate: (path: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedSlugs.has(node.slug);
  const isActive = pathname === node.path;
  const isInActivePath = pathname.startsWith(node.path + "/") || pathname === node.path;
  const IconComponent = ICON_COMPONENTS[node.icon];

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) {
            toggleExpand(node.slug);
          }
          onNavigate(node.path);
        }}
        className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-left text-xs transition-colors group ${
          isActive
            ? "bg-accent/15 text-accent"
            : isInActivePath
            ? "text-foreground"
            : "text-muted hover:text-foreground hover:bg-surface-hover"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <span
            className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(node.slug);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </span>
        ) : (
          <span className="flex-shrink-0 w-3.5 h-3.5" />
        )}
        {IconComponent && (
          <IconComponent
            className={`w-3.5 h-3.5 flex-shrink-0 ${
              isActive ? "text-accent" : "text-muted group-hover:text-foreground"
            }`}
          />
        )}
        <span className="truncate">{node.name}</span>
      </button>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.slug}
              node={child}
              depth={depth + 1}
              pathname={pathname}
              expandedSlugs={expandedSlugs}
              toggleExpand={toggleExpand}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function NavTree() {
  const [open, setOpen] = useState(false);
  const [allowedSlugs, setAllowedSlugs] = useState<Set<string> | null>(null);
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(new Set());
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, isAdmin } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Fetch allowed modules
  useEffect(() => {
    if (!user) {
      setAllowedSlugs(new Set());
      return;
    }
    if (isAdmin) {
      // Admins see everything
      setAllowedSlugs(null);
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (role) params.set("role_id", role.id);
    params.set("user_id", user.id);

    apiFetch(`/api/modules/effective?${params.toString()}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const slugs = new Set<string>((data.modules || []).map((m: Module) => m.slug));
        setAllowedSlugs(slugs);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        // Deny by default on error
        setAllowedSlugs(new Set());
      });

    return () => controller.abort();
  }, [user, role]);

  // Auto-expand tree nodes to show current page
  useEffect(() => {
    if (!pathname.startsWith("/m/")) return;
    const segments = pathname.replace("/m/", "").split("/").filter(Boolean);
    let currentPath = "/m";
    const toExpand = new Set(expandedSlugs);
    for (const seg of segments) {
      currentPath += `/${seg}`;
      const mod = MODULE_REGISTRY.find((m) => m.path === currentPath);
      if (mod) toExpand.add(mod.slug);
    }
    setExpandedSlugs(toExpand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const toggleExpand = useCallback((slug: string) => {
    setExpandedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  const handleNavigate = useCallback(
    (path: string) => {
      router.push(path);
      setOpen(false);
    },
    [router]
  );

  // Filter module registry to only show allowed modules
  const filteredRegistry = allowedSlugs
    ? MODULE_REGISTRY.filter((m) => allowedSlugs.has(m.slug))
    : MODULE_REGISTRY;

  const tree = buildTree(filteredRegistry, null);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className={`p-1.5 rounded-md transition-colors ${
          open
            ? "bg-accent/15 text-accent"
            : "text-muted hover:text-foreground hover:bg-surface-hover"
        }`}
        title="Navigate"
      >
        <PanelLeft className="w-4 h-4" />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="fixed top-12 left-0 w-64 max-h-[calc(100vh-3rem)] overflow-y-auto bg-surface border-r border-border shadow-2xl z-50 animate-in slide-in-from-left-2 duration-150"
        >
          <div className="p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted/60 font-semibold mb-2 px-2">
              Navigation
            </div>
            {tree.map((node) => (
              <TreeItem
                key={node.slug}
                node={node}
                depth={0}
                pathname={pathname}
                expandedSlugs={expandedSlugs}
                toggleExpand={toggleExpand}
                onNavigate={handleNavigate}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
