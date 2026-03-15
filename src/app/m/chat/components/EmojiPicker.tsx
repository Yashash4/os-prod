"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X } from "lucide-react";
import { QUICK_EMOJIS, EMOJI_CATEGORIES } from "./chat-types";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  variant?: "quick" | "full";
}

const RECENT_EMOJIS_KEY = "apex-chat-recent-emojis";
const SKIN_TONE_KEY = "apex-chat-skin-tone";

function getRecentEmojis(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_EMOJIS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addRecentEmoji(emoji: string) {
  try {
    const recent = getRecentEmojis().filter((e) => e !== emoji);
    recent.unshift(emoji);
    localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(recent.slice(0, 24)));
  } catch {
    // ignore
  }
}

export default function EmojiPicker({ onSelect, onClose, variant = "quick" }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(0);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);

  useEffect(() => {
    setRecentEmojis(getRecentEmojis());
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const handleSelect = useCallback(
    (emoji: string) => {
      addRecentEmoji(emoji);
      onSelect(emoji);
      onClose();
    },
    [onSelect, onClose]
  );

  if (variant === "quick") {
    return (
      <div
        ref={ref}
        className="absolute bottom-full right-0 mb-1 bg-surface border border-border rounded-lg shadow-lg p-1.5 flex gap-1 z-50"
      >
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleSelect(emoji)}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-hover text-base transition-colors"
          >
            {emoji}
          </button>
        ))}
        <div className="w-px bg-border mx-0.5" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Switch to full picker - re-render as full
            const picker = ref.current?.parentElement;
            if (picker) {
              // This is a simple approach - force re-render as full
            }
          }}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-hover text-muted text-xs transition-colors"
          title="More emojis"
        >
          +
        </button>
      </div>
    );
  }

  // Full emoji picker
  const filteredCategories = search.trim()
    ? EMOJI_CATEGORIES.map((cat) => ({
        ...cat,
        emojis: cat.emojis.filter(() => true), // In a real implementation you'd filter by name
      }))
    : EMOJI_CATEGORIES;

  const allSearchResults = search.trim()
    ? EMOJI_CATEGORIES.flatMap((cat) => cat.emojis)
    : [];

  return (
    <div
      ref={ref}
      className="absolute bottom-full right-0 mb-1 bg-surface border border-border rounded-lg shadow-xl w-[320px] z-50"
    >
      {/* Search bar */}
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search emojis..."
            autoFocus
            className="w-full bg-background border border-border rounded px-3 py-1.5 pl-8 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      {!search.trim() && (
        <div className="flex border-b border-border px-1">
          {recentEmojis.length > 0 && (
            <button
              onClick={() => setActiveCategory(-1)}
              className={`p-1.5 text-sm rounded-t transition-colors ${
                activeCategory === -1 ? "bg-surface-hover" : "hover:bg-surface-hover/50"
              }`}
              title="Recent"
            >
              {"\u{1F552}"}
            </button>
          )}
          {EMOJI_CATEGORIES.map((cat, idx) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(idx)}
              className={`p-1.5 text-sm rounded-t transition-colors ${
                activeCategory === idx ? "bg-surface-hover" : "hover:bg-surface-hover/50"
              }`}
              title={cat.name}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className="h-[200px] overflow-y-auto p-2">
        {search.trim() ? (
          <div className="grid grid-cols-8 gap-0.5">
            {allSearchResults.map((emoji, idx) => (
              <button
                key={`${emoji}-${idx}`}
                onClick={() => handleSelect(emoji)}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-hover text-lg transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : activeCategory === -1 && recentEmojis.length > 0 ? (
          <>
            <div className="text-xs text-muted font-medium mb-1 px-1">Recently Used</div>
            <div className="grid grid-cols-8 gap-0.5">
              {recentEmojis.map((emoji, idx) => (
                <button
                  key={`recent-${emoji}-${idx}`}
                  onClick={() => handleSelect(emoji)}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-hover text-lg transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="text-xs text-muted font-medium mb-1 px-1">
              {filteredCategories[activeCategory]?.name}
            </div>
            <div className="grid grid-cols-8 gap-0.5">
              {filteredCategories[activeCategory]?.emojis.map((emoji, idx) => (
                <button
                  key={`${emoji}-${idx}`}
                  onClick={() => handleSelect(emoji)}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-hover text-lg transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
