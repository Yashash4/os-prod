"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AuditLog } from "@/types";

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterTier, setFilterTier] = useState("");
  const [filterModule, setFilterModule] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (filterTier) params.set("tier", filterTier);
      if (filterModule) params.set("module", filterModule);

      const res = await fetch(`/api/admin/audit-logs?${params}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [page, filterTier, filterModule]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function tierBadge(tier: number) {
    if (tier === 1) return "bg-red-500/10 text-red-400 border-red-500/20";
    return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Audit Log</h1>
        <p className="text-sm text-muted mt-0.5">{total} log entr{total !== 1 ? "ies" : "y"}</p>
      </div>

      <div className="flex gap-3 mb-4">
        <select
          value={filterTier}
          onChange={(e) => { setFilterTier(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:border-accent"
        >
          <option value="">All Tiers</option>
          <option value="1">Tier 1 (Critical)</option>
          <option value="2">Tier 2 (Important)</option>
        </select>
        <input
          value={filterModule}
          onChange={(e) => { setFilterModule(e.target.value); setPage(1); }}
          placeholder="Filter by module..."
          className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:border-accent w-48"
        />
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b border-border">
              <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider w-10">#</th>
              <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Tier</th>
              <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">User</th>
              <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Action</th>
              <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Module</th>
              <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Breadcrumb</th>
              <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Time</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted">
                  No audit logs found.
                </td>
              </tr>
            ) : (
              logs.map((log, i) => (
                <tr key={log.id} className="border-b border-border last:border-0 hover:bg-surface-hover/50">
                  <td className="px-4 py-2.5 text-muted">{(page - 1) * 50 + i + 1}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${tierBadge(log.tier)}`}>
                      T{log.tier}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-foreground">{log.user_name || log.user_id.slice(0, 8)}</td>
                  <td className="px-4 py-2.5 text-foreground">{log.action}</td>
                  <td className="px-4 py-2.5 text-muted">{log.module}</td>
                  <td className="px-4 py-2.5 text-muted text-xs">{log.breadcrumb || "—"}</td>
                  <td className="px-4 py-2.5 text-muted text-xs whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-muted">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded-lg text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded-lg text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
