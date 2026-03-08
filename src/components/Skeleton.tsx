"use client";

/* ── Reusable skeleton loading primitives ────────── */

function Bone({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded-lg bg-border/50 ${className}`} style={style} />;
}

/* ── Primitives ─────────────────────────────────── */

export function StatCardSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
      <Bone className="h-3 w-20" />
      <Bone className="h-6 w-16" />
      <Bone className="h-3 w-24" />
    </div>
  );
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <Bone className="h-4 w-40 mb-4" />
      <div className="flex items-end gap-1" style={{ height }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <Bone
            key={i}
            className="flex-1 rounded-sm"
            style={{ height: `${25 + ((i * 37 + 13) % 60)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <Bone className="h-4 w-32 mb-4" />
      <div className="space-y-3">
        <div className="flex gap-4 pb-2 border-b border-border">
          {Array.from({ length: cols }).map((_, i) => (
            <Bone key={i} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <Bone key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function InsightSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex gap-3">
      <Bone className="w-8 h-8 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <Bone className="h-4 w-3/4" />
        <Bone className="h-3 w-full" />
      </div>
    </div>
  );
}

export function ToolbarSkeleton() {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Bone className="h-9 w-44 rounded-lg" />
      <Bone className="h-9 w-32 rounded-lg" />
      <Bone className="h-9 w-28 rounded-lg" />
    </div>
  );
}

export function PillsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {Array.from({ length: count }).map((_, i) => (
        <Bone key={i} className="h-7 rounded-full" style={{ width: `${60 + ((i * 23) % 40)}px` }} />
      ))}
    </div>
  );
}

export function TabsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-1 border-b border-border pb-px">
      {Array.from({ length: count }).map((_, i) => (
        <Bone key={i} className="h-8 rounded-t-lg" style={{ width: `${70 + ((i * 17) % 30)}px` }} />
      ))}
    </div>
  );
}

/* ── SEO page skeletons ─────────────────────────── */

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <InsightSkeleton />
        <InsightSkeleton />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}

export function PerformanceSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <ChartSkeleton height={300} />
      <TableSkeleton rows={8} cols={5} />
    </div>
  );
}

export function KeywordsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton height={200} />
        <TableSkeleton rows={4} cols={4} />
      </div>
      <TableSkeleton rows={10} cols={6} />
    </div>
  );
}

export function BusinessSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton height={250} />
        <ChartSkeleton height={250} />
      </div>
      <TableSkeleton rows={6} cols={4} />
    </div>
  );
}

/* ── SEO Sitemap & Indexing ─────────────────────── */

export function SitemapSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <ChartSkeleton height={250} />
      <TableSkeleton rows={5} cols={8} />
    </div>
  );
}

export function IndexingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton height={250} />
        <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
          <Bone className="h-4 w-32" />
          <Bone className="h-3 w-48" />
          <Bone className="h-28 w-full" />
          <div className="flex gap-2">
            <Bone className="h-9 w-28 rounded-lg" />
            <Bone className="h-9 w-40 rounded-lg" />
          </div>
        </div>
      </div>
      <TableSkeleton rows={5} cols={7} />
    </div>
  );
}

/* ── Meta Ads skeletons ─────────────────────────── */

export function MetaDashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartSkeleton height={200} />
        <ChartSkeleton height={200} />
        <ChartSkeleton height={200} />
      </div>
      <TableSkeleton rows={5} cols={6} />
    </div>
  );
}

export function MetaTableSkeleton() {
  return (
    <div className="space-y-4">
      <PillsSkeleton count={4} />
      <TableSkeleton rows={8} cols={7} />
    </div>
  );
}

export function MetaAnalyticsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <ChartSkeleton height={300} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton height={250} />
        <ChartSkeleton height={250} />
      </div>
    </div>
  );
}

/* ── Sales skeletons ────────────────────────────── */

export function SalesDashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-xl p-5 space-y-3">
            <Bone className="h-4 w-24" />
            <Bone className="h-3 w-full" />
            <Bone className="h-3 w-4/5" />
            <Bone className="h-3 w-3/5" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton height={250} />
        <ChartSkeleton height={250} />
      </div>
    </div>
  );
}

export function DataTableSkeleton({ cols = 8 }: { cols?: number }) {
  return (
    <div className="space-y-4">
      <ToolbarSkeleton />
      <PillsSkeleton />
      <TableSkeleton rows={10} cols={cols} />
    </div>
  );
}

export function SalesManagementSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <ToolbarSkeleton />
      <PillsSkeleton />
      <TableSkeleton rows={8} cols={8} />
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-4">
      <ToolbarSkeleton />
      <TabsSkeleton />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton height={250} />
        <ChartSkeleton height={250} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartSkeleton height={200} />
        <ChartSkeleton height={200} />
        <ChartSkeleton height={200} />
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-4">
      <ToolbarSkeleton />
      <TabsSkeleton count={3} />
      <ToolbarSkeleton />
      <PillsSkeleton />
      <TableSkeleton rows={10} cols={8} />
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Bone className="h-8 w-48" />
        <div className="flex gap-2">
          <Bone className="h-9 w-9 rounded-lg" />
          <Bone className="h-9 w-9 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px bg-surface border border-border rounded-xl overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={`h-${i}`} className="p-2 text-center">
            <Bone className="h-4 w-8 mx-auto" />
          </div>
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="p-2 min-h-[80px] bg-surface">
            <Bone className="h-3 w-6 mb-2" />
            {i % 5 === 0 && <Bone className="h-5 w-full rounded-sm" />}
            {i % 7 === 2 && <Bone className="h-5 w-4/5 rounded-sm mt-1" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Payments skeletons ────────────────────────────── */

export function PaymentsDashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}

export function PaymentsTableSkeleton() {
  return (
    <div className="space-y-4">
      <ToolbarSkeleton />
      <TableSkeleton rows={10} cols={7} />
    </div>
  );
}

export function OnboardingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton height={220} />
        <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
          <Bone className="h-4 w-36" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Bone className="h-3 w-24" />
              <Bone className="h-4 flex-1 rounded-full" />
              <Bone className="h-3 w-10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
