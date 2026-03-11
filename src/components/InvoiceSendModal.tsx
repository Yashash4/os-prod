"use client";

import { useState } from "react";
import { X, Send, Check, Loader2, FileText } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

interface InvoiceSendModalProps {
  open: boolean;
  onClose: () => void;
  customerName: string;
  customerEmail: string;
  amount: number;
  opportunityId: string;
  salesSource: "maverick" | "jobin";
  onSuccess: (data: { invoice_number: string }) => void;
}

export default function InvoiceSendModal({
  open,
  onClose,
  customerName,
  customerEmail,
  amount,
  opportunityId,
  salesSource,
  onSuccess,
}: InvoiceSendModalProps) {
  const [name, setName] = useState(customerName || "");
  const [email, setEmail] = useState(customerEmail || "");
  const [amountVal, setAmountVal] = useState(amount ? String(amount) : "");
  const [description, setDescription] = useState("Professional services — Apex Fashion Lab");

  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  if (!open) return null;

  const canSend = parseFloat(amountVal) > 0 && email.trim();

  async function handleSend() {
    if (!canSend) return;
    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await apiFetch("/api/automations/email/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunity_id: opportunityId,
          recipient_email: email.trim(),
          recipient_name: name.trim(),
          amount: parseFloat(amountVal),
          description: description.trim(),
          sales_source: salesSource,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setInvoiceNumber(data.invoice_number);
      setStatus("success");
      onSuccess({ invoice_number: data.invoice_number });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to send invoice");
      setStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={status === "sending" ? undefined : onClose} />
      <div className="relative w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#B8860B]" />
            <h2 className="text-sm font-semibold text-foreground">Send Invoice</h2>
          </div>
          <button onClick={onClose} disabled={status === "sending"} className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {status === "success" ? (
          /* Success View */
          <div className="p-5 space-y-4">
            <div className="text-center py-2">
              <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check className="w-5 h-5 text-green-400" />
              </div>
              <p className="text-sm font-medium text-foreground">Invoice Sent!</p>
              <p className="text-xs text-muted mt-1">
                Email sent to {name || email}
              </p>
            </div>

            <div className="bg-background rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted uppercase tracking-wider mb-1.5">Invoice Number</p>
              <p className="text-lg font-bold text-[#B8860B]">{invoiceNumber}</p>
              <p className="text-[10px] text-muted mt-2">Amount: ₹{parseFloat(amountVal).toLocaleString("en-IN")}</p>
            </div>

            <button onClick={onClose} className="w-full py-2 text-xs font-medium text-foreground bg-surface-hover hover:bg-border/50 rounded-lg transition-colors">
              Done
            </button>
          </div>
        ) : (
          /* Form View */
          <div className="p-5 space-y-3">
            {/* Customer Name */}
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Customer Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-[#B8860B] placeholder:text-muted/50"
                placeholder="Enter name" />
            </div>

            {/* Email */}
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Email *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-[#B8860B] placeholder:text-muted/50"
                placeholder="customer@email.com" />
            </div>

            {/* Amount */}
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Amount (₹) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted">₹</span>
                <input type="number" value={amountVal} onChange={(e) => setAmountVal(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg pl-7 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-[#B8860B] placeholder:text-muted/50"
                  placeholder="0" min="1" />
              </div>
              {parseFloat(amountVal) > 0 && (
                <p className="text-[10px] text-muted mt-0.5">Invoice for ₹{parseFloat(amountVal).toLocaleString("en-IN")}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Description</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-[#B8860B] placeholder:text-muted/50"
                placeholder="Service description" />
            </div>

            {/* Error Message */}
            {status === "error" && (
              <div className="text-xs text-red-400 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                {errorMsg}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center gap-2 pt-1">
              <button onClick={onClose} disabled={status === "sending"}
                className="flex-1 py-2 text-xs font-medium text-muted hover:text-foreground bg-surface-hover hover:bg-border/50 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handleSend} disabled={!canSend || status === "sending"}
                className="flex-1 py-2 text-xs font-medium text-white bg-[#B8860B] hover:bg-[#9A7209] rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                {status === "sending" ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="w-3.5 h-3.5" /> Send Invoice</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
