"use client";

import { useState } from "react";
import { Forward, Hash, MessageSquare, X, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import type { ChatChannel } from "./chat-types";

interface ForwardModalProps {
  messageBody: string;
  messageAuthor?: string;
  channels: ChatChannel[];
  currentChannelId: string;
  currentChannelName?: string;
  onClose: () => void;
  onForwarded?: () => void;
}

export default function ForwardModal({ messageBody, messageAuthor, channels, currentChannelId, currentChannelName, onClose, onForwarded }: ForwardModalProps) {
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const filtered = channels
    .filter((ch) => ch.id !== currentChannelId)
    .filter((ch) => ch.name.toLowerCase().includes(search.toLowerCase()));

  const handleForward = async (channelId: string) => {
    setSending(true);
    try {
      const fromLabel = currentChannelName ? `#${currentChannelName}` : "a conversation";
      const authorLabel = messageAuthor || "someone";
      await apiFetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel_id: channelId,
          body: `> ${messageBody.split("\n").join("\n> ")}\n\n_Forwarded from ${fromLabel} — originally by ${authorLabel}_`,
        }),
      });
      setSentTo(channelId);
      onForwarded?.();
      setTimeout(onClose, 1000);
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Forward className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Forward Message</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover">
            <X className="w-4 h-4 text-muted" />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-border">
          <div className="bg-[#1a1a2e] rounded-lg px-3 py-2 text-xs text-muted line-clamp-2">
            {messageBody}
          </div>
        </div>

        <div className="px-4 py-2 border-b border-border">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search channels..."
            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent"
          />
        </div>

        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-muted py-8">No channels found</p>
          ) : (
            filtered.map((ch) => (
              <button
                key={ch.id}
                onClick={() => handleForward(ch.id)}
                disabled={sending}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-hover transition-colors ${
                  sentTo === ch.id ? "bg-green-500/10" : ""
                }`}
              >
                {ch.type === "dm" ? (
                  <MessageSquare className="w-4 h-4 text-muted" />
                ) : (
                  <Hash className="w-4 h-4 text-muted" />
                )}
                <span className="text-sm text-foreground flex-1">{ch.name}</span>
                {sentTo === ch.id ? (
                  <span className="text-xs text-green-400">Sent!</span>
                ) : sending ? (
                  <Loader2 className="w-3 h-3 text-muted animate-spin" />
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
