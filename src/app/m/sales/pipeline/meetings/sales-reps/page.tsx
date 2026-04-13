"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

interface SalesRep {
  id: string;
  full_name: string;
  status: string;
}

export default function SalesRepsPage() {
  const [reps, setReps] = useState<SalesRep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/hr/employees?is_sales_rep=true")
      .then((res) => res.json())
      .then((data) => setReps(data.records || data.employees || data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#B8860B]" />
      </div>
    );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-[#B8860B]" />
        <h1 className="text-xl font-bold text-white">Sales Reps</h1>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reps.map((rep) => (
          <Link
            key={rep.id}
            href={`/m/sales/pipeline/meetings/sales-reps/meet-management?repId=${rep.id}&repLabel=${encodeURIComponent(rep.full_name)}`}
            className="block p-5 rounded-xl bg-[#1a1a2e] border border-gray-800 hover:border-[#B8860B]/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#B8860B]/20 flex items-center justify-center text-[#B8860B] font-bold">
                {rep.full_name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-white">{rep.full_name}</p>
                <p className="text-sm text-gray-400 capitalize">{rep.status}</p>
              </div>
            </div>
          </Link>
        ))}
        {reps.length === 0 && (
          <p className="text-gray-400 col-span-3">No sales reps found</p>
        )}
      </div>
    </div>
  );
}
