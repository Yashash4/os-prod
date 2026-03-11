"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-fetch";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  Hash,
  MessageCircle,
  Send,
  Loader2,
  ArrowRight,
  ChevronLeft,
  X,
} from "lucide-react";

/* ── Types ─────────────────────────────── */

interface ChatUser {
  id: string;
  full_name: string | null;
  email: string;
}

interface MemberEntry {
  id: string;
  channel_id: string;
  user_id: string;
  user: ChatUser | null;
}

interface ChatMessage {
  id: string;
  channel_id: string;
  user_id: string;
  body: string;
  created_at: string;
  user: ChatUser | null;
  is_deleted?: boolean;
}

interface ChatChannel {
  id: string;
  name: string;
  type: "channel" | "dm";
  last_message: {
    body: string;
    created_at: string;
    user: { full_name: string | null } | null;
  } | null;
  unread_count: number;
}

/* ── Helpers ────────────────────────────── */

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

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + "…";
}

function extractMentionIds(text: string, members: MemberEntry[]): string[] {
  const ids: string[] = [];
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

/** Render message body with @mentions highlighted */
function renderBody(body: string, members: MemberEntry[]): React.ReactNode {
  if (members.length === 0) return body;

  const namePatterns: string[] = [];
  for (const m of members) {
    if (m.user?.full_name) namePatterns.push(m.user.full_name);
    if (m.user?.email) namePatterns.push(m.user.email.split("@")[0]);
  }
  namePatterns.sort((a, b) => b.length - a.length);
  const escaped = namePatterns.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (escaped.length === 0) return body;

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

/* ── Component ──────────────────────────── */

export default function QuickChat({ onClose }: { onClose?: () => void }) {
  const { user } = useAuth();

  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  // Members & @mention state
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Fetch channels ──────────────────── */

  const fetchChannels = useCallback(async () => {
    try {
      const res = await apiFetch("/api/chat/channels");
      const data = await res.json();
      if (data.channels) {
        const sorted = [...data.channels].sort((a: ChatChannel, b: ChatChannel) => {
          const aTime = a.last_message?.created_at || "0";
          const bTime = b.last_message?.created_at || "0";
          return bTime.localeCompare(aTime);
        });
        setChannels(sorted);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  /* ── Fetch messages + members for active channel ── */

  const fetchMessages = useCallback(async (channelId: string) => {
    setLoadingMessages(true);
    try {
      const res = await apiFetch(
        `/api/chat/messages?channel_id=${channelId}&limit=30`
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
    if (activeChannel) {
      fetchMessages(activeChannel.id);
      fetchMembers(activeChannel.id);
    } else {
      setMessages([]);
      setMembers([]);
    }
  }, [activeChannel, fetchMessages, fetchMembers]);

  /* ── Realtime for active channel ─────── */

  useEffect(() => {
    if (!activeChannel) return;

    const channel = supabase
      .channel(`quickchat-${activeChannel.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${activeChannel.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;
          if ((newMsg as unknown as Record<string, unknown>).parent_id) return;

          // Enrich with user info from members
          const member = members.find((m) => m.user_id === newMsg.user_id);
          if (member?.user) {
            newMsg.user = member.user;
          }

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannel, members]);

  /* ── Auto-scroll ─────────────────────── */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── @mention handling ─────────────────── */

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setDraft(val);

      const cursorPos = e.target.selectionStart || val.length;
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
    },
    []
  );

  const handleMentionSelect = useCallback(
    (member: MemberEntry) => {
      const name = member.user?.full_name || member.user?.email || "";
      const input = inputRef.current;
      if (!input) return;

      const cursorPos = input.selectionStart || draft.length;
      const textBeforeCursor = draft.slice(0, cursorPos);
      const atIdx = textBeforeCursor.lastIndexOf("@");
      if (atIdx === -1) return;

      const newDraft =
        draft.slice(0, atIdx) + "@" + name + " " + draft.slice(cursorPos);
      setDraft(newDraft);
      setMentionQuery(null);

      requestAnimationFrame(() => {
        const newPos = atIdx + name.length + 2;
        input.selectionStart = newPos;
        input.selectionEnd = newPos;
        input.focus();
      });
    },
    [draft]
  );

  const filteredMentions =
    mentionQuery !== null
      ? members.filter((m) => {
          if (!m.user) return false;
          if (m.user_id === user?.id) return false;
          const q = mentionQuery.toLowerCase();
          return (
            (m.user.full_name || "").toLowerCase().includes(q) ||
            m.user.email.toLowerCase().includes(q)
          );
        })
      : [];

  /* ── Send message ────────────────────── */

  const handleSend = useCallback(async () => {
    if (!draft.trim() || !activeChannel || sending) return;
    const body = draft.trim();
    setDraft("");
    setMentionQuery(null);
    setSending(true);

    const mentions = extractMentionIds(body, members);

    try {
      await apiFetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel_id: activeChannel.id,
          body,
          ...(mentions.length > 0 ? { mentions } : {}),
        }),
      });
    } catch {
      setDraft(body);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [draft, activeChannel, sending, members]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  /* ── Open / close channel ────────────── */

  const openChannel = (ch: ChatChannel) => {
    setActiveChannel(ch);
    setMessages([]);
    setMembers([]);
    setDraft("");
    setMentionQuery(null);
  };

  const goBack = () => {
    setActiveChannel(null);
    setMessages([]);
    setMembers([]);
    setDraft("");
    setMentionQuery(null);
    fetchChannels();
  };

  const totalUnread = channels.reduce((sum, c) => sum + c.unread_count, 0);

  /* ── Render: Channel List ────────────── */

  if (!activeChannel) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-foreground">Quick Chat</span>
            {totalUnread > 0 && (
              <span className="text-[10px] font-medium bg-accent text-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {totalUnread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/m/chat"
              className="text-xs text-muted hover:text-accent transition-colors flex items-center gap-1"
            >
              Open <ArrowRight className="w-3 h-3" />
            </Link>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-surface-hover transition-colors text-muted hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-muted" />
            </div>
          ) : channels.length === 0 ? (
            <div className="text-center py-8 px-4">
              <p className="text-xs text-muted">No channels yet</p>
              <Link
                href="/m/chat"
                className="text-xs text-accent hover:underline mt-1 inline-block"
              >
                Go to Chat to create one
              </Link>
            </div>
          ) : (
            channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => openChannel(ch)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left border-b border-border/50"
              >
                {/* Icon */}
                <div className="w-8 h-8 rounded-lg bg-surface-hover flex items-center justify-center flex-shrink-0 mt-0.5">
                  {ch.type === "dm" ? (
                    <span className="text-xs font-medium text-foreground">
                      {initials(ch.name)}
                    </span>
                  ) : (
                    <Hash className="w-3.5 h-3.5 text-muted" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm truncate ${
                        ch.unread_count > 0
                          ? "font-semibold text-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {ch.type === "channel" ? "#" : ""}{ch.name}
                    </span>
                    {ch.last_message && (
                      <span className="text-[10px] text-muted flex-shrink-0 ml-2">
                        {timeAgo(ch.last_message.created_at)}
                      </span>
                    )}
                  </div>
                  {ch.last_message && (
                    <p className="text-xs text-muted truncate mt-0.5">
                      {ch.last_message.user?.full_name
                        ? `${ch.last_message.user.full_name.split(" ")[0]}: `
                        : ""}
                      {truncate(ch.last_message.body, 40)}
                    </p>
                  )}
                </div>

                {/* Unread badge */}
                {ch.unread_count > 0 && (
                  <span className="text-[10px] font-medium bg-accent text-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center flex-shrink-0 mt-1">
                    {ch.unread_count}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  /* ── Render: Active Channel Messages ── */

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <button
          onClick={goBack}
          className="p-1 rounded hover:bg-surface-hover transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-muted" />
        </button>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground truncate block">
            {activeChannel.type === "channel" ? "#" : ""}
            {activeChannel.name}
          </span>
        </div>
        <Link
          href="/m/chat"
          className="text-[10px] text-muted hover:text-accent transition-colors px-1.5 py-0.5 rounded hover:bg-surface-hover"
        >
          Full view
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {loadingMessages ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-muted">No messages yet</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.user_id === user?.id;
            const prevMsg = i > 0 ? messages[i - 1] : null;
            const sameSender = prevMsg?.user_id === msg.user_id;
            const sameMinute =
              prevMsg &&
              Math.abs(
                new Date(msg.created_at).getTime() -
                  new Date(prevMsg.created_at).getTime()
              ) < 120000;
            const grouped = sameSender && sameMinute;

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2 ${grouped ? "mt-0" : "mt-2.5"}`}
              >
                {/* Avatar or spacer */}
                {grouped ? (
                  <div className="w-6 flex-shrink-0" />
                ) : (
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-medium ${
                      isMe ? "bg-accent/20 text-accent" : "bg-surface-hover text-muted"
                    }`}
                  >
                    {initials(msg.user?.full_name, msg.user?.email)}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {!grouped && (
                    <div className="flex items-baseline gap-1.5 mb-0.5">
                      <span className="text-xs font-medium text-foreground">
                        {isMe ? "You" : msg.user?.full_name || msg.user?.email || "Unknown"}
                      </span>
                      <span className="text-[10px] text-muted">
                        {timeAgo(msg.created_at)}
                      </span>
                    </div>
                  )}
                  <p
                    className={`text-[13px] leading-relaxed break-words ${
                      msg.is_deleted ? "italic text-muted" : "text-foreground/90"
                    }`}
                  >
                    {renderBody(msg.body, members)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area with @mention autocomplete */}
      <div className="relative px-3 py-2 border-t border-border">
        {/* @mention dropdown */}
        {mentionQuery !== null && filteredMentions.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-surface border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto z-50">
            {filteredMentions.slice(0, 6).map((m) => (
              <button
                key={m.user_id}
                onClick={() => handleMentionSelect(m)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-hover transition-colors text-left"
              >
                <div className="w-6 h-6 rounded-full bg-surface-hover flex items-center justify-center text-[9px] font-medium text-muted flex-shrink-0">
                  {initials(m.user?.full_name, m.user?.email)}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-foreground text-xs truncate block">
                    {m.user?.full_name || m.user?.email}
                  </span>
                  {m.user?.full_name && (
                    <span className="text-[10px] text-muted truncate block">
                      {m.user.email}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 bg-surface-hover rounded-lg px-3 py-2">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (@ to mention)"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            className="p-1 rounded text-accent hover:bg-accent/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
