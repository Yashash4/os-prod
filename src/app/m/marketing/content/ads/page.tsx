"use client";

import { useState } from "react";
import ContentSheet, { type Column } from "@/components/content/ContentSheet";

const STATUS_OPTIONS = ["draft", "in_progress", "review", "approved", "published", "archived"];
const STATUS_COLORS: Record<string, string> = {
  draft: "text-muted",
  in_progress: "text-blue-400",
  review: "text-amber-400",
  approved: "text-green-400",
  published: "text-emerald-400",
  archived: "text-zinc-500",
};

const SCRIPT_COLUMNS: Column[] = [
  { key: "title", label: "Title", type: "text", width: "200px" },
  { key: "platform", label: "Platform", type: "select", options: ["meta", "google", "tiktok", "linkedin", "youtube", "other"], width: "110px" },
  { key: "copy_text", label: "Copy / Script", type: "textarea", width: "300px" },
  { key: "cta", label: "CTA", type: "text", width: "140px" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS, width: "120px" },
  { key: "notes", label: "Notes", type: "textarea", width: "200px" },
];

const GRAPHIC_COLUMNS: Column[] = [
  { key: "title", label: "Title", type: "text", width: "200px" },
  { key: "platform", label: "Platform", type: "select", options: ["meta", "google", "tiktok", "linkedin", "youtube", "other"], width: "110px" },
  { key: "dimensions", label: "Dimensions", type: "text", width: "120px", placeholder: "1080x1080" },
  { key: "designer", label: "Designer", type: "text", width: "130px" },
  { key: "asset_url", label: "Asset URL", type: "url", width: "200px" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS, width: "120px" },
  { key: "notes", label: "Notes", type: "textarea", width: "200px" },
];

type Tab = "script" | "graphic";
const TABS: { key: Tab; label: string }[] = [
  { key: "script", label: "Scripts" },
  { key: "graphic", label: "Graphics" },
];

export default function AdsPage() {
  const [tab, setTab] = useState<Tab>("script");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-5 pb-3 flex-shrink-0 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Ads Content</h1>
            <p className="text-muted text-xs mt-0.5">Ad scripts and graphic briefs</p>
          </div>
        </div>
      </div>

      <div className="flex gap-0 border-b border-border flex-shrink-0 px-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "text-accent border-accent"
                : "text-muted border-transparent hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "script" && (
          <ContentSheet
            key="script"
            columns={SCRIPT_COLUMNS}
            apiPath="/api/marketing/content/ads"
            queryParams={{ type: "script" }}
            statusOptions={STATUS_OPTIONS}
            statusColors={STATUS_COLORS}
            defaultNewRow={{ type: "script", status: "draft" }}
          />
        )}
        {tab === "graphic" && (
          <ContentSheet
            key="graphic"
            columns={GRAPHIC_COLUMNS}
            apiPath="/api/marketing/content/ads"
            queryParams={{ type: "graphic" }}
            statusOptions={STATUS_OPTIONS}
            statusColors={STATUS_COLORS}
            defaultNewRow={{ type: "graphic", status: "draft" }}
          />
        )}
      </div>
    </div>
  );
}
