"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  // Safety net: if auth loading takes longer than 12s, stop waiting
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setTimedOut(true), 12000);
    return () => clearTimeout(timer);
  }, [loading]);

  const effectiveLoading = loading && !timedOut;

  useEffect(() => {
    if (!effectiveLoading && !user) {
      router.replace("/login");
    }
  }, [effectiveLoading, user, router]);

  if (effectiveLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
