"use client";

import Link from "next/link";
import {
  TrendingUp,
  Zap,
  Calendar,
  Target,
  Users,
  BookOpen,
  DollarSign,
  BarChart3,
  Settings,
  ClipboardList,
  MessageSquare,
  Package,
  Folder,
} from "lucide-react";

const iconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
  TrendingUp,
  Zap,
  Calendar,
  Target,
  Users,
  BookOpen,
  DollarSign,
  BarChart3,
  Settings,
  ClipboardList,
  MessageSquare,
  Package,
};

interface ModuleCardProps {
  name: string;
  description: string;
  icon: string;
  href: string;
}

export default function ModuleCard({
  name,
  description,
  icon,
  href,
}: ModuleCardProps) {
  const IconComponent = iconComponents[icon] || Folder;

  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-3 p-6 rounded-xl bg-surface border border-border hover:border-accent/50 hover:bg-surface-hover transition-all"
    >
      <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
        <IconComponent className="w-6 h-6 text-accent" />
      </div>
      <div className="text-center">
        <h3 className="text-sm font-medium text-foreground">{name}</h3>
        <p className="text-xs text-muted mt-1">{description}</p>
      </div>
    </Link>
  );
}
