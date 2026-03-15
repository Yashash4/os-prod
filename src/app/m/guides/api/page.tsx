"use client";

import { useState } from "react";
import { Code, ChevronDown, ChevronRight, Copy, Check } from "lucide-react";

type Method = "GET" | "POST" | "PUT" | "DELETE";

const METHOD_COLORS: Record<Method, string> = {
  GET: "bg-green-500/15 text-green-400 border-green-500/30",
  POST: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  PUT: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  DELETE: "bg-red-500/15 text-red-400 border-red-500/30",
};

interface Endpoint {
  method: Method;
  path: string;
  description: string;
  auth: string;
  params?: { name: string; type: string; required: boolean; desc: string }[];
  body?: string;
  response?: string;
  errors?: { code: number; desc: string }[];
}

const endpoints: { category: string; items: Endpoint[] }[] = [
  {
    category: "Channels",
    items: [
      {
        method: "GET",
        path: "/api/chat/channels",
        description: "List all channels the authenticated user is a member of, including unread counts and last message preview.",
        auth: "Requires module access: chat",
        response: `{
  "channels": [
    {
      "id": "uuid",
      "name": "sales-team",
      "description": "Sales team discussions",
      "type": "channel",
      "is_private": false,
      "is_announcement": false,
      "topic": "Q1 targets",
      "created_by": "uuid",
      "created_at": "2026-03-15T00:00:00Z",
      "unread_count": 5,
      "last_message": {
        "body": "Hello team!",
        "created_at": "2026-03-15T12:00:00Z",
        "user": { "full_name": "Henal" }
      }
    }
  ]
}`,
        errors: [{ code: 401, desc: "Not authenticated" }, { code: 403, desc: "No module access" }],
      },
      {
        method: "POST",
        path: "/api/chat/channels",
        description: "Create a new channel. Creator is automatically added as a member.",
        auth: "Requires module access: chat",
        body: `{
  "name": "project-alpha",
  "description": "Discussion for Project Alpha",
  "type": "channel",       // "channel" | "dm"
  "is_private": false,     // optional, default false
  "is_announcement": false,// optional, default false
  "member_ids": [          // optional, initial members
    "user-uuid-1",
    "user-uuid-2"
  ]
}`,
        response: `{
  "channel": {
    "id": "new-channel-uuid",
    "name": "project-alpha",
    "type": "channel",
    "created_by": "your-uuid",
    "created_at": "2026-03-15T12:00:00Z"
  }
}`,
        errors: [
          { code: 400, desc: "Name is required / invalid type" },
          { code: 403, desc: "DMs require at least one admin participant" },
        ],
      },
      {
        method: "DELETE",
        path: "/api/chat/channels",
        description: "Delete a channel. Only the creator or an admin can delete.",
        auth: "Requires module access: chat + admin or creator",
        params: [{ name: "id", type: "uuid", required: true, desc: "Channel ID to delete" }],
        errors: [
          { code: 403, desc: "Only creator or admin can delete" },
          { code: 404, desc: "Channel not found" },
        ],
      },
    ],
  },
  {
    category: "Messages",
    items: [
      {
        method: "GET",
        path: "/api/chat/messages",
        description: "Fetch messages for a channel. Supports pagination and thread replies.",
        auth: "Requires module access: chat",
        params: [
          { name: "channel_id", type: "uuid", required: true, desc: "Channel to fetch messages from" },
          { name: "parent_id", type: "uuid", required: false, desc: "If provided, fetches thread replies for this parent message" },
          { name: "before", type: "uuid", required: false, desc: "Cursor pagination: fetch messages before this message ID" },
          { name: "limit", type: "number", required: false, desc: "Number of messages to return (default: 50, max: 100)" },
        ],
        response: `{
  "messages": [
    {
      "id": "uuid",
      "channel_id": "uuid",
      "user_id": "uuid",
      "body": "Hello **everyone**!",
      "parent_id": null,
      "reply_count": 3,
      "is_deleted": false,
      "is_system": false,
      "is_silent": false,
      "edited_at": null,
      "attachments": [],
      "link_previews": [],
      "reactions": [
        { "emoji": "👍", "count": 2, "users": ["uuid1", "uuid2"] }
      ],
      "is_pinned": false,
      "is_saved": true,
      "created_at": "2026-03-15T12:00:00Z",
      "user": {
        "id": "uuid",
        "full_name": "Henal",
        "email": "henal@example.com",
        "avatar_url": null
      }
    }
  ]
}`,
      },
      {
        method: "POST",
        path: "/api/chat/messages",
        description: "Send a new message to a channel or thread.",
        auth: "Requires module access: chat",
        body: `{
  "channel_id": "uuid",     // required
  "body": "Hello team!",    // required, message content
  "parent_id": "uuid",      // optional, for thread replies
  "mentions": ["uuid1"],    // optional, user IDs to notify
  "is_silent": false         // optional, send without notification
}`,
        response: `{
  "message": {
    "id": "new-message-uuid",
    "body": "Hello team!",
    "created_at": "2026-03-15T12:00:00Z",
    "user": { "id": "uuid", "full_name": "Henal" }
  }
}`,
        errors: [
          { code: 400, desc: "channel_id and body are required" },
          { code: 403, desc: "Not a member of this channel" },
        ],
      },
      {
        method: "PUT",
        path: "/api/chat/messages",
        description: "Edit a message. Only the message author can edit, and only within 2 minutes of sending. Admins can edit anytime.",
        auth: "Requires module access: chat + message ownership",
        body: `{
  "id": "message-uuid",
  "body": "Updated message text"
}`,
        response: `{
  "message": {
    "id": "message-uuid",
    "body": "Updated message text",
    "edited_at": "2026-03-15T12:02:00Z"
  }
}`,
        errors: [
          { code: 403, desc: "Edit window expired (2 minutes)" },
          { code: 403, desc: "Can only edit own messages" },
          { code: 404, desc: "Message not found" },
        ],
      },
      {
        method: "DELETE",
        path: "/api/chat/messages",
        description: "Soft-delete a message (sets is_deleted=true). Only the author or an admin can delete.",
        auth: "Requires module access: chat + ownership or admin",
        params: [{ name: "id", type: "uuid", required: true, desc: "Message ID to delete" }],
        errors: [{ code: 403, desc: "Can only delete own messages (or admin)" }],
      },
    ],
  },
  {
    category: "Members",
    items: [
      {
        method: "GET",
        path: "/api/chat/channels/members",
        description: "List all members of a channel with user details.",
        auth: "Requires module access: chat",
        params: [{ name: "channel_id", type: "uuid", required: true, desc: "Channel ID" }],
        response: `{
  "members": [
    {
      "user_id": "uuid",
      "user": {
        "id": "uuid",
        "full_name": "Henal",
        "email": "henal@example.com",
        "avatar_url": null
      },
      "joined_at": "2026-03-15T00:00:00Z"
    }
  ]
}`,
      },
      {
        method: "POST",
        path: "/api/chat/channels/members",
        description: "Add one or more users to a channel.",
        auth: "Requires module access: chat + channel admin/creator",
        body: `{
  "channel_id": "uuid",
  "user_ids": ["uuid1", "uuid2"]
}`,
      },
      {
        method: "DELETE",
        path: "/api/chat/channels/members",
        description: "Remove a user from a channel. Users can remove themselves (leave).",
        auth: "Requires module access: chat",
        params: [
          { name: "channel_id", type: "uuid", required: true, desc: "Channel ID" },
          { name: "user_id", type: "uuid", required: true, desc: "User ID to remove" },
        ],
      },
    ],
  },
  {
    category: "Reactions",
    items: [
      {
        method: "POST",
        path: "/api/chat/reactions",
        description: "Toggle a reaction on a message. If the reaction exists, removes it; otherwise adds it.",
        auth: "Requires module access: chat",
        body: `{
  "message_id": "uuid",
  "emoji": "👍"
}`,
        response: `{
  "reactions": [
    { "emoji": "👍", "count": 3, "users": ["uuid1", "uuid2", "uuid3"] }
  ]
}`,
      },
    ],
  },
  {
    category: "Pins",
    items: [
      {
        method: "GET",
        path: "/api/chat/pins",
        description: "Get all pinned messages for a channel, ordered by pin date (newest first).",
        auth: "Requires module access: chat + channel membership",
        params: [{ name: "channel_id", type: "uuid", required: true, desc: "Channel ID" }],
        response: `{
  "pins": [
    {
      "id": "pin-uuid",
      "message_id": "uuid",
      "pinned_by": "uuid",
      "created_at": "2026-03-15T12:00:00Z",
      "message": {
        "id": "uuid",
        "body": "Important announcement",
        "user": { "full_name": "Henal" }
      }
    }
  ]
}`,
      },
      {
        method: "POST",
        path: "/api/chat/pins",
        description: "Pin a message to a channel. Max 100 pins per channel.",
        auth: "Requires module access: chat + channel membership",
        body: `{
  "message_id": "uuid",
  "channel_id": "uuid"
}`,
        errors: [
          { code: 400, desc: "Message already pinned" },
          { code: 400, desc: "Pin limit reached (100)" },
        ],
      },
      {
        method: "DELETE",
        path: "/api/chat/pins",
        description: "Unpin a message. Only the person who pinned it or an admin can unpin.",
        auth: "Requires module access: chat + pin creator or admin",
        params: [{ name: "id", type: "uuid", required: true, desc: "Pin ID" }],
      },
    ],
  },
  {
    category: "Saved Items",
    items: [
      {
        method: "GET",
        path: "/api/chat/saved",
        description: "Get all saved/bookmarked messages for the current user.",
        auth: "Requires module access: chat",
        response: `{
  "saved": [
    {
      "id": "save-uuid",
      "message_id": "uuid",
      "created_at": "2026-03-15T12:00:00Z",
      "message": {
        "id": "uuid",
        "body": "Save this for later",
        "channel_id": "uuid",
        "user": { "full_name": "Henal" },
        "created_at": "2026-03-15T11:00:00Z"
      }
    }
  ]
}`,
      },
      {
        method: "POST",
        path: "/api/chat/saved",
        description: "Save/bookmark a message. Idempotent — saving an already-saved message is a no-op.",
        auth: "Requires module access: chat",
        body: `{ "message_id": "uuid" }`,
      },
      {
        method: "DELETE",
        path: "/api/chat/saved",
        description: "Remove a message from saved items.",
        auth: "Requires module access: chat",
        params: [{ name: "message_id", type: "uuid", required: true, desc: "Message ID to unsave" }],
      },
    ],
  },
  {
    category: "Drafts",
    items: [
      {
        method: "GET",
        path: "/api/chat/drafts",
        description: "Get the saved draft for a specific channel.",
        auth: "Requires module access: chat",
        params: [{ name: "channel_id", type: "uuid", required: true, desc: "Channel ID" }],
        response: `{
  "draft": {
    "body": "My unsent message...",
    "attachments": [],
    "updated_at": "2026-03-15T12:00:00Z"
  }
}`,
      },
      {
        method: "PUT",
        path: "/api/chat/drafts",
        description: "Save or update a draft for a channel. Upserts automatically.",
        auth: "Requires module access: chat",
        body: `{
  "channel_id": "uuid",
  "body": "My draft message...",
  "attachments": []
}`,
      },
      {
        method: "DELETE",
        path: "/api/chat/drafts",
        description: "Delete a draft (e.g. after sending the message).",
        auth: "Requires module access: chat",
        params: [{ name: "channel_id", type: "uuid", required: true, desc: "Channel ID" }],
      },
    ],
  },
  {
    category: "Presence & Typing",
    items: [
      {
        method: "GET",
        path: "/api/chat/presence",
        description: "Get presence status for multiple users.",
        auth: "Requires module access: chat",
        params: [{ name: "user_ids", type: "string", required: true, desc: "Comma-separated user UUIDs" }],
        response: `{
  "presence": [
    {
      "user_id": "uuid",
      "status": "online",
      "custom_text": "In a meeting",
      "custom_emoji": "📅",
      "typing_in": null,
      "last_seen_at": "2026-03-15T12:00:00Z"
    }
  ]
}`,
      },
      {
        method: "POST",
        path: "/api/chat/presence",
        description: "Send a heartbeat to update your presence. Also used for typing indicators.",
        auth: "Requires module access: chat",
        body: `{
  "status": "online",          // optional: "online" | "away" | "offline"
  "typing_in": "channel-uuid", // optional: set to channel ID when typing, null to clear
  "custom_text": "WFH",        // optional
  "custom_emoji": "🏠",        // optional
  "expires_at": "2026-03-15T18:00:00Z"  // optional: auto-clear status
}`,
      },
    ],
  },
  {
    category: "Read Cursors",
    items: [
      {
        method: "GET",
        path: "/api/chat/read-cursors",
        description: "Get unread counts for all channels the user is a member of.",
        auth: "Requires module access: chat",
        response: `{
  "cursors": [
    {
      "channel_id": "uuid",
      "unread_count": 5,
      "last_read_message_id": "uuid"
    }
  ]
}`,
      },
      {
        method: "PUT",
        path: "/api/chat/read-cursors",
        description: "Update the read cursor for a channel (mark messages as read up to a specific message).",
        auth: "Requires module access: chat",
        body: `{
  "channel_id": "uuid",
  "last_read_message_id": "uuid"
}`,
      },
    ],
  },
  {
    category: "Notification Preferences",
    items: [
      {
        method: "GET",
        path: "/api/chat/notification-prefs",
        description: "Get notification preference for a specific channel.",
        auth: "Requires module access: chat",
        params: [{ name: "channel_id", type: "uuid", required: true, desc: "Channel ID" }],
        response: `{
  "pref": {
    "level": "mentions",
    "keywords": ["urgent", "project-alpha"]
  }
}`,
      },
      {
        method: "PUT",
        path: "/api/chat/notification-prefs",
        description: "Set notification preference for a channel.",
        auth: "Requires module access: chat",
        body: `{
  "channel_id": "uuid",
  "level": "mentions",                    // "all" | "mentions"
  "keywords": ["urgent", "deploy"]        // optional keyword alerts
}`,
      },
    ],
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1 rounded hover:bg-surface-hover transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-muted" />}
    </button>
  );
}

function EndpointCard({ ep }: { ep: Endpoint }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left"
      >
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${METHOD_COLORS[ep.method]}`}>
          {ep.method}
        </span>
        <code className="text-sm font-mono text-foreground flex-1">{ep.path}</code>
        {open ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronRight className="w-4 h-4 text-muted" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border bg-surface/50">
          <p className="text-sm text-muted mt-3 mb-2">{ep.description}</p>
          <p className="text-xs text-accent mb-3">{ep.auth}</p>

          {ep.params && ep.params.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-semibold text-foreground mb-1.5">Query Parameters</h4>
              <div className="space-y-1">
                {ep.params.map((p) => (
                  <div key={p.name} className="flex items-start gap-2 text-xs">
                    <code className="bg-[#1a1a2e] px-1.5 py-0.5 rounded font-mono text-foreground">{p.name}</code>
                    <span className="text-muted">{p.type}</span>
                    {p.required && <span className="text-red-400 text-[10px]">required</span>}
                    <span className="text-muted flex-1">{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ep.body && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="text-xs font-semibold text-foreground">Request Body</h4>
                <CopyButton text={ep.body} />
              </div>
              <pre className="bg-[#1a1a2e] border border-border rounded-lg px-4 py-3 text-xs font-mono text-foreground overflow-x-auto whitespace-pre">
                {ep.body}
              </pre>
            </div>
          )}

          {ep.response && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="text-xs font-semibold text-foreground">Response <span className="text-green-400">200</span></h4>
                <CopyButton text={ep.response} />
              </div>
              <pre className="bg-[#1a1a2e] border border-border rounded-lg px-4 py-3 text-xs font-mono text-foreground overflow-x-auto whitespace-pre">
                {ep.response}
              </pre>
            </div>
          )}

          {ep.errors && ep.errors.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-foreground mb-1.5">Error Codes</h4>
              <div className="space-y-1">
                {ep.errors.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded font-mono">{e.code}</span>
                    <span className="text-muted">{e.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ApiReferencePage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* Sidebar */}
      <nav className="w-52 flex-shrink-0 border-r border-border overflow-y-auto p-4 hidden lg:block">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Endpoints</h2>
        <ul className="space-y-0.5">
          {endpoints.map((cat) => (
            <li key={cat.category}>
              <button
                onClick={() => {
                  setActiveCategory(cat.category);
                  document.getElementById(`cat-${cat.category}`)?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  activeCategory === cat.category
                    ? "bg-accent/10 text-accent font-medium"
                    : "text-muted hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                {cat.category}
                <span className="text-muted ml-1.5">({cat.items.length})</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-6 pt-4 border-t border-border">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Auth</h3>
          <p className="text-[11px] text-muted leading-relaxed">
            All endpoints require a Bearer token via the <code className="text-accent text-[10px]">Authorization</code> header. Use <code className="text-accent text-[10px]">apiFetch()</code> on the client — it auto-attaches the token.
          </p>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <Code className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">API Reference</h1>
                <p className="text-sm text-muted">Chat module REST API documentation</p>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-lg px-4 py-3 mb-8">
            <h3 className="text-sm font-semibold text-foreground mb-1">Base URL</h3>
            <code className="text-xs font-mono text-accent">https://os.apexfashionlab.com</code>
            <p className="text-xs text-muted mt-1.5">
              All endpoints are relative to the base URL. Authentication is via Bearer token in the <code className="text-accent">Authorization</code> header.
              Every request must include <code className="text-accent">Content-Type: application/json</code> for POST/PUT.
            </p>
          </div>

          {endpoints.map((cat) => (
            <section key={cat.category} id={`cat-${cat.category}`} className="mb-10">
              <h2 className="text-base font-semibold text-foreground mb-3 pb-2 border-b border-border">
                {cat.category}
              </h2>
              {cat.items.map((ep, i) => (
                <EndpointCard key={`${ep.method}-${ep.path}-${i}`} ep={ep} />
              ))}
            </section>
          ))}

          <div className="text-center py-8 border-t border-border">
            <p className="text-xs text-muted">
              All responses use standard HTTP status codes. <code className="text-accent">200</code> = success, <code className="text-accent">201</code> = created, <code className="text-accent">400</code> = bad request, <code className="text-accent">401</code> = unauthorized, <code className="text-accent">403</code> = forbidden, <code className="text-accent">500</code> = server error.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
