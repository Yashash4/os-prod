"use client";

import Link from "next/link";
import { motion } from "framer-motion";
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
  Megaphone,
  Share2,
  Layers,
  ImageIcon,
  PieChart,
  Folder,
  FileText,
  PenTool,
  Film,
  Linkedin,
  Instagram,
  Youtube,
  CreditCard,
  Receipt,
  Landmark,
  ScrollText,
  Shield,
  KeyRound,
  Briefcase,
  Building2,
  BadgeCheck,
  IndianRupee,
  Wallet,
  Search,
  LayoutDashboard,
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
  Megaphone,
  Share2,
  Layers,
  Image: ImageIcon,
  PieChart,
  FileText,
  PenTool,
  Film,
  Linkedin,
  Instagram,
  Youtube,
  CreditCard,
  Receipt,
  Landmark,
  ScrollText,
  Shield,
  Key: KeyRound,
  Briefcase,
  Building2,
  BadgeCheck,
  IndianRupee,
  Wallet,
  Search,
  LayoutDashboard,
};

interface ModuleCardProps {
  name: string;
  description: string;
  icon: string;
  href: string;
  index?: number;
  badge?: number;
}

export default function ModuleCard({
  name,
  description,
  icon,
  href,
  index = 0,
  badge = 0,
}: ModuleCardProps) {
  const IconComponent = iconComponents[icon] || Folder;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03, ease: "easeOut" }}
    >
      <Link
        href={href}
        className="group flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-surface border border-border hover:border-accent/30 hover:bg-surface-hover transition-all min-h-[160px]"
      >
        <div className="relative w-12 h-12 rounded-lg bg-accent/8 flex items-center justify-center group-hover:bg-accent/12 transition-colors">
          <IconComponent className="w-6 h-6 text-accent" />
          {badge > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </div>
        <div className="text-center">
          <h3 className="text-sm font-medium text-foreground">
            {name}
          </h3>
          <p className="text-xs text-muted mt-1">
            {description}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
