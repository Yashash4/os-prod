"use client";

import { useEffect, useState, useMemo } from "react";
import { Send, Loader2, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

interface EmailTemplate {
  id: string;
  slug: string;
  name: string;
  subject: string;
  html_body: string;
  variables: string[];
}

export default function ComposePage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [salesSource, setSalesSource] = useState<"maverick" | "jobin">("maverick");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [result, setResult] = useState<{ invoice_number?: string; error?: string }>({});

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch("/api/automations/email/templates");
        const data = await res.json();
        if (!data.error) {
          setTemplates(data.templates || []);
          if (data.templates?.length > 0) setSelectedSlug(data.templates[0].slug);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSend() {
    if (!recipientEmail || !amount || !opportunityId) {
      setStatus("error");
      setResult({ error: "Email, amount, and opportunity ID are required" });
      return;
    }
    setStatus("sending");
    setResult({});
    try {
      const res = await apiFetch("/api/automations/email/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunity_id: opportunityId,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          amount: parseFloat(amount),
          description: description || undefined,
          sales_source: salesSource,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setStatus("error");
        setResult({ error: data.error, invoice_number: data.invoice_number });
      } else {
        setStatus("success");
        setResult({ invoice_number: data.invoice_number });
      }
    } catch (err) {
      setStatus("error");
      setResult({ error: err instanceof Error ? err.message : "Failed to send" });
    }
  }

  function resetForm() {
    setRecipientEmail("");
    setRecipientName("");
    setAmount("");
    setDescription("");
    setOpportunityId("");
    setStatus("idle");
    setResult({});
  }

  const [showPreview, setShowPreview] = useState(true);
  const selected = templates.find((t) => t.slug === selectedSlug);

  // Build live preview by replacing template variables with form values
  const previewHtml = useMemo(() => {
    if (!selected?.html_body) return "";
    const vars: Record<string, string> = {
      recipient_name: recipientName || "John Doe",
      customer_name: recipientName || "John Doe",
      name: recipientName || "John Doe",
      email: recipientEmail || "john@example.com",
      recipient_email: recipientEmail || "john@example.com",
      amount: amount ? `₹${Number(amount).toLocaleString("en-IN")}` : "₹25,000",
      description: description || "Professional services",
      opportunity_id: opportunityId || "opp_abc123",
      sales_source: salesSource,
      invoice_number: "INV-PREVIEW-001",
      date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
      company_name: "Apex Fashion Lab",
    };
    let html = selected.html_body;
    // Replace {{var}}, {{ var }}, {var} patterns
    for (const [key, val] of Object.entries(vars)) {
      html = html.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi"), val);
      html = html.replace(new RegExp(`\\{${key}\\}`, "gi"), val);
    }
    return html;
  }, [selected, recipientName, recipientEmail, amount, description, opportunityId, salesSource]);

  // Preview subject line with variables replaced
  const previewSubject = useMemo(() => {
    if (!selected?.subject) return "";
    let subj = selected.subject;
    const vars: Record<string, string> = {
      recipient_name: recipientName || "John Doe",
      customer_name: recipientName || "John Doe",
      amount: amount ? `₹${Number(amount).toLocaleString("en-IN")}` : "₹25,000",
      invoice_number: "INV-PREVIEW-001",
      company_name: "Apex Fashion Lab",
    };
    for (const [key, val] of Object.entries(vars)) {
      subj = subj.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi"), val);
      subj = subj.replace(new RegExp(`\\{${key}\\}`, "gi"), val);
    }
    return subj;
  }, [selected, recipientName, amount]);

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
            <h1 className="text-xl font-bold text-foreground tracking-tight">Compose Invoice Email</h1>
            <p className="text-muted text-xs mt-0.5">Send a branded invoice email to a customer</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className={`${showPreview && selected ? "flex gap-6" : ""}`}>
        <div className={`space-y-5 ${showPreview && selected ? "w-1/2 shrink-0" : "max-w-xl"}`}>
          {status === "success" ? (
            <div className="text-center py-12 space-y-4">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
              <div>
                <p className="text-foreground font-medium">Invoice Sent!</p>
                <p className="text-accent text-lg font-bold mt-1">{result.invoice_number}</p>
                <p className="text-muted text-xs mt-2">Email delivered to {recipientEmail}</p>
              </div>
              <button
                onClick={resetForm}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-border text-sm text-muted hover:text-foreground rounded-lg transition-colors"
              >
                Send Another
              </button>
            </div>
          ) : (
            <>
              {/* Template selector */}
              <div>
                <label className="block text-[11px] text-muted uppercase tracking-wider mb-1">Template</label>
                <select
                  value={selectedSlug}
                  onChange={(e) => setSelectedSlug(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent [&>option]:bg-surface"
                >
                  {templates.map((t) => (
                    <option key={t.slug} value={t.slug}>{t.name}</option>
                  ))}
                </select>
                {selected && (
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] text-muted font-mono">
                      Subject: {selected.subject}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowPreview(!showPreview)}
                      className="flex items-center gap-1 text-[10px] text-accent hover:text-accent/80 transition-colors"
                    >
                      {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {showPreview ? "Hide Preview" : "Show Preview"}
                    </button>
                  </div>
                )}
                {selected?.variables && selected.variables.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {selected.variables.map((v) => (
                      <span key={v} className="text-[9px] font-mono bg-accent/10 text-accent px-1.5 py-0.5 rounded">
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-muted uppercase tracking-wider mb-1">Recipient Name</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent placeholder:text-muted/40"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-muted uppercase tracking-wider mb-1">Recipient Email *</label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent placeholder:text-muted/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-muted uppercase tracking-wider mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="25000"
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent placeholder:text-muted/40"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-muted uppercase tracking-wider mb-1">Opportunity ID *</label>
                  <input
                    type="text"
                    value={opportunityId}
                    onChange={(e) => setOpportunityId(e.target.value)}
                    placeholder="opp_abc123"
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent font-mono placeholder:text-muted/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-muted uppercase tracking-wider mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Professional services — Apex Fashion Lab"
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent placeholder:text-muted/40"
                />
              </div>

              <div>
                <label className="block text-[11px] text-muted uppercase tracking-wider mb-1">Sales Source</label>
                <select
                  value={salesSource}
                  onChange={(e) => setSalesSource(e.target.value as "maverick" | "jobin")}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent [&>option]:bg-surface"
                >
                  <option value="maverick">Maverick</option>
                  <option value="jobin">Jobin</option>
                </select>
              </div>

              {status === "error" && (
                <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {result.error}
                </div>
              )}

              <button
                onClick={handleSend}
                disabled={status === "sending"}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-background text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {status === "sending" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send Invoice
              </button>
            </>
          )}
        </div>

        {/* Live Template Preview */}
        {showPreview && selected && status !== "success" && (
          <div className="flex-1 min-w-0">
            <div className="border border-border rounded-xl overflow-hidden bg-white sticky top-0">
              {/* Preview header */}
              <div className="bg-surface px-4 py-2.5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-muted" />
                  <span className="text-xs font-medium text-foreground">Live Preview</span>
                </div>
                <span className="text-[10px] text-muted">Updates as you type</span>
              </div>
              {/* Subject line */}
              <div className="bg-surface/50 px-4 py-2 border-b border-border/50">
                <p className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Subject</p>
                <p className="text-xs text-foreground font-medium">{previewSubject}</p>
              </div>
              {/* HTML body */}
              <div className="max-h-[60vh] overflow-auto">
                {previewHtml ? (
                  <iframe
                    srcDoc={previewHtml}
                    title="Email Preview"
                    className="w-full border-0"
                    style={{ minHeight: "400px", height: "60vh" }}
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <div className="p-8 text-center text-muted text-sm">
                    <p>No template body available for preview.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
