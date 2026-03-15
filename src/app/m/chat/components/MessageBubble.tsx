"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Reply,
  Smile,
  Pencil,
  Trash2,
  Pin,
  Bookmark,
  Copy,
  Link,
  MailOpen,
  Forward,
  MessageCircle,
  MoreHorizontal,
} from "lucide-react";
import {
  ChatMessage,
  MemberEntry,
  Reaction,
  UserRoleInfo,
  initials,
  formatTime,
  formatFullTime,
  parseMessageBody,
  canEditMessage,
  getRoleColor,
  QUICK_EMOJIS,
} from "./chat-types";
import EmojiPicker from "./EmojiPicker";

/* ── Avatar ─────────────────────────────────────────────── */

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

/* ── Reactions Row ──────────────────────────────────────── */

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
        const hasReacted = currentUserId ? r.user_ids.includes(currentUserId) : false;
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

/* ── Render Body with Markdown + Mentions ───────────────── */

function RenderBody({ body, members }: { body: string; members?: MemberEntry[] }) {
  const html = useMemo(() => {
    let processed = body;

    // Escape HTML first
    processed = processed
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Parse markdown
    processed = parseMessageBody(processed);

    // Highlight @mentions
    if (members && members.length > 0) {
      const namePatterns: string[] = [];
      for (const m of members) {
        if (m.user?.full_name) namePatterns.push(m.user.full_name);
        if (m.user?.email) namePatterns.push(m.user.email.split("@")[0]);
      }
      namePatterns.sort((a, b) => b.length - a.length);
      const escaped = namePatterns.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      if (escaped.length > 0) {
        const regex = new RegExp(`(@(?:${escaped.join("|")}))`, "gi");
        processed = processed.replace(regex, '<span class="text-accent font-medium">$1</span>');
      }
    } else {
      // Simple @mention highlight
      processed = processed.replace(
        /(@\S+(?:\s+[A-Z]\S*)*)/g,
        '<span class="text-accent font-medium">$1</span>'
      );
    }

    return processed;
  }, [body, members]);

  return (
    <span
      className="inline-block [&_pre]:my-1 [&_blockquote]:my-1 [&_li]:my-0.5"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/* ── Message Actions Toolbar ────────────────────────────── */

interface MessageActionsProps {
  isOwn: boolean;
  canEdit: boolean;
  hasThread?: boolean;
  isPinned?: boolean;
  isSaved?: boolean;
  onReply?: () => void;
  onReact: (emoji: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onPin?: () => void;
  onSave?: () => void;
  onCopy?: () => void;
  onCopyLink?: () => void;
  onMarkUnread?: () => void;
  onForward?: () => void;
}

function MessageActions({
  isOwn,
  canEdit,
  hasThread,
  isPinned,
  isSaved,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onPin,
  onSave,
  onCopy,
  onCopyLink,
  onMarkUnread,
  onForward,
}: MessageActionsProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMore) return;
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMore]);

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
            variant="quick"
            onSelect={(emoji) => {
              onReact(emoji);
              setShowEmojiPicker(false);
            }}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}
      </div>
      {onPin && (
        <button
          onClick={onPin}
          title={isPinned ? "Unpin message" : "Pin message"}
          className={`p-1.5 rounded hover:bg-surface-hover transition-colors ${
            isPinned ? "text-accent" : "text-muted hover:text-foreground"
          }`}
        >
          <Pin className="w-3.5 h-3.5" />
        </button>
      )}
      {onSave && (
        <button
          onClick={onSave}
          title={isSaved ? "Remove from saved" : "Save message"}
          className={`p-1.5 rounded hover:bg-surface-hover transition-colors ${
            isSaved ? "text-accent" : "text-muted hover:text-foreground"
          }`}
        >
          <Bookmark className={`w-3.5 h-3.5 ${isSaved ? "fill-accent" : ""}`} />
        </button>
      )}
      {canEdit && (
        <button
          onClick={onEdit}
          title="Edit message"
          className="p-1.5 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
      {/* More actions menu */}
      <div className="relative" ref={moreRef}>
        <button
          onClick={() => setShowMore((v) => !v)}
          title="More actions"
          className="p-1.5 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
        {showMore && (
          <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg py-1 min-w-[180px] z-50">
            {onCopy && (
              <button
                onClick={() => {
                  onCopy();
                  setShowMore(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors text-left"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy text
              </button>
            )}
            {onCopyLink && (
              <button
                onClick={() => {
                  onCopyLink();
                  setShowMore(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors text-left"
              >
                <Link className="w-3.5 h-3.5" />
                Copy link
              </button>
            )}
            {onMarkUnread && (
              <button
                onClick={() => {
                  onMarkUnread();
                  setShowMore(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors text-left"
              >
                <MailOpen className="w-3.5 h-3.5" />
                Mark unread
              </button>
            )}
            {onForward && (
              <button
                onClick={() => {
                  onForward();
                  setShowMore(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors text-left"
              >
                <Forward className="w-3.5 h-3.5" />
                Forward to channel
              </button>
            )}
            {isOwn && (
              <button
                onClick={() => {
                  onDelete();
                  setShowMore(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-muted hover:text-red-400 hover:bg-surface-hover transition-colors text-left"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Message Bubble ─────────────────────────────────────── */

interface MessageBubbleProps {
  msg: ChatMessage;
  prevMsg: ChatMessage | null;
  currentUserId: string | undefined;
  isAdmin: boolean;
  members: MemberEntry[];
  roleMap: Map<string, UserRoleInfo>;
  savedMessageIds: Set<string>;
  allowReply: boolean;
  editingMessageId: string | null;
  editDraft: string;
  onSetEditingMessage: (id: string | null, body?: string) => void;
  onSetEditDraft: (val: string) => void;
  onEditSave: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onOpenThread: (parentId: string) => void;
  onPin: (messageId: string) => void;
  onSave: (messageId: string) => void;
  onCopy: (body: string) => void;
  onCopyLink: (messageId: string) => void;
  onMarkUnread: (messageId: string) => void;
  onForward: (messageId: string) => void;
}

export default function MessageBubble({
  msg,
  prevMsg,
  currentUserId,
  isAdmin,
  members,
  roleMap,
  savedMessageIds,
  allowReply,
  editingMessageId,
  editDraft,
  onSetEditingMessage,
  onSetEditDraft,
  onEditSave,
  onDelete,
  onReaction,
  onOpenThread,
  onPin,
  onSave,
  onCopy,
  onCopyLink,
  onMarkUnread,
  onForward,
}: MessageBubbleProps) {
  const isMe = msg.user_id === currentUserId;
  const GAP_MS = 300000; // 5 min
  const showHeader =
    !prevMsg ||
    prevMsg.user_id !== msg.user_id ||
    new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > GAP_MS;

  const isEditing = editingMessageId === msg.id;
  const editAllowed = canEditMessage(msg, currentUserId, isAdmin);
  const isSaved = savedMessageIds.has(msg.id);
  const roleInfo = roleMap.get(msg.user_id);
  const nameColor = getRoleColor(roleInfo);

  return (
    <div className="group relative hover:bg-surface-hover/30 px-1 py-0.5 rounded transition-colors">
      {/* Hover actions */}
      {!msg.is_deleted && !isEditing && (
        <MessageActions
          isOwn={isMe}
          canEdit={editAllowed}
          hasThread={allowReply}
          isPinned={msg.is_pinned}
          isSaved={isSaved}
          onReply={allowReply ? () => onOpenThread(msg.id) : undefined}
          onReact={(emoji) => onReaction(msg.id, emoji)}
          onEdit={() => onSetEditingMessage(msg.id, msg.body)}
          onDelete={() => onDelete(msg.id)}
          onPin={() => onPin(msg.id)}
          onSave={() => onSave(msg.id)}
          onCopy={() => onCopy(msg.body)}
          onCopyLink={() => onCopyLink(msg.id)}
          onMarkUnread={() => onMarkUnread(msg.id)}
          onForward={() => onForward(msg.id)}
        />
      )}

      {showHeader ? (
        <div className="flex items-start gap-2 mt-3 mb-0.5">
          <Avatar
            name={msg.user?.full_name}
            email={msg.user?.email}
            isOwn={isMe}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className={`text-sm font-medium ${nameColor}`}>
                {msg.user?.full_name || msg.user?.email || "Unknown"}
              </span>
              <span className="text-xs text-muted" title={new Date(msg.created_at).toLocaleString()}>
                {formatFullTime(msg.created_at)}
              </span>
            </div>
            {/* Message body */}
            <div className="text-sm leading-relaxed mt-0.5">
              {msg.is_deleted ? (
                <span className="italic text-muted text-xs">[This message was deleted]</span>
              ) : isEditing ? (
                <EditInput
                  value={editDraft}
                  onChange={onSetEditDraft}
                  onSave={() => onEditSave(msg.id)}
                  onCancel={() => onSetEditingMessage(null)}
                />
              ) : (
                <span className={`inline-block rounded px-1 py-0.5 ${isMe ? "bg-accent/10" : "bg-transparent"}`}>
                  <RenderBody body={msg.body} members={members} />
                  {msg.edited_at && (
                    <span className="text-xs text-muted ml-1.5" title={`Edited ${new Date(msg.edited_at).toLocaleString()}`}>
                      (edited)
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Grouped message - no avatar/name, just indent */
        <div className="pl-9 text-sm leading-relaxed">
          <span className="invisible group-hover:visible text-[10px] text-muted mr-1 -ml-1 inline-block w-0 overflow-visible whitespace-nowrap">
            {formatFullTime(msg.created_at)}
          </span>
          {msg.is_deleted ? (
            <span className="italic text-muted text-xs">[This message was deleted]</span>
          ) : isEditing ? (
            <EditInput
              value={editDraft}
              onChange={onSetEditDraft}
              onSave={() => onEditSave(msg.id)}
              onCancel={() => onSetEditingMessage(null)}
            />
          ) : (
            <span className={`inline-block rounded px-1 py-0.5 ${isMe ? "bg-accent/10" : "bg-transparent"}`}>
              <RenderBody body={msg.body} members={members} />
              {msg.edited_at && (
                <span className="text-xs text-muted ml-1.5" title={`Edited ${new Date(msg.edited_at).toLocaleString()}`}>
                  (edited)
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {/* Reactions */}
      {!msg.is_deleted && (
        <ReactionsRow
          reactions={msg.reactions}
          currentUserId={currentUserId}
          onToggle={(emoji) => onReaction(msg.id, emoji)}
        />
      )}

      {/* Thread indicator */}
      {allowReply && !msg.is_deleted && msg.reply_count > 0 && (
        <button
          onClick={() => onOpenThread(msg.id)}
          className="pl-9 mt-1 text-xs text-accent hover:underline flex items-center gap-1"
        >
          <MessageCircle className="w-3 h-3" />
          {msg.reply_count} {msg.reply_count === 1 ? "reply" : "replies"}
        </button>
      )}
    </div>
  );
}

/* ── Edit Input ─────────────────────────────────────────── */

function EditInput({
  value,
  onChange,
  onSave,
  onCancel,
}: {
  value: string;
  onChange: (val: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSave();
          }
          if (e.key === "Escape") {
            onCancel();
          }
        }}
        autoFocus
        className="flex-1 bg-surface border border-accent rounded px-2 py-1 text-sm text-foreground outline-none"
      />
      <button onClick={onSave} className="text-xs text-accent hover:underline">
        Save
      </button>
      <button onClick={onCancel} className="text-xs text-muted hover:underline">
        Cancel
      </button>
    </div>
  );
}

export { Avatar, ReactionsRow, RenderBody };
