"use client";

import { useState, useEffect, useCallback } from "react";
import { Bookmark, X, Loader2, ExternalLink, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { initials, formatTime, parseMessageBody } from "./chat-types";
import type { SavedMessage } from "./chat-types";

interface SavedItemsProps {
  onClose: () => void;
  onJumpToMessage?: (channelId: string, messageId: string) => void;
}

export default function SavedItems({ onClose, onJumpToMessage }: SavedItemsProps) {
  const [items, setItems] = useState<SavedMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSaved = useCallback(async () => {
    try {
      const res = await apiFetch("/api/chat/saved");
      const data = await res.json();
      setItems(data.saved || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved]);

  const handleUnsave = async (messageId: string) => {
    try {
      await apiFetch(`/api/chat/saved?message_id=${messageId}`, { method: "DELETE" });
      setItems((prev) => prev.filter((s) => s.message_id !== messageId));
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">Saved Items</h3>
          <span className="text-xs text-muted">({items.length})</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover">
          <X className="w-4 h-4 text-muted" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-muted animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Bookmark className="w-8 h-8 text-muted mx-auto mb-2" />
            <p className="text-sm text-muted">No saved messages</p>
            <p className="text-xs text-muted/60 mt-1">Save messages to find them here later</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {items.map((item) => (
              <div key={item.id} className="bg-surface border border-border rounded-lg p-3 hover:border-accent/30 transition-colors group">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-accent">
                      {initials(item.message?.user?.full_name, item.message?.user?.email)}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-foreground">
                    {item.message?.user?.full_name || "Unknown"}
                  </span>
                  <span className="text-[10px] text-muted">{formatTime(item.message?.created_at || item.created_at)}</span>
                  <div className="flex-1" />
                  <button
                    onClick={() => handleUnsave(item.message_id)}
                    className="p-0.5 rounded hover:bg-surface-hover text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove from saved"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div
                  className="text-xs text-muted leading-relaxed line-clamp-3"
                  dangerouslySetInnerHTML={{ __html: parseMessageBody(item.message?.body || "") }}
                />
                {onJumpToMessage && (
                  <button
                    onClick={() => onJumpToMessage(item.message?.channel_id, item.message_id)}
                    className="flex items-center gap-1 mt-2 text-[10px] text-accent hover:text-accent/80 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" /> Jump to message
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
