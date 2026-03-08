"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/m/admin/people");
  }, [router]);
  return null;
}
