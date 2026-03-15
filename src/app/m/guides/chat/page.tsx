"use client";

import { useState, useEffect } from "react";
import {
  MessageCircle, Hash, Lock, Megaphone, AtSign, Smile, Pin,
  Bookmark, Search, Bell, Keyboard, Paperclip, Lightbulb,
  ChevronRight, ArrowUp, Users, Edit3, Trash2, Forward,
  Copy, Clock, Send, Eye, Zap, Globe,
} from "lucide-react";

const sections = [
  { id: "getting-started", label: "Getting Started", icon: MessageCircle },
  { id: "channels", label: "Channels", icon: Hash },
  { id: "direct-messages", label: "Direct Messages", icon: Users },
  { id: "sending-messages", label: "Sending Messages", icon: Send },
  { id: "formatting", label: "Text Formatting", icon: Edit3 },
  { id: "threads", label: "Threads", icon: ChevronRight },
  { id: "reactions", label: "Reactions", icon: Smile },
  { id: "message-actions", label: "Message Actions", icon: Zap },
  { id: "pins-saved", label: "Pins & Saved Items", icon: Pin },
  { id: "search", label: "Search", icon: Search },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "presence", label: "Presence & Status", icon: Eye },
  { id: "files", label: "Files & Media", icon: Paperclip },
  { id: "shortcuts", label: "Keyboard Shortcuts", icon: Keyboard },
  { id: "tips", label: "Tips & Tricks", icon: Lightbulb },
];

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-accent bg-accent/5 rounded-r-lg px-4 py-3 my-4 text-sm">
      <span className="font-semibold text-accent">Pro tip:</span>{" "}
      <span className="text-muted">{children}</span>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-[#1a1a2e] text-accent px-1.5 py-0.5 rounded text-xs font-mono">
      {children}
    </code>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-[#1a1a2e] border border-border rounded-lg px-4 py-3 my-3 text-xs font-mono text-foreground overflow-x-auto">
      {children}
    </pre>
  );
}

function Example({ input, output }: { input: string; output: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 my-3">
      <div className="bg-[#1a1a2e] border border-border rounded-lg px-3 py-2">
        <p className="text-[10px] text-muted uppercase tracking-wider mb-1">You type</p>
        <p className="text-xs font-mono text-foreground">{input}</p>
      </div>
      <div className="bg-surface border border-border rounded-lg px-3 py-2">
        <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Result</p>
        <p className="text-xs text-foreground" dangerouslySetInnerHTML={{ __html: output }} />
      </div>
    </div>
  );
}

function ShortcutRow({ keys, desc }: { keys: string; desc: string }) {
  return (
    <tr className="border-b border-border/50">
      <td className="py-2 pr-4">
        <kbd className="bg-[#1a1a2e] border border-border text-xs font-mono px-2 py-0.5 rounded">{keys}</kbd>
      </td>
      <td className="py-2 text-sm text-muted">{desc}</td>
    </tr>
  );
}

export default function ChatGuidePage() {
  const [activeSection, setActiveSection] = useState("getting-started");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* Sidebar TOC */}
      <nav className="w-56 flex-shrink-0 border-r border-border overflow-y-auto p-4 hidden lg:block">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">On this page</h2>
        <ul className="space-y-0.5">
          {sections.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => scrollTo(s.id)}
                className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  activeSection === s.id
                    ? "bg-accent/10 text-accent font-medium"
                    : "text-muted hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                <s.icon className="w-3.5 h-3.5 flex-shrink-0" />
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Chat Guide</h1>
                <p className="text-sm text-muted">Everything you need to know about APEX OS messaging</p>
              </div>
            </div>
          </div>

          {/* Getting Started */}
          <section id="getting-started" className="mb-12">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-accent" /> Getting Started
            </h2>
            <p className="text-sm text-muted leading-relaxed mb-3">
              APEX OS Chat is your team&apos;s internal messaging system. Access it by clicking <strong className="text-foreground">Chat</strong> on the home screen or navigating to <Code>/m/chat</Code>.
            </p>
            <p className="text-sm text-muted leading-relaxed mb-3">
              The chat interface has three main areas:
            </p>
            <ul className="text-sm text-muted space-y-2 ml-4">
              <li className="flex items-start gap-2"><span className="text-accent mt-1">1.</span> <strong className="text-foreground">Sidebar</strong> — your channels, DMs, and starred conversations</li>
              <li className="flex items-start gap-2"><span className="text-accent mt-1">2.</span> <strong className="text-foreground">Message Area</strong> — the main conversation view with compose box</li>
              <li className="flex items-start gap-2"><span className="text-accent mt-1">3.</span> <strong className="text-foreground">Right Panel</strong> — threads, members, pins (opens when needed)</li>
            </ul>
            <Tip>Use <Code>Ctrl+K</Code> to quickly jump to any channel or DM without scrolling the sidebar.</Tip>
          </section>

          {/* Channels */}
          <section id="channels" className="mb-12">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Hash className="w-5 h-5 text-accent" /> Channels
            </h2>
            <p className="text-sm text-muted leading-relaxed mb-4">
              Channels are shared spaces for team conversations. They can be organized by project, team, topic, or anything else.
            </p>

            <h3 className="text-sm font-semibold text-foreground mb-2">Channel Types</h3>
            <div className="grid gap-3 mb-4">
              {[
                { icon: Hash, name: "Public", desc: "Visible to everyone. Any team member can join and participate." },
                { icon: Lock, name: "Private", desc: "Invite-only. Hidden from non-members. Great for sensitive topics." },
                { icon: Megaphone, name: "Announcement", desc: "Only admins can post. Others can react and reply in threads." },
              ].map((t) => (
                <div key={t.name} className="flex items-start gap-3 bg-surface border border-border rounded-lg px-4 py-3">
                  <t.icon className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{t.name}</p>
                    <p className="text-xs text-muted">{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-sm font-semibold text-foreground mb-2">Creating a Channel</h3>
            <p className="text-sm text-muted mb-2">Click the <strong className="text-foreground">+</strong> button next to &quot;Channels&quot; in the sidebar. Choose a name, description, type, and invite members.</p>
            <Tip>Channel names use lowercase and hyphens: <Code>#sales-team</Code>, <Code>#project-alpha</Code></Tip>
          </section>

          {/* Direct Messages */}
          <section id="direct-messages" className="mb-12">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-accent" /> Direct Messages
            </h2>
            <p className="text-sm text-muted leading-relaxed mb-3">
              DMs are private 1-on-1 conversations. In APEX OS, DMs follow a specific rule:
            </p>
            <div className="bg-accent/5 border border-accent/20 rounded-lg px-4 py-3 mb-4">
              <p className="text-sm text-foreground font-medium mb-1">Admin DM Rule</p>
              <ul className="text-xs text-muted space-y-1">
                <li>Any user can start a DM with any <strong className="text-accent">admin</strong></li>
                <li>Any admin can start a DM with <strong className="text-accent">any user</strong></li>
                <li>Non-admin users <strong className="text-foreground">cannot</strong> DM other non-admin users</li>
              </ul>
            </div>
            <p className="text-sm text-muted">
              To start a DM, click <strong className="text-foreground">+ New DM</strong> in the sidebar. The user picker will show available contacts based on your role.
            </p>
            <Tip>Use the &quot;Note to self&quot; DM as a personal scratchpad for links, drafts, and ideas.</Tip>
          </section>

          {/* Sending Messages */}
          <section id="sending-messages" className="mb-12">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Send className="w-5 h-5 text-accent" /> Sending Messages
            </h2>
            <p className="text-sm text-muted leading-relaxed mb-3">
              Type your message in the compose box at the bottom and press <Code>Enter</Code> to send. Use <Code>Shift+Enter</Code> for a new line.
            </p>

            <h3 className="text-sm font-semibold text-foreground mb-2">@Mentions</h3>
            <ul className="text-sm text-muted space-y-1.5 ml-4 mb-3">
              <li><Code>@username</Code> — notify a specific person</li>
              <li><Code>@channel</Code> — notify everyone in the channel (online + offline)</li>
              <li><Code>@here</Code> — notify only currently online members</li>
            </ul>
            <p className="text-xs text-muted mb-3">Type <Code>@</Code> to see an autocomplete dropdown of users.</p>

            <h3 className="text-sm font-semibold text-foreground mb-2">Silent Send</h3>
            <p className="text-sm text-muted">
              Hold <Code>Alt</Code> + <Code>Enter</Code> to send silently — the message arrives with no notification sound. Perfect for after-hours messages.
            </p>
          </section>

          {/* Formatting */}
          <section id="formatting" className="mb-12">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-accent" /> Text Formatting
            </h2>
            <p className="text-sm text-muted mb-4">Use the toolbar or markdown shortcuts to format your messages.</p>

            <Example input="**bold text**" output="<strong>bold text</strong>" />
            <Example input="*italic text*" output="<em>italic text</em>" />
            <Example input="~~strikethrough~~" output="<del>strikethrough</del>" />
            <Example input="`inline code`" output='<code style="background:#1a1a2e;padding:2px 6px;border-radius:4px;font-size:12px">inline code</code>' />
            <Example input="> blockquote" output='<span style="border-left:2px solid #B8860B;padding-left:8px;color:#a3a3a3">blockquote</span>' />
            <Example input="- list item" output="&bull; list item" />

            <h3 className="text-sm font-semibold text-foreground mb-2 mt-4">Code Blocks</h3>
            <CodeBlock>{`\`\`\`javascript
function hello() {
  console.log("Hello APEX!");
}
\`\`\``}</CodeBlock>
            <Tip>Use <Code>Ctrl+B</Code> for bold, <Code>Ctrl+I</Code> for italic, <Code>Ctrl+Shift+X</Code> for strikethrough.</Tip>
          </section>

          {/* Threads */}
          <section id="threads" className="mb-12">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <ChevronRight className="w-5 h-5 text-accent" /> Threads
            </h2>
            <p className="text-sm text-muted leading-relaxed mb-3">
              Threads keep conversations organized. Instead of replying in the main channel, reply in a thread to keep the discussion focused.
            </p>
            <ul className="text-sm text-muted space-y-2 ml-4">
              <li><strong className="text-foreground">Start a thread:</strong> hover over a message and click the reply icon</li>
              <li><strong className="text-foreground">Also send to channel:</strong> toggle this to post a summary back to the main channel</li>
              <li><strong className="text-foreground">Follow/unfollow:</strong> you auto-follow threads you reply in. Unfollow to stop notifications.</li>
              <li><strong className="text-foreground">Threads view:</strong> see all threads you follow across all channels from the sidebar</li>
            </ul>
            <Tip>Threads auto-archive after 7 days of inactivity but remain searchable and reopenable.</Tip>
          </section>

          {/* Reactions */}
          <section id="reactions" className="mb-12">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Smile className="w-5 h-5 text-accent" /> Reactions
            </h2>
            <p className="text-sm text-muted leading-relaxed mb-3">
              React to any message with emoji. Hover over a message to see the quick-react bar (your 5 most-used emoji), or click the smiley face for the full picker.
            </p>
            <ul className="text-sm text-muted space-y-1.5 ml-4">
              <li>Multiple people can add the same reaction (count increments)</li>
              <li>Hover a reaction pill to see who reacted</li>
              <li>Click your own reaction again to remove it</li>
              <li>Type <Code>:emoji_name:</Code> in the compose box for inline emoji</li>
            </ul>
          </section>

          {/* Message Actions */}
          <section id="message-actions" className="mb-12">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent" /> Message Actions
            </h2>
            <p className="text-sm text-muted mb-4">Hover over any message to see the action toolbar. Right-click for the full menu.</p>

            <div className="grid gap-2">
              {[
                { icon: ChevronRight, name: "Reply in thread", desc: "Open a threaded conversation" },
                { icon: Smile, name: "React", desc: "Add an emoji reaction" },
                { icon: Edit3, name: "Edit", desc: "Edit your own message (within 2 minutes)" },
                { icon: Trash2, name: "Delete", desc: "Delete your message (admins can delete any)" },
                { icon: Pin, name: "Pin", desc: "Pin to channel for easy reference" },
                { icon: Bookmark, name: "Save", desc: "Bookmark to your personal Saved Items" },
                { icon: Copy, name: "Copy text", desc: "Copy the message content to clipboard" },
                { icon: Forward, name: "Forward", desc: "Share to another channel or DM" },
                { icon: Eye, name: "Mark unread", desc: "Mark as unread from this message" },
                { icon: Clock, name: "Remind me", desc: "Set a reminder (20 min, 1h, 3h, tomorrow, next week)" },
              ].map((a) => (
                <div key={a.name} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-hover transition-colors">
                  <a.icon className="w-4 h-4 text-accent flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground">{a.name}</span>
                    <span className="text-xs text-muted ml-2">{a.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-3 mt-4">
              <p className="text-sm text-foreground font-medium mb-1">2-Minute Edit Window</p>
              <p className="text-xs text-muted">You can only edit your messages within 2 minutes of sending. After that, the edit button disappears. Admins can edit anytime.</p>
            </div>
          </section>

          {/* Pins & Saved */}
          <section id="pins-saved" className="mb-12">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Pin className="w-5 h-5 text-accent" /> Pins & Saved Items
            </h2>

            <h3 className="text-sm font-semibold text-foreground mb-2">Pinned Messages</h3>
            <p className="text-sm text-muted mb-3">
              Pin important messages to make them easy to find. Click the pin icon in the channel header to see all pins. Max 100 pins per channel.
            </p>

            <h3 className="text-sm font-semibold text-foreground mb-2">Saved Items</h3>
            <p className="text-sm text-muted mb-3">
              Save/bookmark any message to your personal collection. Access saved items from the sidebar. Only you can see your saved items.
            </p>
            <Tip>Pin messages for the whole channel. Save messages for just yourself.</Tip>
          </section>

          {/* Search */}
          <section id="search" className="mb-12">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Search className="w-5 h-5 text-accent" /> Search
            </h2>
            <p className="text-sm text-muted mb-4">Search across all channels you have access to. Use filters to narrow results.</p>

            <h3 className="text-sm font-semibold text-foreground mb-2">Search Filters</h3>
            <div className="space-y-1.5 mb-3">
              {[
                { filter: "in:#channel-name", desc: "Search within a specific channel" },
                { filter: "from:@username", desc: "Messages from a specific person" },
                { filter: "has:file", desc: "Messages with file attachments" },
                { filter: "has:link", desc: "Messages containing URLs" },
                { filter: "has:pin", desc: "Pinned messages only" },
                { filter: "before:2026-03-15", desc: "Messages before a date" },
                { filter: "after:2026-03-01", desc: "Messages after a date" },
              ].map((f) => (
                <div key={f.filter} className="flex items-center gap-3 text-sm">
                  <Code>{f.filter}</Code>
                  <span className="text-muted">{f.desc}</span>
                </div>
              ))}
            </div>
            <Tip>Press <Code>Ctrl+F</Code> to search in the current channel, or <Code>Ctrl+Shift+F</Code> for global search.</Tip>
          </section>

          {/* Notifications */}
          <section id="notifications" className="mb-12">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Bell className="w-5 h-5 text-accent" /> Notifications
            </h2>
            <p className="text-sm text-muted mb-3">Control how you get notified per channel.</p>

            <h3 className="text-sm font-semibold text-foreground mb-2">Per-Channel Settings</h3>
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-3 bg-surface border border-border rounded-lg px-4 py-2.5">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <div>
                  <p className="text-sm font-medium text-foreground">All Messages</p>
                  <p className="text-xs text-muted">Get notified for every new message in this channel</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-surface border border-border rounded-lg px-4 py-2.5">
                <div className="w-2 h-2 rounded-full bg-yellow-400" />
                <div>
                  <p className="text-sm font-medium text-foreground">Mentions Only</p>
                  <p className="text-xs text-muted">Only notified when someone @mentions you or uses your keyword alerts</p>
                </div>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-foreground mb-2">Keyword Alerts</h3>
            <p className="text-sm text-muted">
              Set custom keywords that trigger notifications when mentioned in any channel. Great for tracking project names, bug IDs, or topics you care about.
            </p>
          </section>

          {/* Presence */}
          <section id="presence" className="mb-12">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Eye className="w-5 h-5 text-accent" /> Presence & Status
            </h2>

            <h3 className="text-sm font-semibold text-foreground mb-2">Status Indicators</h3>
            <div className="flex gap-4 mb-4">
              {[
                { color: "bg-green-400", label: "Online" },
                { color: "bg-yellow-400", label: "Away" },
                { color: "bg-gray-500", label: "Offline" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2 text-sm text-muted">
                  <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                  {s.label}
                </div>
              ))}
            </div>

            <h3 className="text-sm font-semibold text-foreground mb-2">Custom Status</h3>
            <p className="text-sm text-muted mb-2">
              Set a custom status with emoji and text (e.g. &quot;In a meeting&quot;, &quot;WFH&quot;). Set an expiration so it clears automatically.
            </p>

            <h3 className="text-sm font-semibold text-foreground mb-2">Typing Indicators</h3>
            <p className="text-sm text-muted">
              See who&apos;s typing in real-time at the bottom of the message area.
            </p>
          </section>

          {/* Files */}
          <section id="files" className="mb-12">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Paperclip className="w-5 h-5 text-accent" /> Files & Media
            </h2>
            <ul className="text-sm text-muted space-y-2 ml-4">
              <li><strong className="text-foreground">Upload:</strong> drag-and-drop, click the attach button, or paste from clipboard</li>
              <li><strong className="text-foreground">Images:</strong> show inline preview — click to expand in lightbox</li>
              <li><strong className="text-foreground">Videos:</strong> inline player with thumbnail</li>
              <li><strong className="text-foreground">Audio:</strong> inline waveform player with speed control</li>
              <li><strong className="text-foreground">PDFs:</strong> inline preview with download</li>
              <li><strong className="text-foreground">Code files:</strong> syntax-highlighted preview</li>
              <li><strong className="text-foreground">GIFs:</strong> search and send via the GIF picker</li>
            </ul>
            <Tip>The Files tab in each channel shows all files shared there, filterable by type, date, and uploader.</Tip>
          </section>

          {/* Keyboard Shortcuts */}
          <section id="shortcuts" className="mb-12">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-accent" /> Keyboard Shortcuts
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-xs text-muted font-medium">Shortcut</th>
                    <th className="text-left py-2 text-xs text-muted font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <ShortcutRow keys="Enter" desc="Send message" />
                  <ShortcutRow keys="Shift + Enter" desc="New line" />
                  <ShortcutRow keys="Alt + Enter" desc="Silent send (no notification)" />
                  <ShortcutRow keys="Up Arrow" desc="Edit last message (if within 2 min)" />
                  <ShortcutRow keys="Ctrl + K" desc="Quick switcher (search channels/DMs)" />
                  <ShortcutRow keys="Ctrl + F" desc="Search in current channel" />
                  <ShortcutRow keys="Ctrl + Shift + F" desc="Global search" />
                  <ShortcutRow keys="Ctrl + B" desc="Bold text" />
                  <ShortcutRow keys="Ctrl + I" desc="Italic text" />
                  <ShortcutRow keys="Ctrl + Shift + X" desc="Strikethrough" />
                  <ShortcutRow keys="Ctrl + Shift + C" desc="Code block" />
                  <ShortcutRow keys="Escape" desc="Close panel / cancel edit" />
                  <ShortcutRow keys="Alt + Up/Down" desc="Navigate channels" />
                  <ShortcutRow keys="Alt + Shift + Up/Down" desc="Next unread channel" />
                  <ShortcutRow keys="Ctrl + /" desc="Show all shortcuts" />
                </tbody>
              </table>
            </div>
          </section>

          {/* Tips & Tricks */}
          <section id="tips" className="mb-12">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-accent" /> Tips & Tricks
            </h2>

            <div className="space-y-4">
              <div className="bg-surface border border-border rounded-lg px-4 py-3">
                <p className="text-sm font-medium text-foreground mb-1">Draft Auto-Save</p>
                <p className="text-xs text-muted">Your unsent messages are automatically saved as drafts. Switch channels and come back — your draft will be there. Look for the pencil icon in the sidebar.</p>
              </div>
              <div className="bg-surface border border-border rounded-lg px-4 py-3">
                <p className="text-sm font-medium text-foreground mb-1">Role-Based Name Colors</p>
                <p className="text-xs text-muted">Message author names are colored by role: <span className="text-[#B8860B]">Admin (gold)</span>, <span className="text-blue-400">Manager (blue)</span>, <span className="text-green-400">Sales (green)</span>, <span className="text-gray-400">Intern (gray)</span>. You can tell someone&apos;s role at a glance.</p>
              </div>
              <div className="bg-surface border border-border rounded-lg px-4 py-3">
                <p className="text-sm font-medium text-foreground mb-1">Create Tasks from Messages</p>
                <p className="text-xs text-muted">Right-click any message → &quot;Create task&quot; to turn it into a task with assignee and due date. Great for action items that come up in chat.</p>
              </div>
              <div className="bg-surface border border-border rounded-lg px-4 py-3">
                <p className="text-sm font-medium text-foreground mb-1">Link Previews</p>
                <p className="text-xs text-muted">Paste a URL and it automatically unfurls with a rich preview (title, description, image). YouTube links get an inline player. Dismiss previews by clicking the X.</p>
              </div>
              <div className="bg-surface border border-border rounded-lg px-4 py-3">
                <p className="text-sm font-medium text-foreground mb-1">Channel Bookmarks Bar</p>
                <p className="text-xs text-muted">Pin important links and documents to the top of any channel. Great for project resources, meeting links, or documentation.</p>
              </div>
            </div>
          </section>

          <div className="text-center py-8 border-t border-border">
            <p className="text-xs text-muted">Need help? Ask in <Code>#general</Code> or DM an admin.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
