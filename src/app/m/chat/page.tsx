"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
} from "lucide-react";

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
  hasThread,
  onReply,
  onReact,
  onEdit,
  onDelete,
}: {
  isOwn: boolean;
  hasThread?: boolean;
  onReply?: () => void;
  onReact: (emoji: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  return (
    <div className="absolute -top-3 right-2 bg-surface border border-border rounded-md shadow-md flex items-center gap-0.5 p-0.5 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
      {onReply && (
        <button
          onClick={onReply}
          title="Reply in thread"
          className="p-1.5 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
        >
          <Reply className="w-3.5 h-3.5" />
        </button>
      )}
      <div className="relative">
        <button
          onClick={() => setShowEmojiPicker((v) => !v)}
          title="Add reaction"
          className="p-1.5 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
        >
          <Smile className="w-3.5 h-3.5" />
        </button>
        {showEmojiPicker && (
          <EmojiPicker
            onSelect={onReact}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}
      </div>
      {isOwn && (
        <>
          <button
            onClick={onEdit}
            title="Edit message"
            className="p-1.5 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            title="Delete message"
            className="p-1.5 rounded hover:bg-surface-hover text-muted hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </>
      )}
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
}: {
  placeholder: string;
  members: MemberEntry[];
  onSend: (body: string, mentions: string[]) => void;
  sending: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxH = 5 * 24; // ~5 lines
    el.style.height = Math.min(el.scrollHeight, maxH) + "px";
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setDraft(val);

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
    [adjustHeight]
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

  const handleSend = useCallback(() => {
    if (!draft.trim() || sending) return;
    const body = draft.trim();
    const mentions = extractMentionIds(body, members);
    onSend(body, mentions);
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
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
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
        <div className="flex items-end gap-2 bg-surface rounded-lg px-3 py-2 border border-border focus-within:border-accent transition-colors">
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
  const { user } = useAuth();

  // Channel state
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(true);

  // Messages state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMain, setSendingMain] = useState(false);

  // Members
  const [members, setMembers] = useState<MemberEntry[]>([]);

  // Right panel state
  const [rightPanel, setRightPanel] = useState<"none" | "members" | "thread">(
    "none"
  );
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
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [creatingChannel, setCreatingChannel] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) || null,
    [channels, activeChannelId]
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
              return [...prev, enriched];
            });
          } else {
            // Top-level message
            setMessages((prev) => {
              if (prev.some((m) => m.id === enriched.id)) return prev;
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannelId]);

  /* ── Auto-scroll ───────────────────────────── */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadReplies]);

  /* ── Message actions ───────────────────────── */

  const handleSendMain = useCallback(
    async (body: string, mentions: string[]) => {
      if (!activeChannelId) return;
      setSendingMain(true);
      try {
        await apiFetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel_id: activeChannelId,
            body,
            mentions: mentions.length > 0 ? mentions : undefined,
          }),
        });
        setChannels((prev) =>
          prev.map((ch) =>
            ch.id === activeChannelId ? { ...ch, unread_count: 0 } : ch
          )
        );
      } catch {
        // ignore
      } finally {
        setSendingMain(false);
      }
    },
    [activeChannelId]
  );

  const handleSendThread = useCallback(
    async (body: string, mentions: string[]) => {
      if (!activeChannelId || !threadParentId) return;
      setSendingThread(true);
      try {
        await apiFetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel_id: activeChannelId,
            body,
            parent_id: threadParentId,
            mentions: mentions.length > 0 ? mentions : undefined,
          }),
        });
      } catch {
        // ignore
      } finally {
        setSendingThread(false);
      }
    },
    [activeChannelId, threadParentId]
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

  const selectChannel = useCallback((id: string) => {
    setActiveChannelId(id);
    setRightPanel("none");
    setThreadParentId(null);
    setEditingMessageId(null);
  }, []);

  /* ── New channel modal ─────────────────────── */

  const openNewChannelModal = async () => {
    setShowNewChannel(true);
    setNewChName("");
    setNewChDesc("");
    setSelectedUserIds([]);
    setUserSearch("");

    try {
      const res = await apiFetch("/api/admin/users");
      const data = await res.json();
      if (data.users) {
        setAllUsers(
          data.users.filter((u: ChatUser) => u.id !== user?.id)
        );
      }
    } catch {
      // ignore
    }
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

  const filteredUsers = allUsers.filter((u) => {
    const q = userSearch.toLowerCase();
    return (
      (u.full_name || "").toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  /* ── Render message (shared by main + thread) ── */

  function renderMessage(
    msg: ChatMessage,
    prevMsg: ChatMessage | null,
    options: { allowReply: boolean }
  ) {
    const isMe = msg.user_id === user?.id;
    const showHeader =
      !prevMsg ||
      prevMsg.user_id !== msg.user_id ||
      new Date(msg.created_at).getTime() -
        new Date(prevMsg.created_at).getTime() >
        MSG_GROUP_GAP_MS;

    const isEditing = editingMessageId === msg.id;

    return (
      <div key={msg.id} className="group relative">
        {/* Hover actions */}
        {!msg.is_deleted && !isEditing && (
          <MessageActions
            isOwn={isMe}
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
          />
        )}

        {showHeader && (
          <div className="flex items-center gap-2 mt-3 mb-0.5">
            <Avatar
              name={msg.user?.full_name}
              email={msg.user?.email}
              isOwn={isMe}
            />
            <span className="text-sm font-medium text-foreground">
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
              {renderBody(msg.body, members)}
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
              <button
                onClick={openNewChannelModal}
                className="p-1.5 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
                title="New Channel"
              >
                <Plus className="w-4 h-4" />
              </button>
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
                        <button
                          key={ch.id}
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
                          {ch.unread_count > 0 && (
                            <span className="bg-accent text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                              {ch.unread_count}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {dmList.length > 0 && (
                    <div className="py-2">
                      <div className="px-3 py-1 text-xs font-medium text-muted uppercase tracking-wider">
                        Direct Messages
                      </div>
                      {dmList.map((ch) => (
                        <button
                          key={ch.id}
                          onClick={() => selectChannel(ch.id)}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-hover transition-colors ${
                            activeChannelId === ch.id
                              ? "bg-surface-hover text-foreground"
                              : "text-muted"
                          }`}
                        >
                          <span className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[10px] font-bold shrink-0">
                            {initials(ch.name)}
                          </span>
                          <span className="truncate flex-1 text-left">
                            {ch.name}
                          </span>
                          {ch.unread_count > 0 && (
                            <span className="bg-accent text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                              {ch.unread_count}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
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
                      {activeChannel.name}
                    </div>
                    {activeChannel.description && (
                      <div className="text-xs text-muted truncate">
                        {activeChannel.description}
                      </div>
                    )}
                  </div>
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
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-2">
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

                {/* Input */}
                <ChatInput
                  placeholder={`Message ${activeChannel.type === "channel" ? "#" : ""}${activeChannel.name}`}
                  members={members}
                  onSend={handleSendMain}
                  sending={sendingMain}
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
                    renderBody(threadParent.body, members)
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
                onSend={handleSendThread}
                sending={sendingThread}
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
                <button
                  onClick={closeRightPanel}
                  className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Members list */}
              <div className="flex-1 overflow-y-auto">
                {members.map((m) => (
                  <div
                    key={m.user_id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors"
                  >
                    <div className="relative">
                      <Avatar
                        name={m.user?.full_name}
                        email={m.user?.email}
                        isOwn={m.user_id === user?.id}
                        size="md"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-surface" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground truncate">
                        {m.user?.full_name || "Unknown"}
                        {m.user_id === user?.id && (
                          <span className="text-xs text-muted ml-1">
                            (you)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted truncate">
                        {m.user?.email}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Delete Confirmation Modal ──────────── */}
        {deletingMessageId && (
          <DeleteConfirmDialog
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeletingMessageId(null)}
          />
        )}

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
      </Shell>
    </AuthGuard>
  );
}
