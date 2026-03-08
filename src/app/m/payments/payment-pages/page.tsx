"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import {
  Loader2,
  ExternalLink,
  ScrollText,
  IndianRupee,
  Activity,
  ShoppingCart,
  Search,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from "lucide-react";
import { PaymentsTableSkeleton } from "@/components/Skeleton";

/* ── Types ─────────────────────────────────────────── */

/* eslint-disable @typescript-eslint/no-explicit-any */

interface PaymentPage {
  id: string;
  title: string;
  description: unknown;
  slug: string;
  status: string;
  amount_paid: number;
  receipt_min_amount: number | null;
  receipt_max_amount: number | null;
  expire_by: number | null;
  short_url: string;
  payment_page_items: any[];
  terms: unknown;
  notes: Record<string, string>;
  created_at: number;
}

/* ── Constants ─────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  inactive: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  expired: "bg-red-500/10 text-red-400 border-red-500/20",
};

const STATUS_OPTIONS = ["All", "active", "inactive", "expired"];

/* ── Helpers ───────────────────────────────────────── */

function currency(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(ts: number) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Extract plain text from Razorpay rich text (Quill delta JSON or plain string) */
function cleanDescription(desc: unknown): string {
  if (!desc) return "";
  if (typeof desc === "string") {
    if (desc.startsWith("[") || desc.startsWith("{")) {
      try {
        const parsed = JSON.parse(desc);
        return extractInserts(parsed);
      } catch { /* not JSON */ }
    }
    return desc;
  }
  if (typeof desc === "object" && desc !== null) {
    return extractInserts(desc);
  }
  return String(desc);
}

function extractInserts(obj: any): string {
  // Array of ops: [{insert: "text"}, ...]
  if (Array.isArray(obj)) {
    return obj
      .filter((op: any) => typeof op.insert === "string")
      .map((op: any) => op.insert)
      .join("")
      .trim();
  }
  // {value: [{insert: "text"}, ...]}
  if (obj.value && Array.isArray(obj.value)) {
    return extractInserts(obj.value);
  }
  return "";
}

/** Get the total sales for a payment page by summing item-level totals or falling back to amount_paid */
function getPageTotalSales(pg: PaymentPage): number {
  // Try item-level total_amount_paid first (most accurate)
  const itemTotal = (pg.payment_page_items || []).reduce((sum: number, item: any) => {
    return sum + (item.total_amount_paid || 0);
  }, 0);
  if (itemTotal > 0) return itemTotal;
  // Fallback to page-level amount_paid
  return pg.amount_paid || 0;
}

/** Get total units sold across all items */
function getPageUnitsSold(pg: PaymentPage): number {
  return (pg.payment_page_items || []).reduce((sum: number, item: any) => {
    return sum + (item.quantity_sold || item.quantity || 0);
  }, 0);
}

/** Get the primary item name */
function getItemName(pg: PaymentPage): string {
  const items = pg.payment_page_items || [];
  if (items.length === 0) return "—";
  const first = items[0];
  // Razorpay nests: { item: { name: "..." } } or flat { name: "..." }
  return first.item?.name || first.name || "Amount";
}

function StatCard({
  label,
  value,
  icon: Icon,
  color = "text-accent",
}: {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  color?: string;
}) {
  return (
    <div className="card rounded-xl p-4 transition-all">
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon className={`w-3.5 h-3.5 ${color}`} />}
        <span className="text-[10px] text-muted uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-xl font-bold text-foreground">{value}</span>
    </div>
  );
}

/* ── Detail Row Content ───────────────────────────── */

function PageDetail({ page }: { page: PaymentPage }) {
  const [copied, setCopied] = useState(false);
  const desc = cleanDescription(page.description);

  function copyLink() {
    if (page.short_url) {
      navigator.clipboard.writeText(page.short_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const items = page.payment_page_items || [];

  return (
    <div className="px-6 py-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Info */}
        <div className="space-y-3">
          <div>
            <span className="text-[10px] text-muted uppercase tracking-wider">Page ID</span>
            <p className="text-xs text-foreground font-mono mt-0.5">{page.id}</p>
          </div>
          {desc && (
            <div>
              <span className="text-[10px] text-muted uppercase tracking-wider">Description</span>
              <p className="text-xs text-foreground mt-0.5 whitespace-pre-line leading-relaxed">{desc}</p>
            </div>
          )}
          {page.slug && (
            <div>
              <span className="text-[10px] text-muted uppercase tracking-wider">Slug</span>
              <p className="text-xs text-foreground mt-0.5">{page.slug}</p>
            </div>
          )}
          {page.expire_by && (
            <div>
              <span className="text-[10px] text-muted uppercase tracking-wider">Expires</span>
              <p className="text-xs text-foreground mt-0.5">{formatDate(page.expire_by)}</p>
            </div>
          )}
          {page.receipt_min_amount != null && (
            <div>
              <span className="text-[10px] text-muted uppercase tracking-wider">Min Amount</span>
              <p className="text-xs text-foreground mt-0.5">{currency(page.receipt_min_amount)}</p>
            </div>
          )}
          {page.receipt_max_amount != null && (
            <div>
              <span className="text-[10px] text-muted uppercase tracking-wider">Max Amount</span>
              <p className="text-xs text-foreground mt-0.5">{currency(page.receipt_max_amount)}</p>
            </div>
          )}
          {page.short_url && (
            <div>
              <span className="text-[10px] text-muted uppercase tracking-wider">Payment Link</span>
              <div className="flex items-center gap-2 mt-0.5">
                <a href={page.short_url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline truncate max-w-xs">
                  {page.short_url}
                </a>
                <button onClick={copyLink} className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors" title="Copy link">
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Items */}
        <div>
          <span className="text-[10px] text-muted uppercase tracking-wider">Payment Items ({items.length})</span>
          {items.length > 0 ? (
            <div className="mt-2 space-y-2">
              {items.map((rawItem: any, idx: number) => {
                // Handle nested { item: {...}, quantity_sold, total_amount_paid } or flat
                const item = rawItem.item || rawItem;
                const qtySold = rawItem.quantity_sold || rawItem.quantity || 0;
                const totalPaid = rawItem.total_amount_paid || 0;
                const itemName = item.name || "Item";
                const itemAmount = item.amount || rawItem.amount || 0;
                const itemDesc = item.description || rawItem.description;

                return (
                  <div key={item.id || idx} className="bg-background/50 border border-border/50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-foreground font-medium">{itemName}</span>
                      <span className="text-xs text-foreground">{currency(itemAmount)}</span>
                    </div>
                    {itemDesc && (
                      <p className="text-[10px] text-muted mt-1">{cleanDescription(itemDesc)}</p>
                    )}
                    <div className="flex items-center gap-4 mt-1.5">
                      <span className="text-[10px] text-muted">Units sold: <span className="text-foreground font-medium">{qtySold}</span></span>
                      {totalPaid > 0 && (
                        <span className="text-[10px] text-muted">Total collected: <span className="text-green-400 font-medium">{currency(totalPaid)}</span></span>
                      )}
                      {item.min_amount != null && (
                        <span className="text-[10px] text-muted">Min: {currency(item.min_amount)}</span>
                      )}
                      {item.max_amount != null && (
                        <span className="text-[10px] text-muted">Max: {currency(item.max_amount)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted mt-2">No items configured</p>
          )}

          {/* Notes */}
          {page.notes && typeof page.notes === "object" && Object.keys(page.notes).length > 0 && (
            <div className="mt-3">
              <span className="text-[10px] text-muted uppercase tracking-wider">Notes</span>
              <div className="mt-1 space-y-1">
                {Object.entries(page.notes).map(([key, val]) => (
                  <div key={key} className="text-[10px]">
                    <span className="text-muted">{key}:</span>{" "}
                    <span className="text-foreground">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ────────────────────────────────── */

export default function PaymentPagesPage() {
  const [pages, setPages] = useState<PaymentPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/razorpay/payment-pages");
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setPages(data.pages || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    let result = pages;
    if (statusFilter !== "All") {
      result = result.filter((p) => p.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((p) =>
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.id && p.id.toLowerCase().includes(q)) ||
        (p.slug && p.slug.toLowerCase().includes(q))
      );
    }
    return result;
  }, [pages, statusFilter, search]);

  const stats = useMemo(() => {
    const total = pages.length;
    const active = pages.filter((p) => p.status === "active").length;
    const totalSales = pages.reduce((s, p) => s + getPageTotalSales(p), 0);
    const totalUnitsSold = pages.reduce((s, p) => s + getPageUnitsSold(p), 0);
    return { total, active, totalSales, totalUnitsSold };
  }, [pages]);

  if (loading && pages.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <h1 className="text-xl font-bold text-foreground tracking-tight">Payment Pages</h1>
        </div>
        <PaymentsTableSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-1 h-6 bg-accent rounded-full" />
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Payment Pages</h1>
          <p className="text-muted text-xs mt-0.5">Razorpay hosted payment pages</p>
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">{error}</div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Pages" value={stats.total} icon={ScrollText} color="text-blue-400" />
        <StatCard label="Active Pages" value={stats.active} icon={Activity} color="text-green-400" />
        <StatCard label="Total Sales" value={currency(stats.totalSales)} icon={IndianRupee} color="text-emerald-400" />
        <StatCard label="Units Sold" value={stats.totalUnitsSold} icon={ShoppingCart} color="text-purple-400" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search by title, ID, or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-background/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <div className="flex items-center gap-2">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                statusFilter === s
                  ? "bg-accent/20 text-accent border-accent/40"
                  : "bg-surface border-border text-muted hover:text-foreground"
              }`}
            >
              {s === "All" ? `All (${pages.length})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${pages.filter((p) => p.status === s).length})`}
            </button>
          ))}
        </div>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
      </div>

      {/* Table */}
      <div className="card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pl-3 pr-1 py-3 w-8"></th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Title</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Total Sales</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Item Name</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Units Sold</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Page URL</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Created</th>
                <th className="px-4 py-3 text-[10px] text-muted uppercase tracking-wider font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted">
                    No payment pages found.
                  </td>
                </tr>
              ) : (
                filtered.map((pg) => {
                  const isExpanded = expandedId === pg.id;
                  const totalSales = getPageTotalSales(pg);
                  const unitsSold = getPageUnitsSold(pg);
                  const itemName = getItemName(pg);

                  return (
                    <Fragment key={pg.id}>
                      <tr
                        className={`border-b border-border/50 hover:bg-surface-hover transition-colors cursor-pointer ${isExpanded ? "bg-surface-hover/50" : ""}`}
                        onClick={() => setExpandedId(isExpanded ? null : pg.id)}
                      >
                        <td className="pl-3 pr-1 py-3">
                          <span className="text-muted">
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-foreground font-medium">{pg.title || "—"}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-green-400 text-xs">{currency(totalSales)}</td>
                        <td className="px-4 py-3 text-muted text-xs">{itemName}</td>
                        <td className="px-4 py-3 text-foreground text-xs">{unitsSold}</td>
                        <td className="px-4 py-3 text-xs">
                          {pg.short_url ? (
                            <a
                              href={pg.short_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent hover:underline truncate block max-w-[200px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {pg.short_url}
                            </a>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">{formatDate(pg.created_at)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_COLORS[pg.status] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                            {pg.status.charAt(0).toUpperCase() + pg.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="bg-surface/30 border-b border-border/50 p-0">
                            <PageDetail page={pg} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
