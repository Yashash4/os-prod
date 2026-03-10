"use client";

import { useEffect, useState } from "react";
import { Send, Loader2, CheckCircle, AlertCircle } from "lucide-react";
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

  const selected = templates.find((t) => t.slug === selectedSlug);

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
        <div className="max-w-xl space-y-5">
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
                  <p className="text-[10px] text-muted mt-1 font-mono">
                    Subject: {selected.subject}
                  </p>
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
      </div>
    </div>
  );
}
