"use client";

import { useState } from "react";
import ContentSheet, { type Column } from "@/components/content/ContentSheet";

const STATUS_OPTIONS = ["draft", "review", "scheduled", "published", "archived"];
const STATUS_COLORS: Record<string, string> = {
  draft: "text-muted",
  review: "text-amber-400",
  scheduled: "text-blue-400",
  published: "text-green-400",
  archived: "text-zinc-500",
};

const BASE_COLUMNS: Column[] = [
  { key: "title", label: "Title", type: "text", width: "200px" },
  { key: "caption", label: "Caption / Content", type: "textarea", width: "300px" },
  { key: "media_url", label: "Media URL", type: "url", width: "180px" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS, width: "110px" },
  { key: "scheduled_date", label: "Scheduled", type: "date", width: "120px" },
  { key: "published_date", label: "Published", type: "date", width: "120px" },
  { key: "engagement_likes", label: "Likes", type: "number", width: "70px" },
  { key: "engagement_comments", label: "Comments", type: "number", width: "80px" },
  { key: "engagement_shares", label: "Shares", type: "number", width: "70px" },
  { key: "notes", label: "Notes", type: "textarea", width: "200px" },
];

type Tab = "post" | "article" | "carousel";
const TABS: { key: Tab; label: string }[] = [
  { key: "post", label: "Posts" },
  { key: "article", label: "Articles" },
  { key: "carousel", label: "Carousels" },
];

export default function LinkedInPage() {
  const [tab, setTab] = useState<Tab>("post");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-5 pb-3 flex-shrink-0 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">LinkedIn</h1>
            <p className="text-muted text-xs mt-0.5">LinkedIn content management</p>
          </div>
        </div>
      </div>

      <div className="flex gap-0 border-b border-border flex-shrink-0 px-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? "text-accent border-accent" : "text-muted border-transparent hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <ContentSheet
          key={tab}
          columns={BASE_COLUMNS}
          apiPath="/api/marketing/content/social"
          queryParams={{ platform: "linkedin", content_type: tab }}
          statusOptions={STATUS_OPTIONS}
          statusColors={STATUS_COLORS}
          defaultNewRow={{ platform: "linkedin", content_type: tab, status: "draft" }}
        />
      </div>
    </div>
  );
}
