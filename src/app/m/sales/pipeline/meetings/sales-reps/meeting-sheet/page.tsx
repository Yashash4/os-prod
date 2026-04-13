"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import MeetingAnalysisSheet from "@/components/sales/MeetingAnalysisSheet";

function RepMeetingSheetInner() {
  const searchParams = useSearchParams();
  const repId = searchParams.get("repId") || "";
  const repLabel = searchParams.get("repLabel") || "Sales Rep";
  return <MeetingAnalysisSheet owner={repLabel.toLowerCase()} ownerLabel={repLabel} />;
}

export default function RepMeetingSheetPage() {
  return <Suspense fallback={<div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#B8860B] border-t-transparent" /></div>}><RepMeetingSheetInner /></Suspense>;
}
