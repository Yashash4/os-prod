"use client";

import { useEffect, useState, useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Loader2, FileCheck, AlertTriangle, Globe,
  CheckCircle, XCircle, Clock, Smartphone, Zap,
} from "lucide-react";
import { IndexingSkeleton } from "@/components/Skeleton";

/* ── Helpers ─────────────────────────────────────── */

const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#6366f1", "#8b5cf6"];
const TOOLTIP_STYLE = { contentStyle: { background: "#1e1e2e", border: "1px solid #333", borderRadius: 8 }, itemStyle: { color: "#e2e8f0" }, labelStyle: { color: "#94a3b8" } };

function num(n: number) { return n.toLocaleString("en-IN"); }

/* ── Types ───────────────────────────────────────── */

interface SitemapEntry {
  path: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending: boolean;
  isSitemapsIndex: boolean;
  warnings: string;
  errors: string;
  contents?: { type: string; submitted: string; indexed: string }[];
}

interface InspectionResult {
  url: string;
  indexingState: string;
  lastCrawlTime?: string;
  crawlStatus?: string;
  verdict?: string;
  mobileUsability?: string;
}

/* ── Components ──────────────────────────────────── */

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-muted">{label}</span>
      </div>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

function WidgetCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface border border-border rounded-xl p-5 ${className}`}>
      <h3 className="text-sm font-medium text-muted mb-4">{title}</h3>
      {children}
    </div>
  );
}

function verdictBadge(verdict?: string) {
  if (!verdict) return <span className="text-muted">-</span>;
  const v = verdict.toUpperCase();
  if (v === "PASS" || v.includes("VALID") || v.includes("INDEXED")) return <span className="inline-flex items-center gap-1 text-green-400 text-xs"><CheckCircle className="w-3 h-3" />{verdict}</span>;
  if (v === "FAIL" || v.includes("ERROR") || v.includes("NOT_INDEXED")) return <span className="inline-flex items-center gap-1 text-red-400 text-xs"><XCircle className="w-3 h-3" />{verdict}</span>;
  return <span className="inline-flex items-center gap-1 text-amber-400 text-xs"><Clock className="w-3 h-3" />{verdict}</span>;
}

/* ── Page ────────────────────────────────────────── */

export default function IndexingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sitemaps, setSitemaps] = useState<SitemapEntry[]>([]);
  const [inspections, setInspections] = useState<InspectionResult[]>([]);
  const [inspectUrls, setInspectUrls] = useState("");
  const [inspecting, setInspecting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/seo/sitemaps");
        const data = await res.json();
        setSitemaps(data.sitemaps || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleInspect = async () => {
    const urls = inspectUrls.split("\n").map((u) => u.trim()).filter(Boolean);
    if (!urls.length) return;
    setInspecting(true);
    try {
      const res = await fetch("/api/seo/url-inspection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const data = await res.json();
      setInspections(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inspection failed");
    } finally {
      setInspecting(false);
    }
  };

  const handleAutoInspect = async () => {
    setInspecting(true);
    try {
      // Fetch top 20 pages from GSC
      const end = new Date().toISOString().split("T")[0];
      const start = new Date(Date.now() - 28 * 86400000).toISOString().split("T")[0];
      const pagesRes = await fetch(`/api/seo/search-analytics?startDate=${start}&endDate=${end}&dimensions=page&rowLimit=20`);
      const pagesData = await pagesRes.json();
      const urls = (pagesData.rows || []).map((r: { keys: string[] }) => r.keys[0]).filter(Boolean);

      if (urls.length === 0) {
        setError("No pages found in GSC to inspect");
        setInspecting(false);
        return;
      }

      const res = await fetch("/api/seo/url-inspection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const data = await res.json();
      setInspections(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auto-inspection failed");
    } finally {
      setInspecting(false);
    }
  };

  /* ── Derived ───────────────────────────────────── */

  const sitemapStats = useMemo(() => {
    let submitted = 0, indexed = 0;
    for (const s of sitemaps) {
      for (const c of s.contents || []) {
        submitted += Number(c.submitted) || 0;
        indexed += Number(c.indexed) || 0;
      }
    }
    const errCount = sitemaps.reduce((a, s) => a + (Number(s.errors) || 0), 0);
    return { submitted, indexed, rate: submitted > 0 ? ((indexed / submitted) * 100).toFixed(1) + "%" : "-", errors: errCount };
  }, [sitemaps]);

  const coveragePie = useMemo(() => {
    const { submitted, indexed } = sitemapStats;
    if (submitted === 0) return [];
    return [
      { name: "Indexed", value: indexed },
      { name: "Not Indexed", value: submitted - indexed },
    ].filter((d) => d.value > 0);
  }, [sitemapStats]);

  const inspectionStats = useMemo(() => {
    const indexed = inspections.filter((r) => r.indexingState.toUpperCase().includes("INDEXED") || r.verdict?.toUpperCase() === "PASS").length;
    const errors = inspections.filter((r) => r.indexingState === "ERROR" || r.verdict?.toUpperCase().includes("FAIL")).length;
    const notIndexed = inspections.length - indexed - errors;
    return { indexed, errors, notIndexed, total: inspections.length };
  }, [inspections]);

  if (loading) {
    return <div className="p-6 space-y-6 max-w-[1400px] mx-auto"><h1 className="text-2xl font-bold">Pages & Indexing</h1><IndexingSkeleton /></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <h1 className="text-2xl font-bold">Pages & Indexing</h1>

      {error && <div className="bg-red-500/10 text-red-400 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="URLs Submitted" value={num(sitemapStats.submitted)} icon={Globe} color="text-blue-400" />
        <StatCard label="URLs Indexed" value={num(sitemapStats.indexed)} icon={FileCheck} color="text-green-400" />
        <StatCard label="Index Coverage" value={sitemapStats.rate} icon={FileCheck} color="text-emerald-400" />
        <StatCard label="Sitemap Errors" value={num(sitemapStats.errors)} icon={AlertTriangle} color="text-red-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Coverage Pie */}
        <WidgetCard title="Index Coverage">
          {coveragePie.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={coveragePie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} label={(e) => `${e.name} ${num(e.value)}`}>
                  {coveragePie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted text-sm text-center py-10">No sitemap data available</p>
          )}
        </WidgetCard>

        {/* URL Inspector */}
        <WidgetCard title="URL Inspection">
          <p className="text-xs text-muted mb-2">Enter URLs (one per line, max 20) to check their indexing status:</p>
          <textarea
            value={inspectUrls}
            onChange={(e) => setInspectUrls(e.target.value)}
            placeholder="https://apexfashionlab.com/page1&#10;https://apexfashionlab.com/page2"
            className="w-full bg-background border border-border rounded-lg p-3 text-sm h-28 resize-none mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={handleInspect}
              disabled={inspecting}
              className="bg-accent text-white px-4 py-2 rounded-lg text-sm hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2"
            >
              {inspecting && <Loader2 className="w-4 h-4 animate-spin" />}
              Inspect URLs
            </button>
            <button
              onClick={handleAutoInspect}
              disabled={inspecting}
              className="bg-surface border border-border text-foreground px-4 py-2 rounded-lg text-sm hover:bg-surface-hover disabled:opacity-50 flex items-center gap-2"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              Auto-inspect Top 20 Pages
            </button>
          </div>
        </WidgetCard>
      </div>

      {/* Inspection Results */}
      {inspections.length > 0 && (
        <WidgetCard title={`Inspection Results`}>
          {/* Summary bar */}
          <div className="flex gap-4 mb-4 text-xs">
            <span className="flex items-center gap-1 text-green-400"><CheckCircle className="w-3.5 h-3.5" /> {inspectionStats.indexed} indexed</span>
            <span className="flex items-center gap-1 text-amber-400"><Clock className="w-3.5 h-3.5" /> {inspectionStats.notIndexed} not indexed</span>
            <span className="flex items-center gap-1 text-red-400"><XCircle className="w-3.5 h-3.5" /> {inspectionStats.errors} errors</span>
            <span className="text-muted">out of {inspectionStats.total} URLs</span>
          </div>

          {/* Coverage bar */}
          {inspectionStats.total > 0 && (
            <div className="flex h-2 rounded-full overflow-hidden mb-4">
              {inspectionStats.indexed > 0 && (
                <div className="bg-green-500" style={{ width: `${(inspectionStats.indexed / inspectionStats.total) * 100}%` }} />
              )}
              {inspectionStats.notIndexed > 0 && (
                <div className="bg-amber-500" style={{ width: `${(inspectionStats.notIndexed / inspectionStats.total) * 100}%` }} />
              )}
              {inspectionStats.errors > 0 && (
                <div className="bg-red-500" style={{ width: `${(inspectionStats.errors / inspectionStats.total) * 100}%` }} />
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-2 font-medium">URL</th>
                  <th className="pb-2 font-medium">Index State</th>
                  <th className="pb-2 font-medium">Last Crawl</th>
                  <th className="pb-2 font-medium">Crawl As</th>
                  <th className="pb-2 font-medium">Verdict</th>
                  <th className="pb-2 font-medium">Mobile</th>
                </tr>
              </thead>
              <tbody>
                {inspections.map((r, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-surface-hover">
                    <td className="py-2 max-w-[300px] truncate" title={r.url}>
                      {r.url.replace(/^https?:\/\/[^/]+/, "") || "/"}
                    </td>
                    <td className="py-2">{verdictBadge(r.indexingState)}</td>
                    <td className="py-2 text-xs text-muted">{r.lastCrawlTime ? new Date(r.lastCrawlTime).toLocaleDateString() : "-"}</td>
                    <td className="py-2 text-xs">{r.crawlStatus || "-"}</td>
                    <td className="py-2">{verdictBadge(r.verdict)}</td>
                    <td className="py-2">
                      {r.mobileUsability ? (
                        <span className={`inline-flex items-center gap-1 text-xs ${r.mobileUsability.toUpperCase().includes("PASS") || r.mobileUsability.toUpperCase().includes("USABLE") ? "text-green-400" : "text-amber-400"}`}>
                          <Smartphone className="w-3 h-3" />{r.mobileUsability}
                        </span>
                      ) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WidgetCard>
      )}

      {/* Sitemap Summary */}
      <WidgetCard title="Sitemap Summary">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="pb-2 font-medium">Sitemap</th>
                <th className="pb-2 font-medium text-right">Submitted</th>
                <th className="pb-2 font-medium text-right">Indexed</th>
                <th className="pb-2 font-medium text-right">Rate</th>
                <th className="pb-2 font-medium">Last Submitted</th>
                <th className="pb-2 font-medium">Last Downloaded</th>
                <th className="pb-2 font-medium text-right">Warnings</th>
                <th className="pb-2 font-medium text-right">Errors</th>
              </tr>
            </thead>
            <tbody>
              {sitemaps.map((s, i) => {
                const sub = (s.contents || []).reduce((a, c) => a + (Number(c.submitted) || 0), 0);
                const idx = (s.contents || []).reduce((a, c) => a + (Number(c.indexed) || 0), 0);
                return (
                  <tr key={i} className="border-b border-border/50 hover:bg-surface-hover">
                    <td className="py-2 max-w-[300px] truncate" title={s.path}>{s.path}</td>
                    <td className="py-2 text-right">{num(sub)}</td>
                    <td className="py-2 text-right">{num(idx)}</td>
                    <td className="py-2 text-right">{sub > 0 ? ((idx / sub) * 100).toFixed(1) + "%" : "-"}</td>
                    <td className="py-2 text-xs text-muted">{s.lastSubmitted ? new Date(s.lastSubmitted).toLocaleDateString() : "-"}</td>
                    <td className="py-2 text-xs text-muted">{s.lastDownloaded ? new Date(s.lastDownloaded).toLocaleDateString() : "-"}</td>
                    <td className="py-2 text-right">{s.warnings !== "0" ? <span className="text-amber-400">{s.warnings}</span> : "0"}</td>
                    <td className="py-2 text-right">{s.errors !== "0" ? <span className="text-red-400">{s.errors}</span> : "0"}</td>
                  </tr>
                );
              })}
              {sitemaps.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-muted">No sitemaps found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </WidgetCard>
    </div>
  );
}
