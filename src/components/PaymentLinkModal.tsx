"use client";

import { useState } from "react";
import { X, Send, Copy, Check, Loader2, IndianRupee, ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

interface PaymentLinkModalProps {
  open: boolean;
  onClose: () => void;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  amount: number;
  opportunityId: string;
  onSuccess: (data: { id: string; short_url: string }) => void;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

export default function PaymentLinkModal({
  open,
  onClose,
  customerName,
  customerEmail,
  customerPhone,
  amount,
  onSuccess,
}: PaymentLinkModalProps) {
  const [name, setName] = useState(customerName || "");
  const [email, setEmail] = useState(customerEmail || "");
  const [phone, setPhone] = useState(customerPhone || "");
  const [amountVal, setAmountVal] = useState(amount ? String(amount) : "");
  const [description, setDescription] = useState("Payment for Apex Fashion Lab");
  const [notifySms, setNotifySms] = useState(!!customerPhone);
  const [notifyEmail, setNotifyEmail] = useState(!!customerEmail);
  const [expiryDays, setExpiryDays] = useState("7");

  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [resultLink, setResultLink] = useState("");
  const [resultId, setResultId] = useState("");
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const canSend =
    parseFloat(amountVal) > 0 &&
    (email || phone) &&
    description.trim() &&
    (notifySms || notifyEmail);

  async function handleSend() {
    if (!canSend) return;
    setStatus("sending");
    setErrorMsg("");

    try {
      const expireByUnix = expiryDays
        ? Math.floor(Date.now() / 1000) + parseInt(expiryDays) * 86400
        : undefined;

      const res = await apiFetch("/api/razorpay/payment-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amountVal),
          description,
          customerName: name,
          customerEmail: email || undefined,
          customerPhone: phone ? normalizePhone(phone) : undefined,
          notifySms,
          notifyEmail,
          expireByUnix,
        }),
      });

      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setResultLink(data.paymentLink.short_url);
      setResultId(data.paymentLink.id);
      setStatus("success");
      onSuccess({ id: data.paymentLink.id, short_url: data.paymentLink.short_url });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create payment link");
      setStatus("error");
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(resultLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={status === "sending" ? undefined : onClose} />
      <div className="relative w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Send Payment Link</h2>
          </div>
          <button onClick={onClose} disabled={status === "sending"} className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors">
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
              <p className="text-sm font-medium text-foreground">Payment Link Sent!</p>
              <p className="text-xs text-muted mt-1">
                {notifySms && phone ? "SMS" : ""}
                {notifySms && phone && notifyEmail && email ? " & " : ""}
                {notifyEmail && email ? "Email" : ""} notification sent to {name || "customer"}
              </p>
            </div>

            <div className="bg-background rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted uppercase tracking-wider mb-1.5">Payment Link</p>
              <div className="flex items-center gap-2">
                <a href={resultLink} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline truncate flex-1">
                  {resultLink}
                </a>
                <button onClick={handleCopy} className="p-1.5 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors shrink-0" title="Copy link">
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a href={resultLink} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors shrink-0" title="Open link">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <p className="text-[10px] text-muted mt-2">ID: {resultId}</p>
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
                className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent placeholder:text-muted/50"
                placeholder="Enter name" />
            </div>

            {/* Email */}
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent placeholder:text-muted/50"
                placeholder="customer@email.com" />
            </div>

            {/* Phone */}
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Phone</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent placeholder:text-muted/50"
                placeholder="+91 98765 43210" />
            </div>

            {/* Amount */}
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Amount (₹)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted">₹</span>
                <input type="number" value={amountVal} onChange={(e) => setAmountVal(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg pl-7 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent placeholder:text-muted/50"
                  placeholder="0" min="1" />
              </div>
              {parseFloat(amountVal) > 0 && (
                <p className="text-[10px] text-muted mt-0.5">Will charge ₹{parseFloat(amountVal).toLocaleString("en-IN")}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Description</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent placeholder:text-muted/50"
                placeholder="Payment description" />
            </div>

            {/* Expiry + Notifications Row */}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Expires In (days)</label>
                <input type="number" value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
                  placeholder="7" min="1" max="365" />
              </div>
              <div className="flex items-center gap-3 pb-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={notifySms} onChange={(e) => setNotifySms(e.target.checked)}
                    className="w-3 h-3 rounded border-border accent-accent" />
                  <span className="text-[10px] text-muted">SMS</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)}
                    className="w-3 h-3 rounded border-border accent-accent" />
                  <span className="text-[10px] text-muted">Email</span>
                </label>
              </div>
            </div>

            {!notifySms && !notifyEmail && (
              <p className="text-[10px] text-amber-400">Select at least one notification method</p>
            )}

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
                className="flex-1 py-2 text-xs font-medium text-white bg-accent hover:bg-accent/80 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                {status === "sending" ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="w-3.5 h-3.5" /> Send Payment Link</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
