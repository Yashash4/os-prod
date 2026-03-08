"use client";

import ContentSheet, { type Column } from "@/components/content/ContentSheet";

const STATUS_OPTIONS = ["raw", "rough_cut", "review", "revision", "final", "published"];
const STATUS_COLORS: Record<string, string> = {
  raw: "text-muted",
  rough_cut: "text-blue-400",
  review: "text-amber-400",
  revision: "text-orange-400",
  final: "text-green-400",
  published: "text-emerald-400",
};

const COLUMNS: Column[] = [
  { key: "title", label: "Title", type: "text", width: "220px" },
  { key: "raw_footage_url", label: "Raw Footage", type: "url", width: "180px" },
  { key: "editor_assigned", label: "Editor", type: "text", width: "130px" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS, width: "120px" },
  { key: "deadline", label: "Deadline", type: "date", width: "120px" },
  { key: "platform_target", label: "Platform", type: "select", options: ["youtube", "instagram", "tiktok", "linkedin", "other"], width: "110px" },
  { key: "duration", label: "Duration", type: "text", width: "90px" },
  { key: "review_notes", label: "Review Notes", type: "textarea", width: "250px" },
  { key: "final_url", label: "Final URL", type: "url", width: "180px" },
  { key: "notes", label: "Notes", type: "textarea", width: "200px" },
];

export default function VideoEditingPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-5 pb-3 flex-shrink-0 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Video Editing</h1>
            <p className="text-muted text-xs mt-0.5">Video editing pipeline management</p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <ContentSheet
          columns={COLUMNS}
          apiPath="/api/marketing/content/video-editing"
          statusOptions={STATUS_OPTIONS}
          statusColors={STATUS_COLORS}
          defaultNewRow={{ status: "raw" }}
        />
      </div>
    </div>
  );
}
