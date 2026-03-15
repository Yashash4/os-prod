/* ── Shared Types & Constants for Chat ───────────────────── */

export interface ChatUser {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url?: string;
  role_id?: string;
  is_admin?: boolean;
  role_name?: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  user_ids: string[];
}

export interface ChatMessage {
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
  is_pinned?: boolean;
  pinned_by?: string | null;
}

export interface ChatChannel {
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

export interface MemberEntry {
  id: string;
  channel_id: string;
  user_id: string;
  user: ChatUser | null;
}

export interface SavedMessage {
  id: string;
  message_id: string;
  user_id: string;
  created_at: string;
  message: ChatMessage;
}

export interface DraftEntry {
  channel_id: string;
  body: string;
  updated_at: string;
}

export interface TypingUser {
  user_id: string;
  full_name: string | null;
  typing_in: string;
  updated_at: string;
}

export interface ReadCursor {
  channel_id: string;
  user_id: string;
  last_read_message_id: string | null;
  last_read_at: string | null;
}

export type RightPanelType = "none" | "members" | "thread" | "pins" | "saved";

/* ── Role Color Mapping ─────────────────────────────────── */

export interface UserRoleInfo {
  userId: string;
  roleName: string;
  isAdmin: boolean;
}

export function getRoleColor(info: UserRoleInfo | undefined): string {
  if (!info) return "text-foreground";
  if (info.isAdmin) return "text-[#B8860B]"; // gold/accent
  const name = info.roleName.toLowerCase();
  if (name.includes("manager") || name.includes("lead") || name.includes("director") || name.includes("head")) return "text-[#3B82F6]";
  if (name.includes("sales") || name.includes("marketing")) return "text-[#22C55E]";
  if (name.includes("intern") || name.includes("trainee")) return "text-[#A3A3A3]";
  return "text-foreground";
}

/* ── Constants ──────────────────────────────────────────── */

export const QUICK_EMOJIS = ["\u{1F44D}", "\u{2764}\u{FE0F}", "\u{1F604}", "\u{1F389}", "\u{1F440}", "\u{1F525}"];
export const MSG_GROUP_GAP_MS = 300000; // 5 minutes
export const EDIT_TIME_LIMIT_MS = 120000; // 2 minutes

/* ── Emoji Data ─────────────────────────────────────────── */

export interface EmojiCategory {
  name: string;
  icon: string;
  emojis: string[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: "Smileys",
    icon: "\u{1F600}",
    emojis: [
      "\u{1F600}", "\u{1F603}", "\u{1F604}", "\u{1F601}", "\u{1F606}", "\u{1F605}", "\u{1F602}", "\u{1F923}",
      "\u{1F60A}", "\u{1F607}", "\u{1F642}", "\u{1F643}", "\u{1F609}", "\u{1F60C}", "\u{1F60D}", "\u{1F970}",
      "\u{1F618}", "\u{1F617}", "\u{1F619}", "\u{1F61A}", "\u{1F60B}", "\u{1F61B}", "\u{1F61C}", "\u{1F92A}",
      "\u{1F61D}", "\u{1F911}", "\u{1F917}", "\u{1F92D}", "\u{1F92B}", "\u{1F914}", "\u{1F910}", "\u{1F928}",
      "\u{1F610}", "\u{1F611}", "\u{1F636}", "\u{1F60F}", "\u{1F612}", "\u{1F644}", "\u{1F62C}", "\u{1F925}",
      "\u{1F60C}", "\u{1F614}", "\u{1F62A}", "\u{1F924}", "\u{1F634}", "\u{1F637}", "\u{1F912}", "\u{1F915}",
      "\u{1F922}", "\u{1F92E}", "\u{1F927}", "\u{1F975}", "\u{1F976}", "\u{1F974}", "\u{1F635}", "\u{1F92F}",
    ],
  },
  {
    name: "People",
    icon: "\u{1F44B}",
    emojis: [
      "\u{1F44B}", "\u{1F91A}", "\u{1F590}\u{FE0F}", "\u{270B}", "\u{1F596}", "\u{1F44C}", "\u{1F90F}", "\u{270C}\u{FE0F}",
      "\u{1F91E}", "\u{1F91F}", "\u{1F918}", "\u{1F919}", "\u{1F448}", "\u{1F449}", "\u{1F446}", "\u{1F595}",
      "\u{1F447}", "\u{261D}\u{FE0F}", "\u{1F44D}", "\u{1F44E}", "\u{270A}", "\u{1F44A}", "\u{1F91B}", "\u{1F91C}",
      "\u{1F44F}", "\u{1F64C}", "\u{1F450}", "\u{1F932}", "\u{1F91D}", "\u{1F64F}", "\u{270D}\u{FE0F}", "\u{1F485}",
      "\u{1F933}", "\u{1F4AA}", "\u{1F9BE}", "\u{1F9BF}", "\u{1F9B5}", "\u{1F9B6}", "\u{1F442}", "\u{1F443}",
    ],
  },
  {
    name: "Animals",
    icon: "\u{1F436}",
    emojis: [
      "\u{1F436}", "\u{1F431}", "\u{1F42D}", "\u{1F439}", "\u{1F430}", "\u{1F98A}", "\u{1F43B}", "\u{1F43C}",
      "\u{1F428}", "\u{1F42F}", "\u{1F981}", "\u{1F42E}", "\u{1F437}", "\u{1F438}", "\u{1F435}", "\u{1F648}",
      "\u{1F649}", "\u{1F64A}", "\u{1F412}", "\u{1F414}", "\u{1F427}", "\u{1F426}", "\u{1F985}", "\u{1F986}",
      "\u{1F989}", "\u{1F987}", "\u{1F43A}", "\u{1F417}", "\u{1F434}", "\u{1F984}", "\u{1F41D}", "\u{1F41B}",
      "\u{1F98B}", "\u{1F40C}", "\u{1F41A}", "\u{1F41E}", "\u{1F997}", "\u{1F577}\u{FE0F}", "\u{1F578}\u{FE0F}", "\u{1F982}",
    ],
  },
  {
    name: "Food",
    icon: "\u{1F354}",
    emojis: [
      "\u{1F34E}", "\u{1F34F}", "\u{1F350}", "\u{1F34A}", "\u{1F34B}", "\u{1F34C}", "\u{1F349}", "\u{1F347}",
      "\u{1F353}", "\u{1F348}", "\u{1F352}", "\u{1F351}", "\u{1F96D}", "\u{1F34D}", "\u{1F965}", "\u{1F95D}",
      "\u{1F345}", "\u{1F346}", "\u{1F951}", "\u{1F966}", "\u{1F955}", "\u{1F33D}", "\u{1F336}\u{FE0F}", "\u{1F952}",
      "\u{1F96C}", "\u{1F354}", "\u{1F355}", "\u{1F32E}", "\u{1F32F}", "\u{1F959}", "\u{1F9C6}", "\u{1F957}",
      "\u{1F35D}", "\u{1F35C}", "\u{1F363}", "\u{1F371}", "\u{1F35B}", "\u{1F35E}", "\u{1F9C0}", "\u{1F356}",
    ],
  },
  {
    name: "Travel",
    icon: "\u{2708}\u{FE0F}",
    emojis: [
      "\u{1F697}", "\u{1F695}", "\u{1F68C}", "\u{1F3CE}\u{FE0F}", "\u{1F693}", "\u{1F691}", "\u{1F692}", "\u{1F6F5}",
      "\u{1F3CD}\u{FE0F}", "\u{1F6B2}", "\u{1F6E3}\u{FE0F}", "\u{1F3D7}\u{FE0F}", "\u{2708}\u{FE0F}", "\u{1F6EB}", "\u{1F6EC}", "\u{1F680}",
      "\u{1F6F8}", "\u{1F6A2}", "\u{26F5}", "\u{1F3D6}\u{FE0F}", "\u{1F3DD}\u{FE0F}", "\u{1F3D4}\u{FE0F}", "\u{26F0}\u{FE0F}", "\u{1F30B}",
      "\u{1F3E0}", "\u{1F3E2}", "\u{1F3E5}", "\u{1F3EB}", "\u{26EA}", "\u{1F54C}", "\u{1F54D}", "\u{1F5FC}",
    ],
  },
  {
    name: "Activities",
    icon: "\u{26BD}",
    emojis: [
      "\u{26BD}", "\u{1F3C0}", "\u{1F3C8}", "\u{26BE}", "\u{1F94E}", "\u{1F3BE}", "\u{1F3D0}", "\u{1F3C9}",
      "\u{1F94F}", "\u{1F3B1}", "\u{1F3D3}", "\u{1F3F8}", "\u{1F3D2}", "\u{1F3D1}", "\u{1F94D}", "\u{26F3}",
      "\u{1F3AF}", "\u{1F3A3}", "\u{1F94A}", "\u{1F94B}", "\u{1F3BD}", "\u{1F6F9}", "\u{1F3BF}", "\u{26F7}\u{FE0F}",
      "\u{1F3C2}", "\u{1F3CB}\u{FE0F}", "\u{1F93C}", "\u{1F938}", "\u{26F9}\u{FE0F}", "\u{1F93A}", "\u{1F3C7}", "\u{1F9D7}",
    ],
  },
  {
    name: "Objects",
    icon: "\u{1F4A1}",
    emojis: [
      "\u{1F4A1}", "\u{1F526}", "\u{1F3EE}", "\u{1F4D4}", "\u{1F4D5}", "\u{1F4D6}", "\u{1F4D7}", "\u{1F4D8}",
      "\u{1F4D9}", "\u{1F4DA}", "\u{1F4D3}", "\u{1F4CB}", "\u{1F4CC}", "\u{1F4CD}", "\u{1F4CE}", "\u{1F587}\u{FE0F}",
      "\u{2702}\u{FE0F}", "\u{1F4DD}", "\u{270F}\u{FE0F}", "\u{1F58A}\u{FE0F}", "\u{1F58B}\u{FE0F}", "\u{1F4BB}", "\u{1F5A5}\u{FE0F}", "\u{1F5A8}\u{FE0F}",
      "\u{1F4F1}", "\u{1F4F7}", "\u{1F4F9}", "\u{1F4FA}", "\u{1F4FB}", "\u{1F50A}", "\u{1F3B5}", "\u{1F3B6}",
    ],
  },
  {
    name: "Symbols",
    icon: "\u{2764}\u{FE0F}",
    emojis: [
      "\u{2764}\u{FE0F}", "\u{1F9E1}", "\u{1F49B}", "\u{1F49A}", "\u{1F499}", "\u{1F49C}", "\u{1F5A4}", "\u{1F90D}",
      "\u{1F90E}", "\u{1F494}", "\u{2763}\u{FE0F}", "\u{1F495}", "\u{1F49E}", "\u{1F493}", "\u{1F497}", "\u{1F496}",
      "\u{1F498}", "\u{1F49D}", "\u{1F49F}", "\u{262E}\u{FE0F}", "\u{271D}\u{FE0F}", "\u{2626}\u{FE0F}", "\u{2638}\u{FE0F}", "\u{2622}\u{FE0F}",
      "\u{2734}\u{FE0F}", "\u{1F51F}", "\u{1F4AF}", "\u{1F522}", "\u{1F523}", "\u{1F524}", "\u{1F520}", "\u{1F521}",
      "\u{2714}\u{FE0F}", "\u{274C}", "\u{2B50}", "\u{1F31F}", "\u{1F4A5}", "\u{1F4A2}", "\u{1F4AB}", "\u{1F4AC}",
    ],
  },
];

/* ── Helper Functions ───────────────────────────────────── */

export function initials(name: string | null | undefined, email?: string): string {
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

export function formatTime(iso: string): string {
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

export function formatFullTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDateDivider(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - messageDay.getTime()) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

/** Extract @Name mentions from text and resolve to user IDs */
export function extractMentionIds(text: string, members: MemberEntry[]): string[] {
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

/** Parse markdown-like formatting in message body */
export function parseMessageBody(body: string): string {
  // Forwarded message — render as a styled card
  const fwdMatch = body.match(/^>\s?([\s\S]*?)\n\n_(?:Forwarded from (.+?)(?:\s*—\s*originally by (.+?))?|\(forwarded message\))_$/);
  if (fwdMatch) {
    const quoted = fwdMatch[1].replace(/^>\s?/gm, "").trim();
    const fromChannel = fwdMatch[2] || "";
    const author = fwdMatch[3] || "";
    const metaLine = fromChannel ? `Forwarded from <strong>${escapeHtml(fromChannel)}</strong>${author ? ` · by ${escapeHtml(author)}` : ""}` : "Forwarded message";
    return `<div class="fwd-card"><p class="fwd-meta">${metaLine}</p><p class="fwd-body">${escapeHtml(quoted)}</p></div>`;
  }

  // Step 1: Extract code blocks and inline code into placeholders (so other regexes don't corrupt them)
  const placeholders: string[] = [];
  let html = body;

  // Code blocks (triple backticks)
  html = html.replace(/```([\s\S]*?)```/g, (_match, code) => {
    const idx = placeholders.length;
    placeholders.push(`<pre class="code-block"><code>${escapeHtml(code)}</code></pre>`);
    return `%%PLACEHOLDER_${idx}%%`;
  });

  // Inline code (single backtick)
  html = html.replace(/`([^`]+)`/g, (_match, code) => {
    const idx = placeholders.length;
    placeholders.push(`<code class="inline-code">${escapeHtml(code)}</code>`);
    return `%%PLACEHOLDER_${idx}%%`;
  });

  // Step 2: Apply text formatting (safe — no HTML in the text at this point)
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic (both *text* and _text_)
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>');
  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del class="text-muted">$1</del>');
  // Blockquote (line starting with >)
  html = html.replace(/^&gt;\s?(.*)$/gm, '<blockquote class="msg-quote">$1</blockquote>');
  html = html.replace(/^>\s?(.*)$/gm, '<blockquote class="msg-quote">$1</blockquote>');
  // Unordered list items
  html = html.replace(/^- (.*)$/gm, '<li class="ml-4 list-disc">$1</li>');
  // Ordered list items
  html = html.replace(/^\d+\. (.*)$/gm, '<li class="ml-4 list-decimal">$1</li>');
  // #channel linking — only match word-like names (not hex colors like #1e1e1e)
  html = html.replace(/(?<![&\w])#([a-z][a-z0-9-]{1,})/gi, '<a href="#" data-channel="$1" class="text-accent font-medium hover:underline cursor-pointer">#$1</a>');
  // Auto-detect URLs and make them clickable (skip if already inside a tag)
  html = html.replace(/(?<![="'])((https?:\/\/[^\s<>"']+))/gi, '<a href="$1" target="_blank" rel="noopener" class="text-accent underline hover:text-accent/80">$1</a>');
  // Newlines to <br>
  html = html.replace(/\n/g, '<br>');

  // Step 3: Restore code placeholders
  for (let i = 0; i < placeholders.length; i++) {
    html = html.replace(`%%PLACEHOLDER_${i}%%`, placeholders[i]);
  }

  return html;
}

/** Escape HTML special characters */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Check if a message is within edit time limit */
export function canEditMessage(msg: ChatMessage, userId: string | undefined, isAdmin: boolean): boolean {
  if (!userId || msg.user_id !== userId) return false;
  if (msg.is_deleted) return false;
  if (isAdmin) return true;
  const elapsed = Date.now() - new Date(msg.created_at).getTime();
  return elapsed < EDIT_TIME_LIMIT_MS;
}
