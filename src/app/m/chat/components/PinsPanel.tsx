"use client";

import { useState, useEffect, useCallback } from "react";
import { Pin, X, Loader2, ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { initials, formatTime, parseMessageBody } from "./chat-types";
import type { ChatMessage, ChatUser } from "./chat-types";

interface PinEntry {
  id: string;
  message_id: string;
  pinned_by: string;
  created_at: string;
  message: ChatMessage & { user: ChatUser | null };
}

interface PinsPanelProps {
  channelId: string;
  isAdmin: boolean;
  userId: string;
  onClose: () => void;
  onJumpToMessage?: (messageId: string) => void;
}

export default function PinsPanel({ channelId, isAdmin, userId, onClose, onJumpToMessage }: PinsPanelProps) {
  const [pins, setPins] = useState<PinEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPins = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/chat/pins?channel_id=${channelId}`);
      const data = await res.json();
      setPins(data.pins || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    fetchPins();
  }, [fetchPins]);

  const handleUnpin = async (pinId: string) => {
    try {
      await apiFetch(`/api/chat/pins?id=${pinId}`, { method: "DELETE" });
      setPins((prev) => prev.filter((p) => p.id !== pinId));
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Pin className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">Pinned Messages</h3>
          <span className="text-xs text-muted">({pins.length})</span>
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
        ) : pins.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Pin className="w-8 h-8 text-muted mx-auto mb-2" />
            <p className="text-sm text-muted">No pinned messages</p>
            <p className="text-xs text-muted/60 mt-1">Pin important messages for easy reference</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {pins.map((pin) => (
              <div key={pin.id} className="bg-surface border border-border rounded-lg p-3 hover:border-accent/30 transition-colors">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-accent">
                      {initials(pin.message?.user?.full_name, pin.message?.user?.email)}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-foreground">
                    {pin.message?.user?.full_name || "Unknown"}
                  </span>
                  <span className="text-[10px] text-muted">{formatTime(pin.message?.created_at || pin.created_at)}</span>
                  <div className="flex-1" />
                  {(isAdmin || pin.pinned_by === userId) && (
                    <button
                      onClick={() => handleUnpin(pin.id)}
                      className="p-0.5 rounded hover:bg-surface-hover text-muted hover:text-red-400 transition-colors"
                      title="Unpin"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div
                  className="text-xs text-muted leading-relaxed line-clamp-3"
                  dangerouslySetInnerHTML={{ __html: parseMessageBody(pin.message?.body || "") }}
                />
                {onJumpToMessage && (
                  <button
                    onClick={() => onJumpToMessage(pin.message_id)}
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
