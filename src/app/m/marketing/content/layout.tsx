"use client";

import Shell from "@/components/Shell";

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell>
      <div className="h-[calc(100vh-48px)] overflow-hidden">
        {children}
      </div>
    </Shell>
  );
}
