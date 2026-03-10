"use client";

import { useEffect, useState, useRef } from "react";
import {
  Save, Eye, EyeOff, Mail, Loader2, Plus, Trash2, X,
} from "lucide-react";
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

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EmailTemplate | null>(null);
  const [editName, setEditName] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editHtml, setEditHtml] = useState("");
  const [editVars, setEditVars] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Create form
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newHtml, setNewHtml] = useState("");
  const [newVars, setNewVars] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const res = await apiFetch("/api/automations/email/templates");
      const data = await res.json();
      if (!data.error) {
        setTemplates(data.templates || []);
        if (!selected && data.templates?.length > 0) selectTemplate(data.templates[0]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  function selectTemplate(t: EmailTemplate) {
    setSelected(t);
    setEditName(t.name);
    setEditSubject(t.subject);
    setEditHtml(t.html_body);
    setEditVars((t.variables || []).join(", "));
    setSaveMsg("");
    setShowCreate(false);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const variables = editVars.split(",").map((v) => v.trim()).filter(Boolean);
      const res = await apiFetch("/api/automations/email/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          name: editName,
          subject: editSubject,
          html_body: editHtml,
          variables,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === selected.id
            ? { ...t, name: editName, subject: editSubject, html_body: editHtml, variables }
            : t
        )
      );
      setSaveMsg("Saved!");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    if (!newSlug || !newName || !newSubject) {
      setCreateMsg("Slug, name, and subject are required");
      return;
    }
    setCreating(true);
    setCreateMsg("");
    try {
      const variables = newVars.split(",").map((v) => v.trim()).filter(Boolean);
      const res = await apiFetch("/api/automations/email/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: newSlug,
          name: newName,
          subject: newSubject,
          html_body: newHtml || "<p>Template body</p>",
          variables,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTemplates((prev) => [...prev, data.template]);
      selectTemplate(data.template);
      setShowCreate(false);
      resetCreateForm();
    } catch (err) {
      setCreateMsg(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    setDeleting(id);
    try {
      const res = await apiFetch(`/api/automations/email/templates?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      if (selected?.id === id) {
        const remaining = templates.filter((t) => t.id !== id);
        setSelected(remaining.length > 0 ? remaining[0] : null);
        if (remaining.length > 0) selectTemplate(remaining[0]);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(null);
    }
  }

  function resetCreateForm() {
    setNewSlug("");
    setNewName("");
    setNewSubject("");
    setNewHtml("");
    setNewVars("");
    setCreateMsg("");
  }

  // Sample variables for preview
  const sampleVars: Record<string, string> = {
    customer_name: "John Doe",
    amount: "25,000",
    invoice_number: "AFL-INV-0042",
    date: "11 Mar 2026",
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-accent rounded-full" />
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Email Templates</h1>
              <p className="text-muted text-xs mt-0.5">Create, edit, and manage email templates</p>
            </div>
          </div>
          <button
            onClick={() => { setShowCreate(true); setSelected(null); resetCreateForm(); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-background text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Template
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Template List */}
        <div className="w-56 border-r border-border bg-surface/50 flex-shrink-0 overflow-y-auto p-3">
          <p className="text-[10px] text-muted uppercase tracking-wider px-2 mb-2">
            Templates ({templates.length})
          </p>
          {templates.map((t) => (
            <div
              key={t.id}
              className={`group flex items-center gap-1 mb-1 rounded-lg transition-colors ${
                selected?.id === t.id && !showCreate
                  ? "bg-accent/10"
                  : "hover:bg-surface-hover"
              }`}
            >
              <button
                onClick={() => selectTemplate(t)}
                className={`flex-1 text-left px-3 py-2 text-sm flex items-center gap-2 truncate ${
                  selected?.id === t.id && !showCreate ? "text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{t.name}</span>
              </button>
              <button
                onClick={() => handleDelete(t.id)}
                disabled={deleting === t.id}
                className="p-1 mr-1 rounded text-muted/30 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                title="Delete template"
              >
                {deleting === t.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Create Form */}
        {showCreate ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-3 flex items-center gap-3 border-b border-border/50">
              <span className="text-sm font-medium text-foreground">New Template</span>
              <button
                onClick={() => { setShowCreate(false); if (templates.length > 0) selectTemplate(templates[0]); }}
                className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors ml-auto"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-muted uppercase tracking-wider mb-1">Slug (unique identifier)</label>
                  <input
                    type="text"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    placeholder="e.g. welcome-email"
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent font-mono placeholder:text-muted/40"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-muted uppercase tracking-wider mb-1">Template Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Welcome Email"
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent placeholder:text-muted/40"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-muted uppercase tracking-wider mb-1">Subject Line</label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder='e.g. Welcome to Apex Fashion Lab, {{customer_name}}!'
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent placeholder:text-muted/40"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted uppercase tracking-wider mb-1">
                  Variables <span className="normal-case text-muted/60">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={newVars}
                  onChange={(e) => setNewVars(e.target.value)}
                  placeholder="customer_name, amount, date"
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent font-mono placeholder:text-muted/40"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted uppercase tracking-wider mb-1">HTML Body</label>
                <textarea
                  value={newHtml}
                  onChange={(e) => setNewHtml(e.target.value)}
                  rows={16}
                  placeholder="<html>...</html>"
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:border-accent resize-y leading-relaxed placeholder:text-muted/40"
                />
              </div>
              {createMsg && (
                <p className="text-xs text-red-400">{createMsg}</p>
              )}
              <button
                onClick={handleCreate}
                disabled={creating}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-background text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Template
              </button>
            </div>
          </div>
        ) : selected ? (
          /* Editor */
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
              <span className="text-[10px] text-muted ml-auto font-mono">
                {selected.slug}
              </span>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-4">
              {/* Name & Subject */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-muted uppercase tracking-wider mb-1">Template Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-muted uppercase tracking-wider mb-1">Subject Line</label>
                  <input
                    type="text"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Variables */}
              <div>
                <label className="block text-[11px] text-muted uppercase tracking-wider mb-1">
                  Variables <span className="normal-case text-muted/60">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={editVars}
                  onChange={(e) => setEditVars(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent font-mono"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {editVars.split(",").map((v) => v.trim()).filter(Boolean).map((v) => (
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
                      sandbox="allow-same-origin"
                      title="Email Preview"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted text-sm">
            Select a template or create a new one
          </div>
        )}
      </div>
    </div>
  );
}
