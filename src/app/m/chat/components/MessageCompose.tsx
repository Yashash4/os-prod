"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Send, Loader2, Smile, AtSign } from "lucide-react";
import { MemberEntry, extractMentionIds, initials } from "./chat-types";
import FormatToolbar from "./FormatToolbar";
import EmojiPicker from "./EmojiPicker";

/* ── Mention Autocomplete ───────────────────────────────── */

function MentionAutocomplete({
  query,
  members,
  onSelect,
}: {
  query: string;
  members: MemberEntry[];
  onSelect: (member: MemberEntry) => void;
}) {
  const filtered = members.filter((m) => {
    if (!m.user) return false;
    const q = query.toLowerCase();
    return (
      (m.user.full_name || "").toLowerCase().includes(q) ||
      m.user.email.toLowerCase().includes(q)
    );
  });

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
      {filtered.slice(0, 8).map((m) => (
        <button
          key={m.user_id}
          onClick={() => onSelect(m)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-hover transition-colors text-left"
        >
          <span className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] bg-surface-hover text-muted shrink-0">
            {initials(m.user?.full_name, m.user?.email)}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-foreground truncate">
              {m.user?.full_name || m.user?.email}
            </div>
            {m.user?.full_name && (
              <div className="text-xs text-muted truncate">{m.user.email}</div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

/* ── Message Compose ────────────────────────────────────── */

interface MessageComposeProps {
  placeholder: string;
  members: MemberEntry[];
  onSend: (body: string, mentions: string[]) => void;
  sending: boolean;
  channelId?: string | null;
  initialDraft?: string;
  onDraftChange?: (channelId: string, body: string) => void;
  onTyping?: () => void;
}

export default function MessageCompose({
  placeholder,
  members,
  onSend,
  sending,
  channelId,
  initialDraft,
  onDraftChange,
  onTyping,
}: MessageComposeProps) {
  const [draft, setDraft] = useState(initialDraft || "");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset draft when channel changes
  useEffect(() => {
    setDraft(initialDraft || "");
  }, [channelId, initialDraft]);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxH = 5 * 24;
    el.style.height = Math.min(el.scrollHeight, maxH) + "px";
  }, []);

  const handleDraftSave = useCallback(
    (body: string) => {
      if (!channelId || !onDraftChange) return;
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      draftTimerRef.current = setTimeout(() => {
        onDraftChange(channelId, body);
      }, 2000);
    },
    [channelId, onDraftChange]
  );

  const handleTyping = useCallback(() => {
    if (!onTyping) return;
    if (typingTimerRef.current) return; // Already sent recently
    onTyping();
    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
    }, 3000);
  }, [onTyping]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setDraft(val);
      handleDraftSave(val);
      handleTyping();

      // Detect @mention
      const cursorPos = e.target.selectionStart;
      const textBeforeCursor = val.slice(0, cursorPos);
      const atMatch = textBeforeCursor.match(/(?:^|[\s])@([\w][\w\s]*?)$/);
      if (atMatch) {
        const query = atMatch[1];
        if (!query.endsWith(" ")) {
          setMentionQuery(query);
        } else {
          setMentionQuery(null);
        }
      } else {
        const bareAt = textBeforeCursor.match(/(?:^|[\s])@$/);
        if (bareAt) {
          setMentionQuery("");
        } else {
          setMentionQuery(null);
        }
      }

      requestAnimationFrame(adjustHeight);
    },
    [adjustHeight, handleDraftSave, handleTyping]
  );

  const handleMentionSelect = useCallback(
    (member: MemberEntry) => {
      const name = member.user?.full_name || member.user?.email || "";
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = draft.slice(0, cursorPos);
      const atIdx = textBeforeCursor.lastIndexOf("@");
      if (atIdx === -1) return;

      const newDraft = draft.slice(0, atIdx) + "@" + name + " " + draft.slice(cursorPos);
      setDraft(newDraft);
      setMentionQuery(null);

      requestAnimationFrame(() => {
        const newPos = atIdx + name.length + 2;
        textarea.selectionStart = newPos;
        textarea.selectionEnd = newPos;
        textarea.focus();
        adjustHeight();
      });
    },
    [draft, adjustHeight]
  );

  const handleSend = useCallback(() => {
    if (!draft.trim() || sending) return;
    const body = draft.trim();
    const mentions = extractMentionIds(body, members);
    onSend(body, mentions);
    setDraft("");
    setMentionQuery(null);
    // Clear draft on send
    if (channelId && onDraftChange) {
      onDraftChange(channelId, "");
    }
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    });
  }, [draft, sending, members, onSend, channelId, onDraftChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
        return;
      }

      // Keyboard shortcuts for formatting
      if (e.ctrlKey || e.metaKey) {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = draft.slice(start, end);

        let prefix = "";
        let suffix = "";

        if (e.key === "b") {
          e.preventDefault();
          prefix = "**";
          suffix = "**";
        } else if (e.key === "i") {
          e.preventDefault();
          prefix = "*";
          suffix = "*";
        } else if (e.key === "X" && e.shiftKey) {
          e.preventDefault();
          prefix = "~~";
          suffix = "~~";
        } else {
          return;
        }

        const newDraft = draft.slice(0, start) + prefix + selected + suffix + draft.slice(end);
        setDraft(newDraft);
        requestAnimationFrame(() => {
          if (selected) {
            textarea.selectionStart = start;
            textarea.selectionEnd = end + prefix.length + suffix.length;
          } else {
            textarea.selectionStart = start + prefix.length;
            textarea.selectionEnd = start + prefix.length;
          }
          textarea.focus();
        });
      }
    },
    [handleSend, draft]
  );

  const handleSetDraft = useCallback(
    (val: string) => {
      setDraft(val);
      handleDraftSave(val);
      requestAnimationFrame(adjustHeight);
    },
    [handleDraftSave, adjustHeight]
  );

  return (
    <div className="px-4 py-3 border-t border-border">
      <div className="relative">
        {mentionQuery !== null && (
          <MentionAutocomplete
            query={mentionQuery}
            members={members}
            onSelect={handleMentionSelect}
          />
        )}
        {showEmojiPicker && (
          <div className="relative">
            <EmojiPicker
              variant="full"
              onSelect={(emoji) => {
                const textarea = textareaRef.current;
                if (textarea) {
                  const pos = textarea.selectionStart;
                  const newDraft = draft.slice(0, pos) + emoji + draft.slice(pos);
                  setDraft(newDraft);
                  requestAnimationFrame(() => {
                    textarea.selectionStart = pos + emoji.length;
                    textarea.selectionEnd = pos + emoji.length;
                    textarea.focus();
                  });
                }
              }}
              onClose={() => setShowEmojiPicker(false)}
            />
          </div>
        )}
        <div className="bg-surface rounded-lg border border-border focus-within:border-accent transition-colors">
          <FormatToolbar textareaRef={textareaRef} draft={draft} setDraft={handleSetDraft} />
          <div className="flex items-end gap-2 px-3 py-2">
            <button
              onClick={() => setShowEmojiPicker((v) => !v)}
              className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors shrink-0 mb-0.5"
              title="Emoji"
            >
              <Smile className="w-4 h-4" />
            </button>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted outline-none resize-none leading-6 max-h-[120px]"
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim() || sending}
              className="p-1.5 rounded hover:bg-surface-hover text-accent disabled:text-muted disabled:cursor-not-allowed transition-colors shrink-0 mb-0.5"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
