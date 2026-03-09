"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Loader2, Map as MapIcon, Globe, FileCheck, Percent,
  CheckCircle, AlertTriangle, XCircle, Shield, Download,
} from "lucide-react";
import { SitemapSkeleton } from "@/components/Skeleton";
import { apiFetch } from "@/lib/api-fetch";

/* ── Helpers ─────────────────────────────────────── */

const TOOLTIP_STYLE = { contentStyle: { background: "#1e1e2e", border: "1px solid #333", borderRadius: 8 }, itemStyle: { color: "#e2e8f0" }, labelStyle: { color: "#94a3b8" } };

function num(n: number) { return n.toLocaleString("en-IN"); }

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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

function healthScore(entry: SitemapEntry) {
  let score = 100;
  const sub = (entry.contents || []).reduce((a, c) => a + (Number(c.submitted) || 0), 0);
  const idx = (entry.contents || []).reduce((a, c) => a + (Number(c.indexed) || 0), 0);
  const rate = sub > 0 ? idx / sub : 0;

  // Deductions
  if (Number(entry.errors) > 0) score -= 40;
  if (Number(entry.warnings) > 0) score -= 15;
  if (entry.isPending) score -= 20;
  if (rate < 0.5) score -= 25;
  else if (rate < 0.8) score -= 10;

  // Staleness
  if (entry.lastDownloaded) {
    const daysSince = (Date.now() - new Date(entry.lastDownloaded).getTime()) / 86400000;
    if (daysSince > 30) score -= 10;
    if (daysSince > 90) score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

function healthBadge(score: number) {
  if (score >= 80) return <span className="inline-flex items-center gap-1 text-xs text-green-400"><Shield className="w-3 h-3" />{score}</span>;
  if (score >= 50) return <span className="inline-flex items-center gap-1 text-xs text-amber-400"><Shield className="w-3 h-3" />{score}</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-red-400"><Shield className="w-3 h-3" />{score}</span>;
}

/* ── Page ────────────────────────────────────────── */

export default function SitemapPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sitemaps, setSitemaps] = useState<SitemapEntry[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch("/api/seo/sitemaps");
        const data = await res.json();
        setSitemaps(data.sitemaps || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load sitemaps");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    let submitted = 0, indexed = 0;
    for (const s of sitemaps) {
      for (const c of s.contents || []) {
        submitted += Number(c.submitted) || 0;
        indexed += Number(c.indexed) || 0;
      }
    }
    return {
      total: sitemaps.length,
      submitted,
      indexed,
      rate: submitted > 0 ? ((indexed / submitted) * 100).toFixed(1) + "%" : "-",
    };
  }, [sitemaps]);

  const chartData = useMemo(() =>
    sitemaps.map((s) => {
      const sub = (s.contents || []).reduce((a, c) => a + (Number(c.submitted) || 0), 0);
      const idx = (s.contents || []).reduce((a, c) => a + (Number(c.indexed) || 0), 0);
      const label = s.path.replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "") || "/sitemap";
      return { name: label.length > 30 ? "..." + label.slice(-27) : label, rate: sub > 0 ? Math.round((idx / sub) * 100) : 0, submitted: sub, indexed: idx };
    }),
  [sitemaps]);

  const statusCounts = useMemo(() => {
    let success = 0, pending = 0, errors = 0;
    for (const s of sitemaps) {
      if (Number(s.errors) > 0) errors++;
      else if (s.isPending) pending++;
      else success++;
    }
    return { success, pending, errors };
  }, [sitemaps]);

  const avgHealth = useMemo(() => {
    if (sitemaps.length === 0) return 0;
    return Math.round(sitemaps.reduce((sum, s) => sum + healthScore(s), 0) / sitemaps.length);
  }, [sitemaps]);

  if (loading) {
    return <div className="p-6 space-y-6 max-w-[1400px] mx-auto"><h1 className="text-2xl font-bold">Sitemap</h1><SitemapSkeleton /></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Sitemap</h1>
        <button
          onClick={() => {
            const headers = ["Sitemap URL", "Type", "Submitted", "Indexed", "Rate", "Health", "Last Submitted", "Last Downloaded", "Warnings", "Errors"];
            const rows = sitemaps.map((s) => {
              const sub = (s.contents || []).reduce((a, c) => a + (Number(c.submitted) || 0), 0);
              const idx = (s.contents || []).reduce((a, c) => a + (Number(c.indexed) || 0), 0);
              return [s.path, s.isSitemapsIndex ? "Index" : "Sitemap", String(sub), String(idx),
                sub > 0 ? ((idx / sub) * 100).toFixed(1) + "%" : "-", String(healthScore(s)),
                s.lastSubmitted || "-", s.lastDownloaded || "-", s.warnings, s.errors];
            });
            downloadCSV("seo-sitemaps.csv", headers, rows);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-accent/10 text-accent border border-accent/20 rounded-lg text-sm hover:bg-accent/20 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {error && <div className="bg-red-500/10 text-red-400 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total Sitemaps" value={num(stats.total)} icon={MapIcon} color="text-blue-400" />
        <StatCard label="URLs Submitted" value={num(stats.submitted)} icon={Globe} color="text-purple-400" />
        <StatCard label="URLs Indexed" value={num(stats.indexed)} icon={FileCheck} color="text-green-400" />
        <StatCard label="Index Rate" value={stats.rate} icon={Percent} color="text-emerald-400" />
        <StatCard label="Avg Health Score" value={String(avgHealth)} icon={Shield} color={avgHealth >= 80 ? "text-green-400" : avgHealth >= 50 ? "text-amber-400" : "text-red-400"} />
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <div>
            <p className="text-xs text-muted">Success</p>
            <p className="text-lg font-semibold">{statusCounts.success}</p>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <div>
            <p className="text-xs text-muted">Pending</p>
            <p className="text-lg font-semibold">{statusCounts.pending}</p>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-400" />
          <div>
            <p className="text-xs text-muted">Errors</p>
            <p className="text-lg font-semibold">{statusCounts.errors}</p>
          </div>
        </div>
      </div>

      {/* Index Rate Chart */}
      {chartData.length > 0 && (
        <WidgetCard title="Index Rate by Sitemap">
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 40)}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <YAxis dataKey="name" type="category" width={200} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => `${v}%`} />
              <Bar dataKey="rate" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </WidgetCard>
      )}

      {/* Sitemaps Table with Health Score */}
      <WidgetCard title="Sitemaps Detail">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="pb-2 font-medium">Sitemap URL</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium text-right">Submitted</th>
                <th className="pb-2 font-medium text-right">Indexed</th>
                <th className="pb-2 font-medium text-right">Rate</th>
                <th className="pb-2 font-medium text-center">Health</th>
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
                const score = healthScore(s);
                return (
                  <tr key={i} className="border-b border-border/50 hover:bg-surface-hover">
                    <td className="py-2 max-w-[300px] truncate" title={s.path}>{s.path}</td>
                    <td className="py-2 text-xs">{s.isSitemapsIndex ? "Index" : "Sitemap"}</td>
                    <td className="py-2 text-right">{num(sub)}</td>
                    <td className="py-2 text-right">{num(idx)}</td>
                    <td className="py-2 text-right">{sub > 0 ? ((idx / sub) * 100).toFixed(1) + "%" : "-"}</td>
                    <td className="py-2 text-center">{healthBadge(score)}</td>
                    <td className="py-2 text-xs text-muted">{s.lastSubmitted ? new Date(s.lastSubmitted).toLocaleDateString() : "-"}</td>
                    <td className="py-2 text-xs text-muted">{s.lastDownloaded ? new Date(s.lastDownloaded).toLocaleDateString() : "-"}</td>
                    <td className="py-2 text-right">{s.warnings !== "0" ? <span className="text-amber-400">{s.warnings}</span> : "0"}</td>
                    <td className="py-2 text-right">{s.errors !== "0" ? <span className="text-red-400">{s.errors}</span> : "0"}</td>
                  </tr>
                );
              })}
              {sitemaps.length === 0 && (
                <tr><td colSpan={10} className="py-8 text-center text-muted">No sitemaps found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </WidgetCard>
    </div>
  );
}
