"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Hash, MessageSquare, X } from "lucide-react";
import type { ChatChannel } from "./chat-types";

interface QuickSwitcherProps {
  channels: ChatChannel[];
  onSelect: (channelId: string) => void;
  onClose: () => void;
}

export default function QuickSwitcher({ channels, onSelect, onClose }: QuickSwitcherProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = channels.filter((ch) =>
    ch.name.toLowerCase().includes(query.toLowerCase()) ||
    ch.description?.toLowerCase().includes(query.toLowerCase())
  );

  // Show recent (by last_message) when no query
  const displayed = query
    ? filtered
    : [...channels].sort((a, b) => {
        const aTime = a.last_message?.created_at || a.created_at;
        const bTime = b.last_message?.created_at || b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      }).slice(0, 10);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = useCallback((ch: ChatChannel) => {
    onSelect(ch.id);
    onClose();
  }, [onSelect, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, displayed.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && displayed[selectedIndex]) {
      handleSelect(displayed[selectedIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search channels and conversations..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted outline-none"
          />
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover">
            <X className="w-4 h-4 text-muted" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {displayed.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted">
              No results found
            </div>
          ) : (
            <div className="py-1">
              {!query && <p className="px-4 py-1.5 text-[10px] text-muted uppercase tracking-wider">Recent</p>}
              {displayed.map((ch, i) => (
                <button
                  key={ch.id}
                  onClick={() => handleSelect(ch)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === selectedIndex ? "bg-accent/10" : "hover:bg-surface-hover"
                  }`}
                >
                  {ch.type === "dm" ? (
                    <MessageSquare className="w-4 h-4 text-muted flex-shrink-0" />
                  ) : (
                    <Hash className="w-4 h-4 text-muted flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{ch.name}</p>
                    {ch.description && (
                      <p className="text-xs text-muted truncate">{ch.description}</p>
                    )}
                  </div>
                  {ch.unread_count > 0 && (
                    <span className="text-[10px] bg-accent text-background px-1.5 py-0.5 rounded-full font-bold">
                      {ch.unread_count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-muted">
          <span><kbd className="bg-[#1a1a2e] px-1 py-0.5 rounded">↑↓</kbd> Navigate</span>
          <span><kbd className="bg-[#1a1a2e] px-1 py-0.5 rounded">Enter</kbd> Select</span>
          <span><kbd className="bg-[#1a1a2e] px-1 py-0.5 rounded">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
