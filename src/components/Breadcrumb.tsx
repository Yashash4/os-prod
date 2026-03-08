"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { BreadcrumbItem } from "@/types";

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm overflow-x-auto whitespace-nowrap py-1">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={item.href} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="w-3.5 h-3.5 text-muted/50 flex-shrink-0" />
            )}
            {isLast ? (
              <span className="text-foreground font-medium text-xs">
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-muted hover:text-foreground transition-colors text-xs"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
