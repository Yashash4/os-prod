"use client";

import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Quote,
  List,
  ListOrdered,
} from "lucide-react";

interface FormatToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  draft: string;
  setDraft: (val: string) => void;
}

type FormatAction = {
  icon: React.ReactNode;
  title: string;
  prefix: string;
  suffix: string;
  block?: boolean;
};

const FORMAT_ACTIONS: FormatAction[] = [
  { icon: <Bold className="w-3.5 h-3.5" />, title: "Bold (Ctrl+B)", prefix: "**", suffix: "**" },
  { icon: <Italic className="w-3.5 h-3.5" />, title: "Italic (Ctrl+I)", prefix: "*", suffix: "*" },
  { icon: <Strikethrough className="w-3.5 h-3.5" />, title: "Strikethrough (Ctrl+Shift+X)", prefix: "~~", suffix: "~~" },
  { icon: <Code className="w-3.5 h-3.5" />, title: "Inline Code", prefix: "`", suffix: "`" },
  { icon: <span className="text-[10px] font-mono font-bold">{"{ }"}</span>, title: "Code Block", prefix: "```\n", suffix: "\n```", block: true },
  { icon: <Quote className="w-3.5 h-3.5" />, title: "Blockquote", prefix: "> ", suffix: "", block: true },
  { icon: <List className="w-3.5 h-3.5" />, title: "Bullet List", prefix: "- ", suffix: "", block: true },
  { icon: <ListOrdered className="w-3.5 h-3.5" />, title: "Ordered List", prefix: "1. ", suffix: "", block: true },
];

export default function FormatToolbar({ textareaRef, draft, setDraft }: FormatToolbarProps) {
  const applyFormat = (action: FormatAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = draft.slice(start, end);

    let newText: string;
    let newCursorPos: number;

    if (action.block && !selected) {
      // For block-level formatting without selection, add on new line
      const beforeCursor = draft.slice(0, start);
      const needsNewline = beforeCursor.length > 0 && !beforeCursor.endsWith("\n");
      const prefix = (needsNewline ? "\n" : "") + action.prefix;
      newText = draft.slice(0, start) + prefix + action.suffix + draft.slice(end);
      newCursorPos = start + prefix.length;
    } else if (selected) {
      newText = draft.slice(0, start) + action.prefix + selected + action.suffix + draft.slice(end);
      newCursorPos = start + action.prefix.length + selected.length + action.suffix.length;
    } else {
      newText = draft.slice(0, start) + action.prefix + action.suffix + draft.slice(end);
      newCursorPos = start + action.prefix.length;
    }

    setDraft(newText);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = newCursorPos;
      textarea.selectionEnd = newCursorPos;
    });
  };

  return (
    <div className="flex items-center gap-0.5 px-3 py-1 border-b border-border bg-surface/50">
      {FORMAT_ACTIONS.map((action, idx) => (
        <button
          key={idx}
          onClick={() => applyFormat(action)}
          title={action.title}
          className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
        >
          {action.icon}
        </button>
      ))}
    </div>
  );
}
