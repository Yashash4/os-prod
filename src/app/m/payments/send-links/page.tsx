"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Send,
  Copy,
  Check,
  Loader2,
  IndianRupee,
  ExternalLink,
  Link2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

/* ── Types ─────────────────────────────────────────── */

interface PaymentLink {
  id: string;
  amount: number; // paise
  currency: string;
  status: string;
  short_url: string;
  description: string;
  customer?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  created_at: number; // unix
  expire_by?: number; // unix
}

/* ── Status Configs ──────────────────────────────────── */

const LINK_STATUSES: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  created: { label: "Created", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", icon: Clock },
  paid: { label: "Paid", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", icon: CheckCircle },
  partially_paid: { label: "Partial", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: AlertCircle },
  cancelled: { label: "Cancelled", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: XCircle },
  expired: { label: "Expired", color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20", icon: Clock },
};

/* ── Helpers ─────────────────────────────────────────── */

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

/* ── Main Component ────────────────────────────────── */

export default function SendLinksPage() {
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [error, setError] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("Payment for Apex Fashion Lab");
  const [expiryDays, setExpiryDays] = useState("7");
  const [notifySms, setNotifySms] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);

  // Send state
  const [sending, setSending] = useState(false);
  const [successLink, setSuccessLink] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // Fetch existing links
  const fetchLinks = async () => {
    try {
      const res = await apiFetch("/api/razorpay/payment-links");
      const data = await res.json();
      setLinks(data.paymentLinks || data.items || []);
    } catch {
      setError("Failed to load payment links");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  // Today's stats
  const todayStats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayUnix = Math.floor(todayStart.getTime() / 1000);

    const todayLinks = links.filter((l) => l.created_at >= todayUnix);
    const count = todayLinks.length;
    const totalAmount = todayLinks.reduce((s, l) => s + l.amount, 0);
    return { count, totalAmount };
  }, [links]);

  // Validation
  const canSend =
    parseFloat(amount) > 0 &&
    (email.trim() || phone.trim()) &&
    description.trim() &&
    (notifySms || notifyEmail);

  // Send payment link
  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setError("");
    setSuccessLink("");

    try {
      const expireByUnix = expiryDays
        ? Math.floor(Date.now() / 1000) + parseInt(expiryDays) * 86400
        : undefined;

      const res = await apiFetch("/api/razorpay/payment-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          description,
          customerName: name || undefined,
          customerEmail: email.trim() || undefined,
          customerPhone: phone.trim() ? normalizePhone(phone) : undefined,
          notifySms,
          notifyEmail,
          expireByUnix,
        }),
      });

      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setSuccessLink(data.paymentLink.short_url);

      // Prepend to links list
      setLinks((prev) => [data.paymentLink, ...prev]);

      // Reset form
      setName("");
      setEmail("");
      setPhone("");
      setAmount("");
      setDescription("Payment for Apex Fashion Lab");
      setExpiryDays("7");
      setNotifySms(true);
      setNotifyEmail(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create payment link");
    } finally {
      setSending(false);
    }
  };

  // Copy handler
  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  };

  // Get customer name from link
  const getCustomerName = (link: PaymentLink): string => {
    return link.customer?.name || link.notes?.name || link.notes?.customer_name || "-";
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex-shrink-0 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Send Payment Links</h1>
            <p className="text-muted text-xs mt-0.5">Create and send Razorpay payment links to customers</p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-3 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20 flex items-center justify-between">
          {error}
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-300 text-xs ml-4">Dismiss</button>
        </div>
      )}

      {/* Success Banner */}
      {successLink && (
        <div className="mx-6 mt-3 bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-center gap-3">
          <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-green-400">Payment link sent successfully!</p>
            <a href={successLink} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline truncate block">
              {successLink}
            </a>
          </div>
          <button
            onClick={() => handleCopy(successLink)}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors shrink-0"
          >
            {copied === successLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied === successLink ? "Copied" : "Copy"}
          </button>
          <button onClick={() => setSuccessLink("")} className="text-green-400 hover:text-green-300 text-xs shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="px-6 py-3 flex gap-3 flex-shrink-0 border-b border-border/50">
        <StatCard icon={<Send className="w-4 h-4" />} label="Links Sent Today" value={String(todayStats.count)} color="text-blue-400" bg="bg-blue-500/10" />
        <StatCard icon={<IndianRupee className="w-4 h-4" />} label="Total Amount Today" value={formatAmount(todayStats.totalAmount)} color="text-green-400" bg="bg-green-500/10" />
      </div>

      {/* Inline Send Form */}
      <div className="px-6 py-4 flex-shrink-0 border-b border-border/50 bg-surface/50">
        <div className="flex items-end gap-3 flex-wrap">
          {/* Customer Name */}
          <div className="flex-1 min-w-[140px]">
            <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Customer Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent placeholder:text-muted/50"
              placeholder="Enter name"
            />
          </div>

          {/* Email */}
          <div className="flex-1 min-w-[160px]">
            <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent placeholder:text-muted/50"
              placeholder="customer@email.com"
            />
          </div>

          {/* Phone */}
          <div className="flex-1 min-w-[140px]">
            <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">
              Phone <span className="text-muted/50">(+91)</span>
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent placeholder:text-muted/50"
              placeholder="98765 43210"
            />
          </div>

          {/* Amount */}
          <div className="w-28">
            <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Amount ₹</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent placeholder:text-muted/50"
              placeholder="0"
              min="1"
            />
          </div>

          {/* Description */}
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent placeholder:text-muted/50"
              placeholder="Payment description"
            />
          </div>

          {/* Expiry Days */}
          <div className="w-20">
            <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Expiry</label>
            <input
              type="number"
              value={expiryDays}
              onChange={(e) => setExpiryDays(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
              placeholder="7"
              min="1"
              max="365"
            />
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-3 pb-0.5">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={notifySms}
                onChange={(e) => setNotifySms(e.target.checked)}
                className="w-3 h-3 rounded border-border accent-accent"
              />
              <span className="text-[10px] text-muted">SMS</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.checked)}
                className="w-3 h-3 rounded border-border accent-accent"
              />
              <span className="text-[10px] text-muted">Email</span>
            </label>
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!canSend || sending}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent/80 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
            ) : (
              <><Send className="w-3.5 h-3.5" /> Send</>
            )}
          </button>
        </div>

        {/* Validation hints */}
        {!notifySms && !notifyEmail && (
          <p className="text-[10px] text-amber-400 mt-2">Select at least one notification method (SMS or Email)</p>
        )}
        {!email.trim() && !phone.trim() && (amount || name) && (
          <p className="text-[10px] text-amber-400 mt-2">Email or Phone is required</p>
        )}
      </div>

      {/* Recent Links Table */}
      <div className="px-6 py-3 flex-shrink-0 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Link2 className="w-3.5 h-3.5 text-muted" />
          <h2 className="text-sm font-semibold text-foreground">Recent Payment Links</h2>
          <span className="text-xs text-muted">({links.length})</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading payment links...</span>
          </div>
        ) : (
          <table className="w-full border-collapse min-w-[900px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface border-b border-border/50">
                <th className="w-10 text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5 border-r border-border">#</th>
                <th className="w-40 text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5 border-r border-border">Customer</th>
                <th className="w-28 text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5 border-r border-border">Amount</th>
                <th className="w-28 text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5 border-r border-border">Status</th>
                <th className="w-52 text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5 border-r border-border">Short URL</th>
                <th className="w-28 text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5 border-r border-border">Created</th>
                <th className="w-28 text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5">Expires</th>
              </tr>
            </thead>
            <tbody>
              {links.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-muted text-sm">
                    No payment links found. Send your first link using the form above.
                  </td>
                </tr>
              ) : (
                links.map((link, idx) => {
                  const statusCfg = LINK_STATUSES[link.status] || LINK_STATUSES.created;
                  const StatusIcon = statusCfg.icon;

                  return (
                    <tr key={link.id} className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors">
                      {/* # */}
                      <td className="px-3 py-2 text-xs text-muted border-r border-border">{idx + 1}</td>

                      {/* Customer */}
                      <td className="px-3 py-2 text-xs text-foreground font-medium border-r border-border">
                        {getCustomerName(link)}
                      </td>

                      {/* Amount */}
                      <td className="px-3 py-2 text-xs border-r border-border">
                        <span className="text-foreground font-medium">{formatAmount(link.amount)}</span>
                      </td>

                      {/* Status */}
                      <td className="px-2 py-1.5 border-r border-border">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border ${statusCfg.bg} ${statusCfg.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Short URL */}
                      <td className="px-3 py-2 text-xs border-r border-border">
                        <div className="flex items-center gap-1.5">
                          <a
                            href={link.short_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline truncate flex-1"
                          >
                            {link.short_url}
                          </a>
                          <button
                            onClick={() => handleCopy(link.short_url)}
                            className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors shrink-0"
                            title="Copy link"
                          >
                            {copied === link.short_url ? (
                              <Check className="w-3 h-3 text-green-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          <a
                            href={link.short_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors shrink-0"
                            title="Open link"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </td>

                      {/* Created */}
                      <td className="px-3 py-2 text-xs text-foreground border-r border-border">
                        {formatDate(link.created_at)}
                      </td>

                      {/* Expires */}
                      <td className="px-3 py-2 text-xs text-foreground">
                        {link.expire_by ? formatDate(link.expire_by) : <span className="text-muted">-</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ── Stat Card ──────────────────────────────────────── */

function StatCard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: string; color: string; bg: string }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/30 ${bg}`}>
      <div className={color}>{icon}</div>
      <div>
        <p className="text-[9px] text-muted uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}
