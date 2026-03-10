"use client";

import { useEffect, useState } from "react";
import { Mail, Search, CheckCircle, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

interface SentInvoice {
  id: string;
  opportunity_id: string;
  invoice_number: string;
  recipient_email: string;
  recipient_name: string | null;
  amount: number;
  template_slug: string;
  resend_message_id: string | null;
  status: string;
  sent_at: string;
}

export default function SentInvoicesPage() {
  const [invoices, setInvoices] = useState<SentInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch("/api/automations/email/sent-invoices");
        const data = await res.json();
        if (!data.error) setInvoices(data.invoices || []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = invoices.filter((inv) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.recipient_email?.toLowerCase().includes(q) ||
      inv.recipient_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex-shrink-0 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Sent Invoices</h1>
            <p className="text-muted text-xs mt-0.5">
              Invoice emails sent via Automations — {invoices.length} total
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 flex items-center gap-3 flex-shrink-0 border-b border-border/50 bg-surface/50">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            type="text"
            placeholder="Search by invoice #, email, name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent placeholder:text-muted/50"
          />
        </div>
        <span className="text-xs text-muted ml-auto">
          Showing {filtered.length} of {invoices.length}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted text-sm gap-2">
            <Mail className="w-8 h-8 opacity-30" />
            {invoices.length === 0
              ? "No invoices sent yet. Send invoices from Sales Management."
              : "No results match your search."}
          </div>
        ) : (
          <table className="w-full border-collapse min-w-[900px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface border-b border-border/50">
                <th className="text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5 border-r border-border w-10">#</th>
                <th className="text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5 border-r border-border w-36">Invoice #</th>
                <th className="text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5 border-r border-border w-40">Recipient</th>
                <th className="text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5 border-r border-border w-48">Email</th>
                <th className="text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5 border-r border-border w-28">Amount</th>
                <th className="text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5 border-r border-border w-24">Status</th>
                <th className="text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5 w-40">Sent At</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv, idx) => (
                <tr key={inv.id} className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors">
                  <td className="px-3 py-2 text-xs text-muted border-r border-border">{idx + 1}</td>
                  <td className="px-3 py-2 text-xs text-accent font-medium border-r border-border">{inv.invoice_number}</td>
                  <td className="px-3 py-2 text-xs text-foreground border-r border-border">{inv.recipient_name || "-"}</td>
                  <td className="px-3 py-2 text-xs text-foreground border-r border-border">{inv.recipient_email}</td>
                  <td className="px-3 py-2 text-xs text-foreground font-medium border-r border-border">
                    ₹{Number(inv.amount).toLocaleString("en-IN")}
                  </td>
                  <td className="px-3 py-2 text-xs border-r border-border">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      inv.status === "sent"
                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                    }`}>
                      {inv.status === "sent" ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {new Date(inv.sent_at).toLocaleString("en-IN", {
                      day: "2-digit", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
