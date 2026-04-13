"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-fetch";
import { supabase } from "@/lib/supabase";
import Shell from "@/components/Shell";
import AuthGuard from "@/components/AuthGuard";
import {
  Hash,
  MessageCircle,
  Send,
  Plus,
  X,
  Loader2,
  Users,
  Search,
  Check,
  Smile,
  Reply,
  Pencil,
  Trash2,
  AtSign,
  Pin,
  Bookmark,
  Copy,
  Forward,
  Clock,
  ListTodo,
  Bell,
  MailOpen,
  CheckSquare,
  Calendar,
  MoreHorizontal,
  ChevronRight,
} from "lucide-react";
import PinsPanel from "./components/PinsPanel";
import SavedItems from "./components/SavedItems";
import QuickSwitcher from "./components/QuickSwitcher";
import ForwardModal from "./components/ForwardModal";
import FormatToolbar from "./components/FormatToolbar";
import {
  parseMessageBody,
  formatDateDivider,
  isSameDay,
  getRoleColor,
} from "./components/chat-types";

/* ── Types ───────────────────────────────────────── */

interface ChatUser {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url?: string;
}

interface Reaction {
  emoji: string;
  count: number;
  user_ids: string[];
}

interface ChatMessage {
  id: string;
  channel_id: string;
  user_id: string;
  body: string;
  parent_id: string | null;
  reply_count: number;
  edited_at: string | null;
  is_deleted: boolean;
  created_at: string;
  user: ChatUser | null;
  reactions: Reaction[];
}

interface ChatChannel {
  id: string;
  name: string;
  description: string | null;
  type: "channel" | "dm";
  is_private?: boolean;
  is_announcement?: boolean;
  created_by: string;
  created_at: string;
  last_message: {
    id: string;
    body: string;
    created_at: string;
    user_id: string;
    user: { full_name: string | null } | null;
  } | null;
  unread_count: number;
  dm_user?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

interface DmEligibleUser {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url?: string | null;
  is_admin?: boolean;
}

interface MemberEntry {
  id: string;
  channel_id: string;
  user_id: string;
  user: ChatUser | null;
}

/* ── Constants ───────────────────────────────────── */

const QUICK_EMOJIS = ["\u{1F44D}", "\u{2764}\u{FE0F}", "\u{1F604}", "\u{1F389}", "\u{1F440}", "\u{1F525}"];
const MSG_GROUP_GAP_MS = 300000; // 5 minutes

/* ── Helpers ─────────────────────────────────────── */

function initials(name: string | null | undefined, email?: string): string {
  if (name) {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return (email || "?")[0].toUpperCase();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Render message body with @mentions highlighted */
function renderBody(body: string, members?: MemberEntry[]): React.ReactNode {
  if (!members || members.length === 0) {
    // No member list — simple fallback: highlight @Word or @Word Word patterns
    const parts = body.split(/(@\S+(?:\s+[A-Z]\S*)*)/g);
    return parts.map((part, i) =>
      part.startsWith("@") ? (
        <span key={i} className="text-accent font-medium">{part}</span>
      ) : (
        part
      )
    );
  }

  // Build sorted list of known names (longest first to match greedily)
  const namePatterns: string[] = [];
  for (const m of members) {
    if (m.user?.full_name) namePatterns.push(m.user.full_name);
    if (m.user?.email) namePatterns.push(m.user.email.split("@")[0]);
  }
  namePatterns.sort((a, b) => b.length - a.length);

  const escaped = namePatterns.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(@(?:${escaped.join("|")}))`, "gi");
  const parts = body.split(regex);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="text-accent font-medium">{part}</span>
    ) : (
      part
    )
  );
}

/** Extract @Name mentions from text and resolve to user IDs */
function extractMentionIds(
  text: string,
  members: MemberEntry[]
): string[] {
  const ids: string[] = [];
  // Build lookup of known names/emails to match against
  for (const m of members) {
    const fullName = m.user?.full_name;
    const emailPrefix = m.user?.email?.split("@")[0];
    if (fullName && text.toLowerCase().includes("@" + fullName.toLowerCase())) {
      ids.push(m.user_id);
    } else if (emailPrefix && text.toLowerCase().includes("@" + emailPrefix.toLowerCase())) {
      ids.push(m.user_id);
    }
  }
  return [...new Set(ids)];
}

/* ── Sub-Components ──────────────────────────────── */

/** Avatar circle */
function Avatar({
  name,
  email,
  isOwn,
  size = "sm",
}: {
  name: string | null | undefined;
  email?: string;
  isOwn?: boolean;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "md" ? "w-8 h-8 text-xs" : "w-7 h-7 text-[10px]";
  return (
    <span
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold shrink-0 ${
        isOwn ? "bg-accent/20 text-accent" : "bg-surface-hover text-muted"
      }`}
    >
      {initials(name, email)}
    </span>
  );
}

/** Emoji picker popover (small set) */
function EmojiPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full right-0 mb-1 bg-surface border border-border rounded-lg shadow-lg p-1.5 flex gap-1 z-50"
    >
      {QUICK_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => {
            onSelect(emoji);
            onClose();
          }}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-hover text-base transition-colors"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

/** Floating action bar on message hover */
function MessageActions({
  isOwn,
  canEdit,
  hasThread,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onPin,
  onSave,
  onCopy,
  onForward,
  onMarkUnread,
  onCreateTask,
  onRemindAt,
}: {
  isOwn: boolean;
  canEdit?: boolean;
  hasThread?: boolean;
  onReply?: () => void;
  onReact: (emoji: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onPin?: () => void;
  onSave?: () => void;
  onCopy?: () => void;
  onForward?: () => void;
  onMarkUnread?: () => void;
  onCreateTask?: () => void;
  onRemindAt?: (remindAt: string) => void;
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showRemindMenu, setShowRemindMenu] = useState(false);

  const remindOptions = [
    { label: "20 minutes", getTime: () => new Date(Date.now() + 20 * 60 * 1000).toISOString() },
    { label: "1 hour", getTime: () => new Date(Date.now() + 60 * 60 * 1000).toISOString() },
    { label: "3 hours", getTime: () => new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() },
    {
      label: "Tomorrow (9 AM)",
      getTime: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d.toISOString();
      },
    },
    {
      label: "Next week (Monday 9 AM)",
      getTime: () => {
        const d = new Date();
        const dayOfWeek = d.getDay();
        const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
        d.setDate(d.getDate() + daysUntilMonday);
        d.setHours(9, 0, 0, 0);
        return d.toISOString();
      },
    },
  ];

  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close more menu on outside click
  useEffect(() => {
    if (!showMore) return;
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMore]);

  const ActionBtn = ({ icon: Icon, label, onClick, danger }: { icon: React.ElementType; label: string; onClick?: () => void; danger?: boolean }) => (
    <button
      onClick={() => { onClick?.(); setShowMore(false); }}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left transition-colors ${danger ? "text-red-400 hover:bg-red-500/10" : "text-muted hover:text-foreground hover:bg-surface-hover"}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {label}
    </button>
  );

  return (
    <div className={`absolute -top-3 right-2 bg-surface border border-border rounded-md shadow-md flex items-center gap-0.5 p-0.5 z-30 transition-opacity ${showMore || showEmojiPicker || showRemindMenu ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
      {/* Quick actions — always visible */}
      {onReply && (
        <button onClick={onReply} title="Reply" className="p-1.5 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors">
          <Reply className="w-3.5 h-3.5" />
        </button>
      )}
      <div className="relative">
        <button onClick={() => setShowEmojiPicker((v) => !v)} title="React" className="p-1.5 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors">
          <Smile className="w-3.5 h-3.5" />
        </button>
        {showEmojiPicker && <EmojiPicker onSelect={onReact} onClose={() => setShowEmojiPicker(false)} />}
      </div>

      {/* More menu — everything else */}
      <div className="relative" ref={moreRef}>
        <button onClick={() => setShowMore((v) => !v)} title="More actions" className="p-1.5 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors">
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
        {showMore && (
          <div className="absolute right-0 bottom-full mb-1 w-48 bg-surface border border-border rounded-lg shadow-xl py-1 z-50">
            {onPin && <ActionBtn icon={Pin} label="Pin message" onClick={onPin} />}
            {onSave && <ActionBtn icon={Bookmark} label="Save message" onClick={onSave} />}
            {onCopy && <ActionBtn icon={Copy} label="Copy text" onClick={onCopy} />}
            {onForward && <ActionBtn icon={Forward} label="Forward" onClick={onForward} />}
            {onMarkUnread && <ActionBtn icon={MailOpen} label="Mark unread" onClick={onMarkUnread} />}
            {onCreateTask && <ActionBtn icon={ListTodo} label="Create task" onClick={onCreateTask} />}
            {onRemindAt && (
              <div className="relative">
                <button
                  onClick={() => setShowRemindMenu((v) => !v)}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                >
                  <Bell className="w-3.5 h-3.5 shrink-0" />
                  Remind me
                  <ChevronRight className="w-3 h-3 ml-auto" />
                </button>
                {showRemindMenu && (
                  <RemindMenu
                    options={remindOptions}
                    onSelect={(remindAt) => { onRemindAt(remindAt); setShowMore(false); setShowRemindMenu(false); }}
                    onClose={() => setShowRemindMenu(false)}
                  />
                )}
              </div>
            )}
            {isOwn && canEdit !== false && (
              <>
                <div className="h-px bg-border my-1" />
                <ActionBtn icon={Pencil} label="Edit message" onClick={onEdit} />
              </>
            )}
            {isOwn && (
              <>
                {!(isOwn && canEdit !== false) && <div className="h-px bg-border my-1" />}
                <ActionBtn icon={Trash2} label="Delete message" onClick={onDelete} danger />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Remind me submenu */
function RemindMenu({
  options,
  onSelect,
  onClose,
}: {
  options: { label: string; getTime: () => string }[];
  onSelect: (remindAt: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full right-0 mb-1 bg-surface border border-border rounded-lg shadow-lg w-52 z-50"
    >
      <div className="p-1">
        <div className="px-2 py-1 text-xs text-muted font-medium">Remind me</div>
        {options.map((opt) => (
          <button
            key={opt.label}
            onClick={() => onSelect(opt.getTime())}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-foreground hover:bg-surface-hover rounded transition-colors text-left"
          >
            <Clock className="w-3.5 h-3.5 text-muted" />
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Create task from message modal */
function CreateTaskModal({
  messageBody,
  members,
  onClose,
  onSubmit,
}: {
  messageBody: string;
  members: MemberEntry[];
  onClose: () => void;
  onSubmit: (task: { title: string; description: string; assigned_to: string; due_date: string }) => void;
}) {
  const firstLine = messageBody.split("\n")[0].slice(0, 100);
  const [title, setTitle] = useState(firstLine);
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface border border-border rounded-lg w-full max-w-sm mx-4 shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CheckSquare className="w-4 h-4" />
            Create Task from Message
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs text-muted mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Assignee</label>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user?.full_name || m.user?.email || "Unknown"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!title.trim()) return;
              onSubmit({
                title: title.trim(),
                description: messageBody,
                assigned_to: assignee,
                due_date: dueDate,
              });
            }}
            disabled={!title.trim()}
            className="px-3 py-1.5 rounded text-sm bg-accent hover:bg-accent/90 text-white disabled:opacity-50 transition-colors"
          >
            Create Task
          </button>
        </div>
      </div>
    </div>
  );
}

/** Reactions row below a message */
function ReactionsRow({
  reactions,
  currentUserId,
  onToggle,
}: {
  reactions: Reaction[];
  currentUserId: string | undefined;
  onToggle: (emoji: string) => void;
}) {
  if (!reactions || reactions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 pl-9 mt-1">
      {reactions.map((r) => {
        const hasReacted = currentUserId
          ? r.user_ids.includes(currentUserId)
          : false;
        return (
          <button
            key={r.emoji}
            onClick={() => onToggle(r.emoji)}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
              hasReacted
                ? "bg-accent/20 border-accent text-foreground"
                : "bg-surface border-border text-muted hover:border-accent/50"
            }`}
          >
            <span>{r.emoji}</span>
            <span>{r.count}</span>
          </button>
        );
      })}
    </div>
  );
}

/** @mention autocomplete dropdown */
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
          <Avatar name={m.user?.full_name} email={m.user?.email} />
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

/** Auto-resizing textarea input with @mention support */
function ChatInput({
  placeholder,
  members,
  onSend,
  sending,
  initialDraft,
  onDraftChange,
  showAlsoSendToChannel,
  channelName,
  onAlsoSendToggle,
  alsoSendToChannel,
}: {
  placeholder: string;
  members: MemberEntry[];
  onSend: (body: string, mentions: string[], isSilent?: boolean) => void;
  sending: boolean;
  initialDraft?: string;
  onDraftChange?: (body: string) => void;
  showAlsoSendToChannel?: boolean;
  channelName?: string;
  onAlsoSendToggle?: (checked: boolean) => void;
  alsoSendToChannel?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [showEmojiPickerInput, setShowEmojiPickerInput] = useState(false);

  // Reset draft when channel changes (detected via placeholder change)
  useEffect(() => {
    setDraft("");
  }, [placeholder]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxH = 5 * 24; // ~5 lines
    el.style.height = Math.min(el.scrollHeight, maxH) + "px";
  }, []);

  /** Insert markdown formatting around selection or at cursor */
  const applyInlineFormat = useCallback((prefix: string, suffix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = draft.slice(start, end);
    let newText: string;
    let newCursorPos: number;
    if (selected) {
      newText = draft.slice(0, start) + prefix + selected + suffix + draft.slice(end);
      newCursorPos = start + prefix.length + selected.length + suffix.length;
    } else {
      newText = draft.slice(0, start) + prefix + suffix + draft.slice(end);
      newCursorPos = start + prefix.length;
    }
    setDraft(newText);
    onDraftChange?.(newText);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = newCursorPos;
      textarea.selectionEnd = newCursorPos;
    });
  }, [draft, onDraftChange]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setDraft(val);
      onDraftChange?.(val);

      // Detect @mention — look for @ preceded by space/start, allow spaces in names
      const cursorPos = e.target.selectionStart;
      const textBeforeCursor = val.slice(0, cursorPos);
      const atMatch = textBeforeCursor.match(/(?:^|[\s])@([\w][\w\s]*?)$/);
      if (atMatch) {
        // Don't show autocomplete if query ends with space (completed mention)
        const query = atMatch[1];
        if (!query.endsWith(" ")) {
          setMentionQuery(query);
        } else {
          setMentionQuery(null);
        }
      } else {
        // Also match bare @ at end (show all members)
        const bareAt = textBeforeCursor.match(/(?:^|[\s])@$/);
        if (bareAt) {
          setMentionQuery("");
        } else {
          setMentionQuery(null);
        }
      }

      requestAnimationFrame(adjustHeight);
    },
    [adjustHeight, onDraftChange]
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

      const newDraft =
        draft.slice(0, atIdx) + "@" + name + " " + draft.slice(cursorPos);
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

  const handleSend = useCallback((isSilent = false) => {
    if (!draft.trim() || sending) return;
    const body = draft.trim();
    const mentions = extractMentionIds(body, members);
    onSend(body, mentions, isSilent);
    setDraft("");
    setMentionQuery(null);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    });
  }, [draft, sending, members, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter to send, Shift+Enter for newline
      if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        handleSend(false);
      }
      // Alt+Enter for silent send
      if (e.key === "Enter" && e.altKey) {
        e.preventDefault();
        handleSend(true);
      }
      // Ctrl+B for bold
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        applyInlineFormat("**", "**");
      }
      // Ctrl+I for italic
      if ((e.ctrlKey || e.metaKey) && e.key === "i") {
        e.preventDefault();
        applyInlineFormat("*", "*");
      }
      // Ctrl+Shift+X for strikethrough
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "X") {
        e.preventDefault();
        applyInlineFormat("~~", "~~");
      }
      // Ctrl+Shift+C for inline code
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "C") {
        e.preventDefault();
        applyInlineFormat("`", "`");
      }
      // Ctrl+E for emoji picker toggle
      if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        setShowEmojiPickerInput((v) => !v);
      }
    },
    [handleSend, applyInlineFormat]
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
        <div className="bg-surface rounded-lg border border-border focus-within:border-accent transition-colors">
          {/* Format Toolbar */}
          <FormatToolbar textareaRef={textareaRef} draft={draft} setDraft={(val) => { setDraft(val); onDraftChange?.(val); }} />
          <div className="flex items-end gap-2 px-3 py-2">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted outline-none resize-none leading-6 max-h-[120px]"
            />
            <div className="relative shrink-0">
              <button
                onClick={() => setShowEmojiPickerInput((v) => !v)}
                title="Emoji (Ctrl+E)"
                className="p-1.5 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors mb-0.5"
              >
                <Smile className="w-4 h-4" />
              </button>
              {showEmojiPickerInput && (
                <EmojiPicker
                  onSelect={(emoji) => {
                    const textarea = textareaRef.current;
                    if (textarea) {
                      const start = textarea.selectionStart;
                      const newDraft = draft.slice(0, start) + emoji + draft.slice(textarea.selectionEnd);
                      setDraft(newDraft);
                      onDraftChange?.(newDraft);
                      requestAnimationFrame(() => {
                        textarea.focus();
                        textarea.selectionStart = start + emoji.length;
                        textarea.selectionEnd = start + emoji.length;
                      });
                    }
                    setShowEmojiPickerInput(false);
                  }}
                  onClose={() => setShowEmojiPickerInput(false)}
                />
              )}
            </div>
            <div className="flex flex-col items-center shrink-0 mb-0.5">
              <button
                onClick={() => handleSend(false)}
                disabled={!draft.trim() || sending}
                title="Send (Enter)"
                className="p-1.5 rounded hover:bg-surface-hover text-accent disabled:text-muted disabled:cursor-not-allowed transition-colors"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          {/* Also send to channel checkbox (thread replies) */}
          {showAlsoSendToChannel && (
            <div className="px-3 pb-2">
              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={alsoSendToChannel || false}
                  onChange={(e) => onAlsoSendToggle?.(e.target.checked)}
                  className="accent-accent"
                />
                Also send to #{channelName}
              </label>
            </div>
          )}
          <div className="px-3 pb-1 text-[10px] text-muted">
            Alt+Enter for silent send
          </div>
        </div>
      </div>
    </div>
  );
}

/** Delete confirmation dialog */
function DeleteConfirmDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface border border-border rounded-lg w-full max-w-sm mx-4 shadow-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-2">
          Delete message
        </h3>
        <p className="text-sm text-muted mb-4">
          Are you sure you want to delete this message? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 rounded text-sm bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────── */

export default function ChatPage() {
  const { user, isAdmin, role } = useAuth();
  // Fallback: check role directly in case isAdmin has timing issues
  const adminCheck = isAdmin || role?.is_admin === true;
  const router = useRouter();
  const pathname = usePathname();

  // Channel state
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(true);

  // URL sync helper — called from the existing selectChannel function
  const updateChannelUrl = useCallback((id: string | null) => {
    if (id) {
      router.replace(`${pathname}?channel=${id}`, { scroll: false });
    } else {
      router.replace(pathname, { scroll: false });
    }
  }, [router, pathname]);

  // Messages state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMain, setSendingMain] = useState(false);

  // Members
  const [members, setMembers] = useState<MemberEntry[]>([]);

  // Right panel state
  const [rightPanel, setRightPanel] = useState<"none" | "members" | "thread" | "pins" | "saved">(
    "none"
  );

  // Quick switcher + forward modal
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<ChatMessage | null>(null);
  const [threadParentId, setThreadParentId] = useState<string | null>(null);
  const [threadReplies, setThreadReplies] = useState<ChatMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sendingThread, setSendingThread] = useState(false);

  // Inline edit state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  // Delete confirmation
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(
    null
  );

  // New channel modal
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChName, setNewChName] = useState("");
  const [newChDesc, setNewChDesc] = useState("");
  const [newChType, setNewChType] = useState<"public" | "private" | "announcement">("public");
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [creatingChannel, setCreatingChannel] = useState(false);

  // DM modal
  const [showNewDm, setShowNewDm] = useState(false);
  const [dmUsers, setDmUsers] = useState<DmEligibleUser[]>([]);
  const [dmSearch, setDmSearch] = useState("");
  const [loadingDmUsers, setLoadingDmUsers] = useState(false);
  const [creatingDm, setCreatingDm] = useState(false);

  // Delete channel
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Role color map
  const [roleMap, setRoleMap] = useState<Record<string, { roleName: string; isAdmin: boolean }>>({});

  // Typing indicators
  const [typingUsers, setTypingUsers] = useState<{ user_id: string; full_name: string }[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  // Draft auto-save
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draftSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Connection status
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('connected');

  // Add member to existing channel
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  // Search messages
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Create task from message
  const [taskFromMessage, setTaskFromMessage] = useState<ChatMessage | null>(null);

  // Also send to channel (thread replies)
  const [alsoSendToChannel, setAlsoSendToChannel] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) || null,
    [channels, activeChannelId]
  );

  // Can current user manage a channel (create/delete/add-remove members)
  const canManageChannel = useCallback(
    (ch: ChatChannel | null) => {
      if (!ch || !user) return false;
      return adminCheck || ch.created_by === user.id;
    },
    [adminCheck, user]
  );

  const threadParent = useMemo(
    () => messages.find((m) => m.id === threadParentId) || null,
    [messages, threadParentId]
  );

  const channelList = useMemo(
    () => channels.filter((c) => c.type === "channel"),
    [channels]
  );

  const dmList = useMemo(
    () => channels.filter((c) => c.type === "dm"),
    [channels]
  );

  /* ── Fetch channels ────────────────────────── */

  const fetchChannels = useCallback(async () => {
    try {
      const res = await apiFetch("/api/chat/channels");
      const data = await res.json();
      if (data.channels) setChannels(data.channels);
    } catch {
      // ignore
    } finally {
      setLoadingChannels(false);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Auto-select channel from URL on initial load
  useEffect(() => {
    if (loadingChannels || channels.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const urlChannel = params.get("channel");
    if (urlChannel && channels.some((c) => c.id === urlChannel)) {
      setActiveChannelId(urlChannel);
    }
  }, [loadingChannels, channels]);

  /* ── Fetch role map for name colors ─────────── */

  useEffect(() => {
    async function fetchRoles() {
      try {
        const res = await apiFetch("/api/admin/users");
        if (!res.ok) return;
        const data = await res.json();
        const map: Record<string, { roleName: string; isAdmin: boolean }> = {};
        (data.users || []).forEach((u: { id: string; role?: { name?: string; is_admin?: boolean } }) => {
          map[u.id] = { roleName: u.role?.name || "", isAdmin: u.role?.is_admin || false };
        });
        setRoleMap(map);
      } catch {
        // Non-admin users may not have access — silently ignore
      }
    }
    fetchRoles();
  }, []);

  /* ── Fetch messages for active channel ─────── */

  const fetchMessages = useCallback(async (channelId: string) => {
    setLoadingMessages(true);
    try {
      const res = await apiFetch(
        `/api/chat/messages?channel_id=${channelId}`
      );
      const data = await res.json();
      if (data.messages) {
        setMessages([...data.messages].reverse());
      }
    } catch {
      // ignore
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const fetchMembers = useCallback(async (channelId: string) => {
    try {
      const res = await apiFetch(
        `/api/chat/channels/members?channel_id=${channelId}`
      );
      const data = await res.json();
      if (data.members) setMembers(data.members);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (activeChannelId) {
      fetchMessages(activeChannelId);
      fetchMembers(activeChannelId);
    } else {
      setMessages([]);
      setMembers([]);
    }
  }, [activeChannelId, fetchMessages, fetchMembers]);

  /* ── Fetch thread replies ──────────────────── */

  const fetchThreadReplies = useCallback(
    async (parentId: string) => {
      if (!activeChannelId) return;
      setLoadingThread(true);
      try {
        const res = await apiFetch(
          `/api/chat/messages?channel_id=${activeChannelId}&parent_id=${parentId}`
        );
        const data = await res.json();
        if (data.messages) {
          setThreadReplies([...data.messages].reverse());
        }
      } catch {
        // ignore
      } finally {
        setLoadingThread(false);
      }
    },
    [activeChannelId]
  );

  useEffect(() => {
    if (threadParentId && rightPanel === "thread") {
      fetchThreadReplies(threadParentId);
    }
  }, [threadParentId, rightPanel, fetchThreadReplies]);

  /* ── Realtime subscription ─────────────────── */

  useEffect(() => {
    if (!activeChannelId) return;

    const channel = supabase
      .channel(`chat:${activeChannelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${activeChannelId}`,
        },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;

          // Enrich user data if missing
          const enrichUser = async (msg: ChatMessage): Promise<ChatMessage> => {
            if (msg.user) return msg;
            try {
              const res = await apiFetch(
                `/api/chat/channels/members?channel_id=${activeChannelId}`
              );
              const d = await res.json();
              if (d.members) {
                const member = d.members.find(
                  (m: MemberEntry) => m.user_id === msg.user_id
                );
                if (member?.user) return { ...msg, user: member.user };
              }
            } catch {
              // ignore
            }
            return msg;
          };

          // Ensure defaults for new fields
          const enriched = await enrichUser({
            ...newMsg,
            reactions: newMsg.reactions || [],
            reply_count: newMsg.reply_count || 0,
            is_deleted: newMsg.is_deleted || false,
            edited_at: newMsg.edited_at || null,
            parent_id: newMsg.parent_id || null,
          });

          if (enriched.parent_id) {
            // Thread reply: update reply count on parent, add to thread if open
            setMessages((prev) =>
              prev.map((m) =>
                m.id === enriched.parent_id
                  ? { ...m, reply_count: (m.reply_count || 0) + 1 }
                  : m
              )
            );
            setThreadReplies((prev) => {
              if (prev.some((m) => m.id === enriched.id)) return prev;
              // Replace optimistic message from same user if exists
              const optimisticIdx = prev.findIndex(
                (m) => m.id.startsWith("optimistic-") && m.user_id === enriched.user_id && m.body === enriched.body
              );
              if (optimisticIdx >= 0) {
                const updated = [...prev];
                updated[optimisticIdx] = enriched;
                return updated;
              }
              return [...prev, enriched];
            });
          } else {
            // Top-level message
            setMessages((prev) => {
              if (prev.some((m) => m.id === enriched.id)) return prev;
              // Replace optimistic message from same user if exists
              const optimisticIdx = prev.findIndex(
                (m) => m.id.startsWith("optimistic-") && m.user_id === enriched.user_id && m.body === enriched.body
              );
              if (optimisticIdx >= 0) {
                const updated = [...prev];
                updated[optimisticIdx] = enriched;
                return updated;
              }
              return [...prev, enriched];
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${activeChannelId}`,
        },
        (payload) => {
          const updated = payload.new as ChatMessage;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
          );
          setThreadReplies((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
          );
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnectionStatus("connected");
        else if (status === "CHANNEL_ERROR") setConnectionStatus("disconnected");
        else if (status === "TIMED_OUT") setConnectionStatus("reconnecting");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannelId]);

  /* ── Typing indicator subscription ──────────── */

  useEffect(() => {
    if (!activeChannelId || !user) return;

    const presenceChannel = supabase
      .channel(`presence:${activeChannelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_presence",
          filter: `typing_in=eq.${activeChannelId}`,
        },
        async () => {
          // Re-fetch typing users for this channel
          try {
            const memberIds = members.map((m) => m.user_id).filter((id) => id !== user.id);
            if (memberIds.length === 0) return;
            const res = await apiFetch(`/api/chat/presence?user_ids=${memberIds.join(",")}`);
            const data = await res.json();
            if (data.presence) {
              const typing: { user_id: string; full_name: string }[] = [];
              for (const [uid, p] of Object.entries(data.presence)) {
                const pres = p as { typing_in?: string | null };
                if (pres.typing_in === activeChannelId && uid !== user.id) {
                  const member = members.find((m) => m.user_id === uid);
                  typing.push({
                    user_id: uid,
                    full_name: member?.user?.full_name || member?.user?.email || "Someone",
                  });
                }
              }
              setTypingUsers(typing);
            }
          } catch {
            // ignore
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
      setTypingUsers([]);
    };
  }, [activeChannelId, user, members]);

  /* ── Draft auto-save and restore ─────────────── */

  const saveDraft = useCallback(
    async (channelId: string, body: string) => {
      try {
        if (body.trim()) {
          await apiFetch("/api/chat/drafts", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channel_id: channelId, body }),
          });
        } else {
          await apiFetch(`/api/chat/drafts?channel_id=${channelId}`, {
            method: "DELETE",
          });
        }
      } catch {
        // ignore
      }
    },
    []
  );

  const loadDraft = useCallback(async (channelId: string): Promise<string> => {
    try {
      const res = await apiFetch(`/api/chat/drafts?channel_id=${channelId}`);
      const data = await res.json();
      return data.draft?.body || "";
    } catch {
      return "";
    }
  }, []);

  /* ── Typing send helper ──────────────────────── */

  const sendTypingStatus = useCallback(
    (channelId: string | null) => {
      apiFetch("/api/chat/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typing_in: channelId }),
      }).catch(() => {});
    },
    []
  );

  /* ── Keyboard shortcuts ────────────────────── */

  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      // Ctrl+K — quick switcher
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowQuickSwitcher((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleGlobalKey);
    return () => document.removeEventListener("keydown", handleGlobalKey);
  }, []);

  /* ── Auto-scroll ───────────────────────────── */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadReplies]);

  /* ── Message actions ───────────────────────── */

  const handleSendMain = useCallback(
    async (body: string, mentions: string[], isSilent?: boolean) => {
      if (!activeChannelId || !user) return;
      setSendingMain(true);

      // Optimistic: show the message instantly
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticMsg: ChatMessage = {
        id: optimisticId,
        channel_id: activeChannelId,
        user_id: user.id,
        body,
        parent_id: null,
        is_deleted: false,
        edited_at: null,
        reactions: [],
        reply_count: 0,
        created_at: new Date().toISOString(),
        user: { id: user.id, full_name: user.full_name, email: user.email, avatar_url: user.avatar_url || undefined },
      };
      setMessages((prev) => [...prev, optimisticMsg]);

      try {
        const res = await apiFetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel_id: activeChannelId,
            body,
            mentions: mentions.length > 0 ? mentions : undefined,
            is_silent: isSilent || undefined,
          }),
        });
        const data = await res.json();
        // Replace optimistic message with real one from server
        if (data.message) {
          setMessages((prev) =>
            prev.map((m) => (m.id === optimisticId ? { ...data.message, user: optimisticMsg.user } : m))
          );
        }
        setChannels((prev) =>
          prev.map((ch) =>
            ch.id === activeChannelId ? { ...ch, unread_count: 0 } : ch
          )
        );
      } catch {
        // Remove optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      } finally {
        setSendingMain(false);
      }
    },
    [activeChannelId, user]
  );

  const handleSendThread = useCallback(
    async (body: string, mentions: string[], isSilent?: boolean) => {
      if (!activeChannelId || !threadParentId || !user) return;
      setSendingThread(true);

      // Optimistic: show the reply instantly
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticMsg: ChatMessage = {
        id: optimisticId,
        channel_id: activeChannelId,
        user_id: user.id,
        body,
        parent_id: threadParentId,
        is_deleted: false,
        edited_at: null,
        reactions: [],
        reply_count: 0,
        created_at: new Date().toISOString(),
        user: { id: user.id, full_name: user.full_name, email: user.email, avatar_url: user.avatar_url || undefined },
      };
      setThreadReplies((prev) => [...prev, optimisticMsg]);
      // Bump reply count on parent
      setMessages((prev) =>
        prev.map((m) =>
          m.id === threadParentId ? { ...m, reply_count: (m.reply_count || 0) + 1 } : m
        )
      );

      try {
        const res = await apiFetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel_id: activeChannelId,
            body,
            parent_id: threadParentId,
            mentions: mentions.length > 0 ? mentions : undefined,
            is_silent: isSilent || undefined,
          }),
        });
        const data = await res.json();
        if (data.message) {
          setThreadReplies((prev) =>
            prev.map((m) => (m.id === optimisticId ? { ...data.message, user: optimisticMsg.user } : m))
          );
        }

        // Also send to channel if checkbox is checked
        if (alsoSendToChannel) {
          const channelBody = `> ${body.split("\n")[0].slice(0, 80)}\n\n_replied in thread_`;
          await apiFetch("/api/chat/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              channel_id: activeChannelId,
              body: channelBody,
              mentions: [],
              is_silent: true,
            }),
          });
        }
      } catch {
        // Remove optimistic reply on failure
        setThreadReplies((prev) => prev.filter((m) => m.id !== optimisticId));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === threadParentId ? { ...m, reply_count: Math.max(0, (m.reply_count || 1) - 1) } : m
          )
        );
      } finally {
        setSendingThread(false);
      }
    },
    [activeChannelId, threadParentId, user, alsoSendToChannel]
  );

  const handleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      try {
        const res = await apiFetch("/api/chat/reactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message_id: messageId, emoji }),
        });
        const data = await res.json();
        if (data.reactions) {
          const updateReactions = (msgs: ChatMessage[]) =>
            msgs.map((m) =>
              m.id === messageId ? { ...m, reactions: data.reactions } : m
            );
          setMessages(updateReactions);
          setThreadReplies(updateReactions);
        }
      } catch {
        // ignore
      }
    },
    []
  );

  const handleEditSave = useCallback(
    async (messageId: string) => {
      if (!editDraft.trim()) return;
      try {
        const res = await apiFetch("/api/chat/messages", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: messageId, body: editDraft.trim() }),
        });
        const data = await res.json();
        if (data.message) {
          const updateMsg = (msgs: ChatMessage[]) =>
            msgs.map((m) =>
              m.id === messageId
                ? { ...m, body: data.message.body, edited_at: data.message.edited_at }
                : m
            );
          setMessages(updateMsg);
          setThreadReplies(updateMsg);
        }
      } catch {
        // ignore
      } finally {
        setEditingMessageId(null);
        setEditDraft("");
      }
    },
    [editDraft]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingMessageId) return;
    try {
      await apiFetch(`/api/chat/messages?id=${deletingMessageId}`, {
        method: "DELETE",
      });
      const markDeleted = (msgs: ChatMessage[]) =>
        msgs.map((m) =>
          m.id === deletingMessageId
            ? { ...m, is_deleted: true, body: "" }
            : m
        );
      setMessages(markDeleted);
      setThreadReplies(markDeleted);
    } catch {
      // ignore
    } finally {
      setDeletingMessageId(null);
    }
  }, [deletingMessageId]);

  const openThread = useCallback((parentId: string) => {
    setThreadParentId(parentId);
    setRightPanel("thread");
  }, []);

  const toggleMemberPanel = useCallback(() => {
    setRightPanel((prev) => (prev === "members" ? "none" : "members"));
    if (rightPanel !== "members") {
      setThreadParentId(null);
    }
  }, [rightPanel]);

  const closeRightPanel = useCallback(() => {
    setRightPanel("none");
    setThreadParentId(null);
  }, []);

  /* ── Select channel ────────────────────────── */

  const selectChannel = useCallback(async (id: string) => {
    // Save current draft before switching
    if (activeChannelId) {
      const currentDraft = drafts[activeChannelId];
      if (currentDraft?.trim()) {
        saveDraft(activeChannelId, currentDraft);
      }
    }
    // Clear typing status
    sendTypingStatus(null);

    setActiveChannelId(id);
    setRightPanel("none");
    setThreadParentId(null);
    setEditingMessageId(null);
    updateChannelUrl(id);

  }, [activeChannelId, drafts, saveDraft, sendTypingStatus, updateChannelUrl]);

  /* ── Load all users (for new channel + add member) ── */

  const loadAllUsers = useCallback(async () => {
    if (allUsers.length > 0) return; // already loaded
    try {
      const res = await apiFetch("/api/chat/users?for=all");
      const data = await res.json();
      if (data.users) {
        setAllUsers(data.users.filter((u: ChatUser) => u.id !== user?.id));
      }
    } catch {
      // ignore
    }
  }, [allUsers.length, user?.id]);

  /* ── Load DM-eligible users ────────────────── */

  const loadDmUsers = useCallback(async () => {
    setLoadingDmUsers(true);
    try {
      const res = await apiFetch("/api/chat/users?for=dm");
      const data = await res.json();
      if (data.users) {
        setDmUsers(data.users);
      }
    } catch {
      // ignore
    } finally {
      setLoadingDmUsers(false);
    }
  }, []);

  const openNewDmModal = useCallback(async () => {
    setShowNewDm(true);
    setDmSearch("");
    await loadDmUsers();
  }, [loadDmUsers]);

  const handleCreateDm = useCallback(async (targetUserId: string) => {
    if (creatingDm) return;
    setCreatingDm(true);
    try {
      const res = await apiFetch("/api/chat/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "dm",
          member_id: targetUserId,
        }),
      });
      const data = await res.json();
      if (data.channel) {
        setShowNewDm(false);
        await fetchChannels();
        setActiveChannelId(data.channel.id);
      } else if (data.error) {
        alert(data.error);
      }
    } catch {
      // ignore
    } finally {
      setCreatingDm(false);
    }
  }, [creatingDm, fetchChannels]);

  /* ── New channel modal ─────────────────────── */

  const openNewChannelModal = async () => {
    setShowNewChannel(true);
    setNewChName("");
    setNewChDesc("");
    setNewChType("public");
    setSelectedUserIds([]);
    setUserSearch("");
    await loadAllUsers();
  };

  const createChannel = async () => {
    if (!newChName.trim() || creatingChannel) return;
    setCreatingChannel(true);

    try {
      const res = await apiFetch("/api/chat/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newChName.trim(),
          description: newChDesc.trim() || null,
          type: "channel",
          is_private: newChType === "private",
          is_announcement: newChType === "announcement",
          member_ids: selectedUserIds,
        }),
      });
      const data = await res.json();
      if (data.channel) {
        setShowNewChannel(false);
        await fetchChannels();
        setActiveChannelId(data.channel.id);
      }
    } catch {
      // ignore
    } finally {
      setCreatingChannel(false);
    }
  };

  const toggleUser = (uid: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  /* ── Delete channel ────────────────────────── */

  const handleDeleteChannel = useCallback(async (channelId: string) => {
    try {
      const res = await apiFetch(`/api/chat/channels?id=${channelId}`, { method: "DELETE" });
      if (res.ok) {
        setChannels((prev) => prev.filter((c) => c.id !== channelId));
        if (activeChannelId === channelId) {
          setActiveChannelId(null);
          setMessages([]);
          setMembers([]);
          setRightPanel("none");
        }
      }
    } catch {
      // ignore
    } finally {
      setDeletingChannelId(null);
    }
  }, [activeChannelId]);

  /* ── Add member to existing channel ───────── */

  const handleAddMember = useCallback(async (userId: string) => {
    if (!activeChannelId || addingMember) return;
    setAddingMember(true);
    try {
      const res = await apiFetch("/api/chat/channels/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_id: activeChannelId, user_ids: [userId] }),
      });
      if (res.ok) {
        await fetchMembers(activeChannelId);
        setShowAddMember(false);
        setAddMemberSearch("");
      }
    } catch {
      // ignore
    } finally {
      setAddingMember(false);
    }
  }, [activeChannelId, addingMember, fetchMembers]);

  /* ── Remove member from channel ────────────── */

  const handleRemoveMember = useCallback(async (memberId: string) => {
    if (!activeChannelId) return;
    try {
      const res = await apiFetch(
        `/api/chat/channels/members?channel_id=${activeChannelId}&user_id=${memberId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.user_id !== memberId));
        // If removing self, leave the channel
        if (memberId === user?.id) {
          setChannels((prev) => prev.filter((c) => c.id !== activeChannelId));
          setActiveChannelId(null);
          setMessages([]);
          setRightPanel("none");
        }
      }
    } catch {
      // ignore
    }
  }, [activeChannelId, user?.id]);

  const filteredUsers = allUsers.filter((u) => {
    const q = userSearch.toLowerCase();
    return (
      (u.full_name || "").toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  /* ── Search messages handler ──────────────── */

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchMessages = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (!query.trim() || !activeChannelId) {
        setSearchResults([]);
        return;
      }
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(async () => {
        setSearchLoading(true);
        try {
          const res = await apiFetch(
            `/api/chat/messages?channel_id=${activeChannelId}&search=${encodeURIComponent(query.trim())}&limit=20`
          );
          const data = await res.json();
          if (data.messages) {
            setSearchResults(data.messages);
          }
        } catch {
          setSearchResults([]);
        } finally {
          setSearchLoading(false);
        }
      }, 300);
    },
    [activeChannelId]
  );

  /* ── Mark unread handler ─────────────────── */

  const handleMarkUnread = useCallback(
    async (msg: ChatMessage) => {
      if (!activeChannelId) return;
      // Find the message before this one
      const msgIndex = messages.findIndex((m) => m.id === msg.id);
      const prevMsg = msgIndex > 0 ? messages[msgIndex - 1] : null;
      const lastReadId = prevMsg?.id;

      if (!lastReadId) return;

      try {
        await apiFetch("/api/chat/read-cursors", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel_id: activeChannelId,
            last_read_message_id: lastReadId,
          }),
        });
        // Update the unread count in sidebar
        const unreadCount = messages.length - msgIndex;
        setChannels((prev) =>
          prev.map((ch) =>
            ch.id === activeChannelId ? { ...ch, unread_count: unreadCount } : ch
          )
        );
      } catch {
        // ignore
      }
    },
    [activeChannelId, messages]
  );

  /* ── Create task from message handler ─────── */

  const handleCreateTask = useCallback(
    async (task: { title: string; description: string; assigned_to: string; due_date: string }) => {
      try {
        await apiFetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: task.title,
            description: task.description,
            assigned_to: task.assigned_to || null,
            due_date: task.due_date || null,
            project_id: null,
            status: "todo",
          }),
        });
        setTaskFromMessage(null);
      } catch {
        // ignore
      }
    },
    []
  );

  /* ── Remind me handler ─────────────────────── */

  const handleRemind = useCallback(
    async (messageId: string, channelId: string, remindAt: string) => {
      try {
        await apiFetch("/api/chat/reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message_id: messageId,
            channel_id: channelId,
            remind_at: remindAt,
          }),
        });
      } catch {
        // ignore
      }
    },
    []
  );

  /* ── Render message (shared by main + thread) ── */

  function renderMessage(
    msg: ChatMessage,
    prevMsg: ChatMessage | null,
    options: { allowReply: boolean }
  ) {
    const isMe = msg.user_id === user?.id;

    // Message grouping: show header when user changes, gap > 5min, or day changes
    const showHeader =
      !prevMsg ||
      prevMsg.user_id !== msg.user_id ||
      new Date(msg.created_at).getTime() -
        new Date(prevMsg.created_at).getTime() >
        MSG_GROUP_GAP_MS ||
      (prevMsg && !isSameDay(prevMsg.created_at, msg.created_at));

    const isEditing = editingMessageId === msg.id;

    // Date divider: show when previous message was on a different day
    const showDateDivider =
      !prevMsg || !isSameDay(prevMsg.created_at, msg.created_at);

    // Role-based name color
    const roleInfo = roleMap[msg.user_id];
    const nameColor = getRoleColor(
      roleInfo ? { userId: msg.user_id, ...roleInfo } : undefined
    );

    return (
      <div key={msg.id} id={`msg-${msg.id}`}>
        {/* Date divider */}
        {showDateDivider && (
          <div className="flex items-center gap-3 my-4 px-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-muted font-medium px-2">
              {formatDateDivider(msg.created_at)}
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
        )}

        <div className="group relative transition-colors duration-1000">
        {/* Hover actions */}
        {!msg.is_deleted && !isEditing && (
          <MessageActions
            isOwn={isMe}
            canEdit={isMe && (adminCheck || (Date.now() - new Date(msg.created_at).getTime() < 120000))}
            hasThread={options.allowReply}
            onReply={
              options.allowReply ? () => openThread(msg.id) : undefined
            }
            onReact={(emoji) => handleReaction(msg.id, emoji)}
            onEdit={() => {
              setEditingMessageId(msg.id);
              setEditDraft(msg.body);
            }}
            onDelete={() => setDeletingMessageId(msg.id)}
            onPin={async () => {
              try {
                await apiFetch("/api/chat/pins", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ message_id: msg.id, channel_id: activeChannelId }),
                });
              } catch { /* ignore */ }
            }}
            onSave={async () => {
              try {
                await apiFetch("/api/chat/saved", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ message_id: msg.id }),
                });
              } catch { /* ignore */ }
            }}
            onCopy={() => navigator.clipboard.writeText(msg.body)}
            onForward={() => setForwardingMessage(msg)}
            onMarkUnread={() => handleMarkUnread(msg)}
            onCreateTask={() => setTaskFromMessage(msg)}
            onRemindAt={(remindAt) => handleRemind(msg.id, msg.channel_id, remindAt)}
          />
        )}

        {showHeader && (
          <div className="flex items-center gap-2 mt-3 mb-0.5">
            <Avatar
              name={msg.user?.full_name}
              email={msg.user?.email}
              isOwn={isMe}
            />
            <span className={`text-sm font-medium ${nameColor}`}>
              {msg.user?.full_name || msg.user?.email || "Unknown"}
            </span>
            <span className="text-xs text-muted">
              {formatTime(msg.created_at)}
            </span>
          </div>
        )}

        {/* Message body */}
        <div className="pl-9 text-sm leading-relaxed">
          {msg.is_deleted ? (
            <span className="italic text-muted text-xs">
              [This message was deleted]
            </span>
          ) : isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleEditSave(msg.id);
                  }
                  if (e.key === "Escape") {
                    setEditingMessageId(null);
                    setEditDraft("");
                  }
                }}
                autoFocus
                className="flex-1 bg-surface border border-accent rounded px-2 py-1 text-sm text-foreground outline-none"
              />
              <button
                onClick={() => handleEditSave(msg.id)}
                className="text-xs text-accent hover:underline"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingMessageId(null);
                  setEditDraft("");
                }}
                className="text-xs text-muted hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <span
              className={`inline-block rounded px-2 py-0.5 ${
                isMe ? "bg-accent/10" : "bg-transparent"
              }`}
            >
              <span
                className="text-sm text-foreground leading-relaxed break-words [&_pre]:my-1 [&_code]:text-xs [&_blockquote]:my-1 [&_li]:my-0.5"
                dangerouslySetInnerHTML={{ __html: parseMessageBody(msg.body) }}
              />
              {msg.edited_at && (
                <span className="text-xs text-muted ml-1.5">(edited)</span>
              )}
            </span>
          )}
        </div>

        {/* Reactions */}
        {!msg.is_deleted && (
          <ReactionsRow
            reactions={msg.reactions}
            currentUserId={user?.id}
            onToggle={(emoji) => handleReaction(msg.id, emoji)}
          />
        )}

        {/* Thread indicator (main messages only) */}
        {options.allowReply && !msg.is_deleted && msg.reply_count > 0 && (
          <button
            onClick={() => openThread(msg.id)}
            className="pl-9 mt-1 text-xs text-accent hover:underline flex items-center gap-1"
          >
            <MessageCircle className="w-3 h-3" />
            {msg.reply_count} {msg.reply_count === 1 ? "reply" : "replies"}
          </button>
        )}
        </div>
      </div>
    );
  }

  /* ── Render ────────────────────────────────── */

  return (
    <AuthGuard>
      <Shell>
        <div className="flex h-[calc(100vh-57px)]">
          {/* ── Left Sidebar ─────────────────────── */}
          <div className="w-72 border-r border-border flex flex-col bg-surface shrink-0">
            {/* Header */}
            <div className="p-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">
                Chat
              </span>
              {adminCheck && (
                <button
                  onClick={openNewChannelModal}
                  className="p-1.5 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
                  title="New Channel (Admin only)"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingChannels ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted" />
                </div>
              ) : channels.length === 0 ? (
                <div className="p-4 text-center text-muted text-sm">
                  No channels yet. Create one to get started.
                </div>
              ) : (
                <>
                  {channelList.length > 0 && (
                    <div className="py-2">
                      <div className="px-3 py-1 text-xs font-medium text-muted uppercase tracking-wider">
                        Channels
                      </div>
                      {channelList.map((ch) => (
                        <div key={ch.id} className="group/ch relative">
                          <button
                            onClick={() => selectChannel(ch.id)}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-hover transition-colors ${
                              activeChannelId === ch.id
                                ? "bg-surface-hover text-foreground"
                                : "text-muted"
                            }`}
                          >
                            <Hash className="w-4 h-4 shrink-0" />
                            <span className="truncate flex-1 text-left">
                              {ch.name}
                            </span>
                            {drafts[ch.id]?.trim() && (
                              <span className="shrink-0" aria-label="Draft"><Pencil className="w-3 h-3 text-muted" /></span>
                            )}
                            {ch.unread_count > 0 && (
                              <span className="bg-accent text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                                {ch.unread_count}
                              </span>
                            )}
                          </button>
                          {canManageChannel(ch) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingChannelId(ch.id);
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted hover:text-red-400 opacity-0 group-hover/ch:opacity-100 transition-all"
                              title="Delete channel"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Direct Messages section — always shown */}
                  <div className="py-2">
                    <div className="px-3 py-1 flex items-center justify-between">
                      <span className="text-xs font-medium text-muted uppercase tracking-wider">
                        Direct Messages
                      </span>
                      <button
                        onClick={openNewDmModal}
                        className="p-0.5 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
                        title="New direct message"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {dmList.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted">
                        No conversations yet
                      </div>
                    ) : (
                      dmList.map((ch) => {
                        const dmDisplayName = ch.dm_user?.full_name || ch.dm_user?.email || ch.name;
                        return (
                          <button
                            key={ch.id}
                            onClick={() => selectChannel(ch.id)}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-hover transition-colors ${
                              activeChannelId === ch.id
                                ? "bg-surface-hover text-foreground"
                                : "text-muted"
                            }`}
                          >
                            <span className="relative shrink-0">
                              <span className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[10px] font-bold">
                                {initials(ch.dm_user?.full_name || null, ch.dm_user?.email)}
                              </span>
                              {/* Presence dot - would need real presence data */}
                            </span>
                            <span className="truncate flex-1 text-left">
                              {dmDisplayName}
                            </span>
                            {ch.unread_count > 0 && (
                              <span className="bg-accent text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                                {ch.unread_count}
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Main Message Area ────────────────── */}
          <div className="flex-1 flex flex-col bg-background min-w-0">
            {activeChannel ? (
              <>
                {/* Channel header */}
                <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                  {activeChannel.type === "channel" ? (
                    <Hash className="w-5 h-5 text-muted" />
                  ) : (
                    <MessageCircle className="w-5 h-5 text-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">
                      {activeChannel.type === "dm"
                        ? activeChannel.dm_user?.full_name || activeChannel.dm_user?.email || activeChannel.name
                        : activeChannel.name}
                    </div>
                    {activeChannel.type === "dm" && activeChannel.dm_user?.email ? (
                      <div className="text-xs text-muted truncate">
                        {activeChannel.dm_user.email}
                      </div>
                    ) : activeChannel.description ? (
                      <div className="text-xs text-muted truncate">
                        {activeChannel.description}
                      </div>
                    ) : null}
                  </div>
                  <button
                    onClick={() => {
                      setShowSearch((v) => !v);
                      if (showSearch) {
                        setSearchQuery("");
                        setSearchResults([]);
                      }
                    }}
                    className={`p-1.5 rounded transition-colors ${
                      showSearch
                        ? "bg-accent/20 text-accent"
                        : "text-muted hover:text-foreground hover:bg-surface-hover"
                    }`}
                    title="Search messages"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setRightPanel(rightPanel === "pins" ? "none" : "pins")}
                    className={`p-1.5 rounded transition-colors ${
                      rightPanel === "pins"
                        ? "bg-accent/20 text-accent"
                        : "text-muted hover:text-foreground hover:bg-surface-hover"
                    }`}
                    title="Pinned messages"
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={toggleMemberPanel}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                      rightPanel === "members"
                        ? "bg-accent/20 text-accent"
                        : "text-muted hover:text-foreground hover:bg-surface-hover"
                    }`}
                    title="Toggle members"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>{members.length}</span>
                  </button>
                  {canManageChannel(activeChannel) && activeChannel?.type === "channel" && (
                    <button
                      onClick={() => setDeletingChannelId(activeChannel.id)}
                      className="p-1.5 rounded text-muted hover:text-red-400 hover:bg-surface-hover transition-colors"
                      title="Delete channel"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Search bar */}
                {showSearch && (
                  <div className="px-4 py-2 border-b border-border bg-surface/50 relative">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearchMessages(e.target.value)}
                        placeholder="Search messages in this channel..."
                        autoFocus
                        className="w-full bg-background border border-border rounded px-3 py-1.5 pl-8 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {/* Search results dropdown */}
                    {searchQuery.trim() && (
                      <div className="absolute left-4 right-4 top-full mt-1 bg-surface border border-border rounded-lg shadow-xl max-h-64 overflow-y-auto z-50">
                        {searchLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-4 h-4 animate-spin text-muted" />
                          </div>
                        ) : searchResults.length === 0 ? (
                          <div className="p-3 text-xs text-muted text-center">No messages found</div>
                        ) : (
                          searchResults.map((msg) => (
                            <button
                              key={msg.id}
                              onClick={() => {
                                // Jump to message — scroll it into view
                                setShowSearch(false);
                                setSearchQuery("");
                                setSearchResults([]);
                                // Find the message in the current messages list and scroll to it
                                requestAnimationFrame(() => {
                                  const el = document.getElementById(`msg-${msg.id}`);
                                  if (el) {
                                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                                    el.classList.add("bg-accent/10");
                                    setTimeout(() => el.classList.remove("bg-accent/10"), 2000);
                                  }
                                });
                              }}
                              className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-surface-hover transition-colors border-b border-border last:border-b-0"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-xs font-medium text-foreground">
                                    {msg.user?.full_name || msg.user?.email || "Unknown"}
                                  </span>
                                  <span className="text-[10px] text-muted">
                                    {formatTime(msg.created_at)}
                                  </span>
                                </div>
                                <div className="text-xs text-muted truncate">{msg.body}</div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Connection status banner */}
                {connectionStatus !== 'connected' && (
                  <div className={`text-center text-xs py-1 ${connectionStatus === 'reconnecting' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                    {connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Disconnected — check your connection'}
                  </div>
                )}

                {/* Messages */}
                <div
                  className="flex-1 overflow-y-auto px-4 py-2"
                  onClick={(e) => {
                    // Handle #channel link clicks
                    const target = e.target as HTMLElement;
                    if (target.tagName === "A" && target.dataset.channel) {
                      e.preventDefault();
                      const channelSlug = target.dataset.channel;
                      const found = channels.find((c) => c.name === channelSlug);
                      if (found) {
                        setActiveChannelId(found.id);
                      }
                    }
                  }}
                >
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-6 h-6 animate-spin text-muted" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted text-sm">
                      No messages yet. Start the conversation!
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {messages.map((msg, idx) =>
                        renderMessage(
                          msg,
                          idx > 0 ? messages[idx - 1] : null,
                          { allowReply: true }
                        )
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                {/* Typing indicator */}
                {typingUsers.length > 0 && (
                  <div className="px-4 py-1 text-xs text-muted italic">
                    {typingUsers.map(u => u.full_name).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
                  </div>
                )}

                {/* Input */}
                <ChatInput
                  placeholder={`Message ${activeChannel.type === "channel" ? "#" : ""}${activeChannel.name}`}
                  members={members}
                  onSend={(body, mentions, isSilent) => {
                    handleSendMain(body, mentions, isSilent);
                    // Clear draft after sending
                    if (activeChannelId) {
                      setDrafts((prev) => {
                        const next = { ...prev };
                        delete next[activeChannelId];
                        return next;
                      });
                      apiFetch(`/api/chat/drafts?channel_id=${activeChannelId}`, { method: "DELETE" }).catch(() => {});
                    }
                    // Clear typing status
                    sendTypingStatus(null);
                  }}
                  sending={sendingMain}
                  initialDraft={activeChannelId ? drafts[activeChannelId] || "" : ""}
                  onDraftChange={(body) => {
                    if (!activeChannelId) return;
                    // Update local drafts
                    setDrafts((prev) => ({ ...prev, [activeChannelId]: body }));
                    // Debounced save to server
                    if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
                    draftSaveTimeoutRef.current = setTimeout(() => {
                      saveDraft(activeChannelId, body);
                    }, 2000);
                    // Send typing indicator (throttled to once per 3 seconds)
                    const now = Date.now();
                    if (body.trim() && now - lastTypingSentRef.current > 3000) {
                      lastTypingSentRef.current = now;
                      sendTypingStatus(activeChannelId);
                      // Auto-clear typing after 5 seconds of no typing
                      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                      typingTimeoutRef.current = setTimeout(() => {
                        sendTypingStatus(null);
                      }, 5000);
                    }
                  }}
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted">
                <div className="text-center">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">
                    Select a channel to start chatting
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Right Panel: Thread ──────────────── */}
          {rightPanel === "thread" && threadParent && (
            <div className="w-96 border-l border-border flex flex-col bg-surface shrink-0">
              {/* Thread header */}
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  Thread
                </span>
                <button
                  onClick={closeRightPanel}
                  className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Parent message (sticky) */}
              <div className="px-4 py-3 border-b border-border bg-background/50">
                <div className="flex items-center gap-2 mb-1">
                  <Avatar
                    name={threadParent.user?.full_name}
                    email={threadParent.user?.email}
                    isOwn={threadParent.user_id === user?.id}
                  />
                  <span className="text-sm font-medium text-foreground">
                    {threadParent.user?.full_name ||
                      threadParent.user?.email ||
                      "Unknown"}
                  </span>
                  <span className="text-xs text-muted">
                    {formatTime(threadParent.created_at)}
                  </span>
                </div>
                <div className="pl-9 text-sm text-foreground/90 leading-relaxed">
                  {threadParent.is_deleted ? (
                    <span className="italic text-muted text-xs">
                      [This message was deleted]
                    </span>
                  ) : (
                    <span
                      className="text-sm text-foreground leading-relaxed break-words [&_pre]:my-1 [&_code]:text-xs [&_blockquote]:my-1 [&_li]:my-0.5"
                      dangerouslySetInnerHTML={{ __html: parseMessageBody(threadParent.body) }}
                    />
                  )}
                </div>
                {!threadParent.is_deleted && threadParent.reactions?.length > 0 && (
                  <ReactionsRow
                    reactions={threadParent.reactions}
                    currentUserId={user?.id}
                    onToggle={(emoji) =>
                      handleReaction(threadParent.id, emoji)
                    }
                  />
                )}
                <div className="pl-9 mt-2 text-xs text-muted">
                  {threadParent.reply_count}{" "}
                  {threadParent.reply_count === 1 ? "reply" : "replies"}
                </div>
              </div>

              {/* Thread replies */}
              <div className="flex-1 overflow-y-auto px-4 py-2">
                {loadingThread ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted" />
                  </div>
                ) : threadReplies.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-muted text-xs">
                    No replies yet
                  </div>
                ) : (
                  <div className="space-y-1">
                    {threadReplies.map((msg, idx) =>
                      renderMessage(
                        msg,
                        idx > 0 ? threadReplies[idx - 1] : null,
                        { allowReply: false }
                      )
                    )}
                    <div ref={threadEndRef} />
                  </div>
                )}
              </div>

              {/* Thread input */}
              <ChatInput
                placeholder="Reply in thread..."
                members={members}
                onSend={(body, mentions, isSilent) => handleSendThread(body, mentions, isSilent)}
                sending={sendingThread}
                showAlsoSendToChannel={true}
                channelName={activeChannel?.name || ""}
                alsoSendToChannel={alsoSendToChannel}
                onAlsoSendToggle={(checked) => setAlsoSendToChannel(checked)}
              />
            </div>
          )}

          {/* ── Right Panel: Members ─────────────── */}
          {rightPanel === "members" && (
            <div className="w-72 border-l border-border flex flex-col bg-surface shrink-0">
              {/* Members header */}
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  Members ({members.length})
                </span>
                <div className="flex items-center gap-1">
                  {canManageChannel(activeChannel) && activeChannel?.type !== "dm" && (
                    <button
                      onClick={() => {
                        setShowAddMember(true);
                        setAddMemberSearch("");
                        loadAllUsers();
                      }}
                      className="p-1 rounded hover:bg-surface-hover text-muted hover:text-accent transition-colors"
                      title="Add member"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={closeRightPanel}
                    className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Add member search (inline dropdown) */}
              {showAddMember && (
                <div className="p-3 border-b border-border bg-background/50">
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                    <input
                      type="text"
                      value={addMemberSearch}
                      onChange={(e) => setAddMemberSearch(e.target.value)}
                      placeholder="Search users to add..."
                      autoFocus
                      className="w-full bg-background border border-border rounded px-3 py-1.5 pl-8 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent"
                    />
                  </div>
                  <div className="max-h-32 overflow-y-auto">
                    {allUsers
                      .filter((u) => {
                        if (members.some((m) => m.user_id === u.id)) return false;
                        const q = addMemberSearch.toLowerCase();
                        return (
                          (u.full_name || "").toLowerCase().includes(q) ||
                          u.email.toLowerCase().includes(q)
                        );
                      })
                      .map((u) => (
                        <button
                          key={u.id}
                          onClick={() => handleAddMember(u.id)}
                          disabled={addingMember}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-surface-hover rounded transition-colors text-left disabled:opacity-50"
                        >
                          <span className="w-6 h-6 rounded-full bg-surface-hover text-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                            {initials(u.full_name, u.email)}
                          </span>
                          <span className="truncate text-foreground">{u.full_name || u.email}</span>
                        </button>
                      ))}
                  </div>
                  <button
                    onClick={() => setShowAddMember(false)}
                    className="text-xs text-muted hover:text-foreground mt-1 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Members list */}
              <div className="flex-1 overflow-y-auto">
                {members.map((m) => (
                  <div
                    key={m.user_id}
                    className="group/member flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors"
                  >
                    <div className="relative">
                      <Avatar
                        name={m.user?.full_name}
                        email={m.user?.email}
                        isOwn={m.user_id === user?.id}
                        size="md"
                      />
                      {/* Online indicator — only show for self (always online) */}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground truncate">
                        {m.user?.full_name || "Unknown"}
                        {m.user_id === user?.id && (
                          <span className="text-xs text-muted ml-1">(you)</span>
                        )}
                      </div>
                      <div className="text-xs text-muted truncate">{m.user?.email}</div>
                    </div>
                    {/* Remove button: admin/creator can remove anyone; member can leave (remove self) */}
                    {activeChannel?.type !== "dm" && (canManageChannel(activeChannel) || m.user_id === user?.id) && (
                      <button
                        onClick={() => handleRemoveMember(m.user_id)}
                        className="opacity-0 group-hover/member:opacity-100 p-1 rounded text-muted hover:text-red-400 transition-all shrink-0"
                        title={m.user_id === user?.id ? "Leave channel" : "Remove member"}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Leave channel button for non-admin non-creator */}
              {activeChannel && activeChannel.type !== "dm" && !canManageChannel(activeChannel) && (
                <div className="px-4 py-3 border-t border-border">
                  <button
                    onClick={() => handleRemoveMember(user!.id)}
                    className="w-full text-xs text-muted hover:text-red-400 transition-colors text-center"
                  >
                    Leave channel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Right Panel: Pins ──────────────────── */}
          {rightPanel === "pins" && activeChannelId && (
            <div className="w-80 border-l border-border flex-shrink-0 overflow-hidden bg-surface">
              <PinsPanel
                channelId={activeChannelId}
                isAdmin={adminCheck}
                userId={user?.id || ""}
                onClose={() => setRightPanel("none")}
              />
            </div>
          )}

          {/* ── Right Panel: Saved Items ───────────── */}
          {rightPanel === "saved" && (
            <div className="w-80 border-l border-border flex-shrink-0 overflow-hidden bg-surface">
              <SavedItems
                onClose={() => setRightPanel("none")}
                onJumpToMessage={(channelId, _messageId) => {
                  setActiveChannelId(channelId);
                  setRightPanel("none");
                }}
              />
            </div>
          )}
        </div>

        {/* ── Quick Switcher ───────────────────────── */}
        {showQuickSwitcher && (
          <QuickSwitcher
            channels={channels}
            onSelect={(id) => {
              setActiveChannelId(id);
              setRightPanel("none");
            }}
            onClose={() => setShowQuickSwitcher(false)}
          />
        )}

        {/* ── Forward Modal ────────────────────────── */}
        {forwardingMessage && (
          <ForwardModal
            messageBody={forwardingMessage.body}
            messageAuthor={forwardingMessage.user?.full_name || undefined}
            channels={channels}
            currentChannelId={forwardingMessage.channel_id}
            currentChannelName={activeChannel?.name}
            onClose={() => setForwardingMessage(null)}
          />
        )}

        {/* ── Delete Confirmation Modal ──────────── */}
        {deletingMessageId && (
          <DeleteConfirmDialog
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeletingMessageId(null)}
          />
        )}

        {/* ── Create Task from Message Modal ──────── */}
        {taskFromMessage && (
          <CreateTaskModal
            messageBody={taskFromMessage.body}
            members={members}
            onClose={() => setTaskFromMessage(null)}
            onSubmit={handleCreateTask}
          />
        )}

        {/* ── Delete Channel Confirmation (type name to confirm) ── */}
        {deletingChannelId && (() => {
          const channelName = channels.find((c) => c.id === deletingChannelId)?.name || "";
          const isMatch = deleteConfirmText.trim().toLowerCase() === channelName.toLowerCase();
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="bg-surface border border-border rounded-xl w-full max-w-md mx-4 shadow-2xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">Delete channel</h3>
                </div>
                <p className="text-sm text-muted mb-1">
                  This will permanently delete{" "}
                  <span className="font-semibold text-foreground">#{channelName}</span>{" "}
                  and all its messages. This action cannot be undone.
                </p>
                <p className="text-sm text-muted mb-4">
                  Type <span className="font-mono text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded text-xs">{channelName}</span> to confirm.
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={channelName}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted/40 focus:outline-none focus:border-red-500/50 mb-4"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setDeletingChannelId(null); setDeleteConfirmText(""); }}
                    className="px-4 py-2 rounded-lg text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { handleDeleteChannel(deletingChannelId); setDeleteConfirmText(""); }}
                    disabled={!isMatch}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isMatch
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : "bg-red-600/30 text-red-300/50 cursor-not-allowed"
                    }`}
                  >
                    Delete Channel
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── New Channel Modal ──────────────────── */}
        {showNewChannel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-surface border border-border rounded-lg w-full max-w-md mx-4 shadow-xl">
              {/* Modal header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">
                  New Channel
                </h3>
                <button
                  onClick={() => setShowNewChannel(false)}
                  className="p-1 rounded hover:bg-surface-hover text-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs text-muted mb-1">
                    Channel Type
                  </label>
                  <select
                    value={newChType}
                    onChange={(e) => setNewChType(e.target.value as "public" | "private" | "announcement")}
                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  >
                    <option value="public">Public Channel</option>
                    <option value="private">Private Channel</option>
                    <option value="announcement">Announcement Channel</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1">
                    Channel Name
                  </label>
                  <input
                    type="text"
                    value={newChName}
                    onChange={(e) => setNewChName(e.target.value)}
                    placeholder="e.g. general"
                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={newChDesc}
                    onChange={(e) => setNewChDesc(e.target.value)}
                    placeholder="What is this channel about?"
                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1">
                    Add Members
                  </label>
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search users..."
                      className="w-full bg-background border border-border rounded px-3 py-2 pl-8 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-border rounded bg-background">
                    {filteredUsers.length === 0 ? (
                      <div className="p-3 text-xs text-muted text-center">
                        No users found
                      </div>
                    ) : (
                      filteredUsers.map((u) => {
                        const selected = selectedUserIds.includes(u.id);
                        return (
                          <button
                            key={u.id}
                            onClick={() => toggleUser(u.id)}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-hover transition-colors ${
                              selected ? "bg-accent/10" : ""
                            }`}
                          >
                            <span className="w-6 h-6 rounded-full bg-surface-hover text-muted flex items-center justify-center text-[10px] font-bold">
                              {initials(u.full_name, u.email)}
                            </span>
                            <span className="flex-1 text-left truncate text-foreground">
                              {u.full_name || u.email}
                            </span>
                            {selected && (
                              <Check className="w-3.5 h-3.5 text-accent" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                  {selectedUserIds.length > 0 && (
                    <div className="text-xs text-muted mt-1">
                      {selectedUserIds.length} member
                      {selectedUserIds.length !== 1 ? "s" : ""} selected
                    </div>
                  )}
                </div>
              </div>

              {/* Modal footer */}
              <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
                <button
                  onClick={() => setShowNewChannel(false)}
                  className="px-3 py-1.5 rounded text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createChannel}
                  disabled={!newChName.trim() || creatingChannel}
                  className="px-3 py-1.5 rounded text-sm bg-accent hover:bg-accent/90 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {creatingChannel ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Create Channel"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ── New DM Modal ──────────────────────────── */}
        {showNewDm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-surface border border-border rounded-lg w-full max-w-sm mx-4 shadow-xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">
                  New Direct Message
                </h3>
                <button
                  onClick={() => setShowNewDm(false)}
                  className="p-1 rounded hover:bg-surface-hover text-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                  <input
                    type="text"
                    value={dmSearch}
                    onChange={(e) => setDmSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    autoFocus
                    className="w-full bg-background border border-border rounded px-3 py-2 pl-8 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent"
                  />
                </div>
                {!adminCheck && (
                  <p className="text-xs text-muted mt-2">
                    You can send direct messages to admins only.
                  </p>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {loadingDmUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted" />
                  </div>
                ) : (
                  (() => {
                    const filtered = dmUsers.filter((u) => {
                      const q = dmSearch.toLowerCase();
                      return (
                        (u.full_name || "").toLowerCase().includes(q) ||
                        u.email.toLowerCase().includes(q)
                      );
                    });
                    if (filtered.length === 0) {
                      return (
                        <div className="p-4 text-xs text-muted text-center">
                          {dmSearch ? "No matching users" : "No users available"}
                        </div>
                      );
                    }
                    return filtered.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => handleCreateDm(u.id)}
                        disabled={creatingDm}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-hover transition-colors text-left disabled:opacity-50"
                      >
                        <span className="relative shrink-0">
                          <span className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold">
                            {initials(u.full_name, u.email)}
                          </span>
                          {/* Online indicator — only show for self (always online) */}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-foreground truncate">
                            {u.full_name || u.email}
                          </div>
                          {u.full_name && (
                            <div className="text-xs text-muted truncate">
                              {u.email}
                            </div>
                          )}
                        </div>
                        {u.is_admin && (
                          <span className="text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded shrink-0">
                            Admin
                          </span>
                        )}
                      </button>
                    ));
                  })()
                )}
              </div>

              <div className="px-4 py-3 border-t border-border">
                <button
                  onClick={() => setShowNewDm(false)}
                  className="w-full px-3 py-1.5 rounded text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </Shell>
    </AuthGuard>
  );
}
