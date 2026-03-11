"use client";

import { useEffect, useState, useRef } from "react";
import { Save, Eye, EyeOff, Mail, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

interface EmailTemplate {
  id: string;
  slug: string;
  name: string;
  subject: string;
  html_body: string;
  variables: string[];
  is_active: boolean;
  updated_at: string;
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EmailTemplate | null>(null);
  const [editName, setEditName] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editHtml, setEditHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch("/api/automations/email/templates");
        const data = await res.json();
        if (!data.error) {
          setTemplates(data.templates || []);
          if (data.templates?.length > 0) selectTemplate(data.templates[0]);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function selectTemplate(t: EmailTemplate) {
    setSelected(t);
    setEditName(t.name);
    setEditSubject(t.subject);
    setEditHtml(t.html_body);
    setSaveMsg("");
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await apiFetch("/api/automations/email/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          name: editName,
          subject: editSubject,
          html_body: editHtml,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTemplates((prev) =>
        prev.map((t) => (t.id === selected.id ? { ...t, name: editName, subject: editSubject, html_body: editHtml } : t))
      );
      setSaveMsg("Saved!");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // Sample variables for preview
  const sampleVars: Record<string, string> = {
    customer_name: "John Doe",
    amount: "25,000",
    invoice_number: "AFL-INV-0042",
    date: "10 Mar 2026",
    description: "Professional services — Apex Fashion Lab",
  };

  function getPreviewHtml() {
    let html = editHtml;
    for (const [key, val] of Object.entries(sampleVars)) {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
    }
    return html;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex-shrink-0 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Email Templates</h1>
            <p className="text-muted text-xs mt-0.5">Manage invoice and notification email templates</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Template List */}
        <div className="w-56 border-r border-border bg-surface/50 flex-shrink-0 overflow-y-auto p-3">
          <p className="text-[10px] text-muted uppercase tracking-wider px-2 mb-2">Templates</p>
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTemplate(t)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mb-1 flex items-center gap-2 ${
                selected?.id === t.id
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{t.name}</span>
            </button>
          ))}
        </div>

        {/* Editor */}
        {selected ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="px-6 py-3 flex items-center gap-3 border-b border-border/50">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-background text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </button>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs text-muted hover:text-foreground rounded-lg transition-colors"
              >
                {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPreview ? "Hide Preview" : "Preview"}
              </button>
              {saveMsg && (
                <span className={`text-xs ${saveMsg === "Saved!" ? "text-green-400" : "text-red-400"}`}>
                  {saveMsg}
                </span>
              )}
              <span className="text-[10px] text-muted ml-auto">
                Slug: {selected.slug}
              </span>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-[11px] text-muted uppercase tracking-wider mb-1">Template Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full max-w-md bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-[11px] text-muted uppercase tracking-wider mb-1">Subject Line</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full max-w-lg bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              {/* Variables */}
              <div>
                <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">Variables</label>
                <div className="flex flex-wrap gap-1.5">
                  {(selected.variables || []).map((v) => (
                    <span key={v} className="inline-flex items-center px-2 py-0.5 bg-accent/10 text-accent text-[11px] rounded-md border border-accent/20 font-mono">
                      {"{{"}
                      {v}
                      {"}}"}
                    </span>
                  ))}
                </div>
              </div>

              {/* HTML Body */}
              <div>
                <label className="block text-[11px] text-muted uppercase tracking-wider mb-1">HTML Body</label>
                <textarea
                  value={editHtml}
                  onChange={(e) => setEditHtml(e.target.value)}
                  rows={20}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:border-accent resize-y leading-relaxed"
                />
              </div>

              {/* Preview */}
              {showPreview && (
                <div>
                  <label className="block text-[11px] text-muted uppercase tracking-wider mb-1">Live Preview</label>
                  <div className="border border-border rounded-lg overflow-hidden bg-white">
                    <iframe
                      ref={iframeRef}
                      srcDoc={getPreviewHtml()}
                      className="w-full h-[600px]"
                      sandbox=""
                      title="Email Preview"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted text-sm">
            Select a template to edit
          </div>
        )}
      </div>
    </div>
  );
}
