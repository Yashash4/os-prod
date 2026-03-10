"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SocialPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/m/marketing/content/social/sop-tracker");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
