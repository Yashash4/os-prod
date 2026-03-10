"use client";

import { useEffect, useState } from "react";
import { LayoutDashboard, Users, Loader2, UserPlus, Briefcase } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

interface Stats {
  total: number;
  active: number;
  onLeave: number;
  exited: number;
  avgTenureMonths: number;
  payrollTotal: number;
  payrollPaid: number;
  payrollTotal_count: number;
}

interface DeptBreakdown { name: string; count: number; }
interface RecentHire { name: string; join_date: string; }

function rupees(paise: number) {
  return "₹" + (paise / 100).toLocaleString("en-IN");
}

export default function HRDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [deptBreakdown, setDeptBreakdown] = useState<DeptBreakdown[]>([]);
  const [typeBreakdown, setTypeBreakdown] = useState<Record<string, number>>({});
  const [recentHires, setRecentHires] = useState<RecentHire[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch("/api/hr/dashboard");
        const data = await res.json();
        setStats(data.stats || null);
        setDeptBreakdown(data.deptBreakdown || []);
        setTypeBreakdown(data.typeBreakdown || {});
        setRecentHires(data.recentHires || []);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, []);

  const TYPE_LABELS: Record<string, string> = {
    full_time: "Full Time",
    part_time: "Part Time",
    contract: "Contract",
    intern: "Intern",
  };

  const maxDeptCount = Math.max(...deptBreakdown.map((d) => d.count), 1);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <LayoutDashboard className="w-6 h-6 text-accent" />
        <h1 className="text-2xl font-bold">HR Dashboard</h1>
        {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
      </div>

      {stats && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Employees", value: stats.total, icon: Users, color: "text-blue-400" },
              { label: "Active", value: stats.active, icon: Users, color: "text-green-400" },
              { label: "On Leave", value: stats.onLeave, icon: Users, color: "text-amber-400" },
              { label: "Avg Tenure", value: `${stats.avgTenureMonths} mo`, icon: Briefcase, color: "text-purple-400" },
            ].map((s) => (
              <div key={s.label} className="card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                  <span className="text-xs text-muted">{s.label}</span>
                </div>
                <p className="text-xl font-semibold">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Payroll Summary */}
          <div className="card border border-border rounded-xl p-5">
            <h3 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
              Current Month Payroll
            </h3>
            <div className="flex items-baseline gap-4">
              <span className="text-2xl font-bold">{rupees(stats.payrollTotal)}</span>
              <span className="text-sm text-muted">
                {stats.payrollPaid}/{stats.payrollTotal_count} paid
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Department Breakdown */}
            <div className="card border border-border rounded-xl p-5">
              <h3 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">
                By Department
              </h3>
              <div className="space-y-3">
                {deptBreakdown.map((d) => (
                  <div key={d.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-foreground">{d.name}</span>
                      <span className="text-muted">{d.count}</span>
                    </div>
                    <div className="h-2 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all"
                        style={{ width: `${(d.count / maxDeptCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {deptBreakdown.length === 0 && (
                  <p className="text-xs text-muted">No department data</p>
                )}
              </div>
            </div>

            {/* Employment Type + Recent Hires */}
            <div className="space-y-5">
              <div className="card border border-border rounded-xl p-5">
                <h3 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
                  Employment Types
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(typeBreakdown).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between text-sm">
                      <span className="text-muted">{TYPE_LABELS[type] || type}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                  {Object.keys(typeBreakdown).length === 0 && (
                    <p className="text-xs text-muted col-span-2">No data</p>
                  )}
                </div>
              </div>

              <div className="card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <UserPlus className="w-4 h-4 text-accent" />
                  <h3 className="text-sm font-medium text-muted uppercase tracking-wider">
                    Recent Hires (30 days)
                  </h3>
                </div>
                {recentHires.length > 0 ? (
                  <div className="space-y-2">
                    {recentHires.map((h, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{h.name}</span>
                        <span className="text-xs text-muted">{h.join_date}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted">No recent hires</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
