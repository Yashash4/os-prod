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
};

interface ModuleCardProps {
  name: string;
  description: string;
  icon: string;
  href: string;
  index?: number;
}

export default function ModuleCard({
  name,
  description,
  icon,
  href,
  index = 0,
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
        <div className="w-12 h-12 rounded-lg bg-accent/8 flex items-center justify-center group-hover:bg-accent/12 transition-colors">
          <IconComponent className="w-6 h-6 text-accent" />
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
