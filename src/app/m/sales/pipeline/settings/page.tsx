"use client";

import { useEffect, useState, useCallback } from "react";
import Shell from "@/components/Shell";
import { SettingsSkeleton } from "@/components/Skeleton";
import {
  RefreshCw,
  Phone,
  Mail,
  ChevronDown,
  Search,
  Filter,
  MessageSquare,
  Star,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

/* ── Types ─────────────────────────────────────────── */

type OptinStatus = "new" | "contacted" | "interested" | "call_booked" | "payment_pending" | "payment_done" | "not_interested" | "no_response";
type PaymentDoneStatus = "new" | "contacted" | "call_scheduled" | "call_completed" | "no_response" | "rescheduled" | "not_reachable";
type CallBookedStatus = "pending_review" | "call_done" | "right_fit" | "not_a_fit" | "needs_followup" | "onboarded" | "declined";

type SettingsTab = "optins" | "payment_done" | "call_booked";

interface Pipeline {
  id: string;
  name: string;
  stages: { id: string; name: string }[];
}

interface GHLOpportunity {
  id: string;
  name: string;
  status: string;
  monetaryValue: number;
  pipelineStageId: string;
  source?: string;
  assignedTo?: string;
  contactId?: string;
  contact?: { id?: string; name: string; email: string; phone?: string };
  createdAt?: string;
}

interface TrackingRecord {
  id: string;
  opportunity_id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  pipeline_name: string;
  stage_name: string;
  source: string;
  status: string;
  notes: string | null;
  comments: string | null;
  rating: number | null;
  assigned_to: string | null;
  last_contacted_at: string | null;
  call_scheduled_at?: string | null;
  call_date?: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Status Configs ────────────────────────────────── */

type StatusCfg = Record<string, { label: string; color: string; bg: string }>;

const OPTIN_STATUS_CONFIG: StatusCfg = {
  new: { label: "New", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  contacted: { label: "Contacted", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  interested: { label: "Interested", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  call_booked: { label: "Call Booked", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
  payment_pending: { label: "Payment Pending", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  payment_done: { label: "Payment Done", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  not_interested: { label: "Not Interested", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  no_response: { label: "No Response", color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20" },
};

const PD_STATUS_CONFIG: StatusCfg = {
  new: { label: "New", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  contacted: { label: "Contacted", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  call_scheduled: { label: "Call Scheduled", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
  call_completed: { label: "Call Completed", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  no_response: { label: "No Response", color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20" },
  rescheduled: { label: "Rescheduled", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  not_reachable: { label: "Not Reachable", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
};

const CB_STATUS_CONFIG: StatusCfg = {
  pending_review: { label: "Pending Review", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  call_done: { label: "Call Done", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  right_fit: { label: "Right Fit", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  not_a_fit: { label: "Not a Fit", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  needs_followup: { label: "Needs Follow-up", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  onboarded: { label: "Onboarded", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  declined: { label: "Declined", color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20" },
};

const ALL_OPTIN_STATUSES = Object.keys(OPTIN_STATUS_CONFIG) as OptinStatus[];
const ALL_PD_STATUSES = Object.keys(PD_STATUS_CONFIG) as PaymentDoneStatus[];
const ALL_CB_STATUSES = Object.keys(CB_STATUS_CONFIG) as CallBookedStatus[];

const TABS: { key: SettingsTab; label: string }[] = [
  { key: "optins", label: "Opt Ins" },
  { key: "payment_done", label: "Payment Done" },
  { key: "call_booked", label: "Call Booked" },
];

/* ── Helper: sync a stage into a tracking table ────── */
// Non-destructive: upserts records currently in the stage, and also
// updates ghl_status + assigned_to for records that moved to other stages.
// This way, if a lead is marked "won" directly in GHL, our DB picks it up.

async function syncStage(
  pipelineId: string,
  stageId: string,
  pipelineName: string,
  stageName: string,
  apiPath: string,
) {
  const oRes = await apiFetch(`/api/ghl/opportunities?pipeline_id=${pipelineId}`);
  const oData = await oRes.json();
  if (oData.error) throw new Error(oData.error);
  const allOpps: GHLOpportunity[] = oData.opportunities || [];

  // 1. Upsert records currently in the target stage (new leads + updates)
  const stageOpps = allOpps.filter((o) => o.pipelineStageId === stageId);
  if (stageOpps.length > 0) {
    const sRes = await apiFetch(apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stageOpps.map((opp) => ({
        opportunity_id: opp.id,
        contact_name: opp.contact?.name || opp.name || "",
        contact_email: opp.contact?.email || "",
        contact_phone: opp.contact?.phone || "",
        pipeline_name: pipelineName,
        stage_name: stageName,
        source: opp.source || "",
        assigned_to: opp.assignedTo || "",
        ghl_status: opp.status || "",
        pipeline_id: pipelineId,
        contact_id: opp.contactId || opp.contact?.id || "",
      }))),
    });
    const sData = await sRes.json();
    if (sData.error) throw new Error(sData.error);
  }

  // 2. For leads that moved OUT of this stage: update ghl_status + assigned_to
  // so that status changes made directly in GHL (e.g. won, lost) propagate.
  // First fetch existing records to know which ones to update.
  const existingRes = await apiFetch(apiPath);
  const existingData = await existingRes.json();
  const existingRecords: { opportunity_id: string; ghl_status: string; assigned_to: string }[] = existingData.records || [];

  // Build a lookup of current GHL state for all pipeline opportunities
  const ghlLookup: Record<string, { status: string; assignedTo: string }> = {};
  allOpps.forEach((opp) => {
    ghlLookup[opp.id] = { status: opp.status || "open", assignedTo: opp.assignedTo || "" };
  });

  // Find existing records whose ghl_status or assigned_to is stale
  const staleRecords = existingRecords.filter((rec) => {
    const ghl = ghlLookup[rec.opportunity_id];
    if (!ghl) return false; // opportunity no longer in pipeline
    return rec.ghl_status !== ghl.status || rec.assigned_to !== ghl.assignedTo;
  });

  // Update stale records in parallel (batches of 10)
  for (let i = 0; i < staleRecords.length; i += 10) {
    const batch = staleRecords.slice(i, i + 10);
    await Promise.all(
      batch.map((rec) => {
        const ghl = ghlLookup[rec.opportunity_id];
        return apiFetch(apiPath, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            opportunity_id: rec.opportunity_id,
            ghl_status: ghl.status,
            assigned_to: ghl.assignedTo,
          }),
        }).catch(() => null);
      })
    );
  }
}

/* ── Main Component ────────────────────────────────── */

export default function SalesSettingPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("optins");
  const [error, setError] = useState("");

  // Pipeline (shared)
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState("");

  // Opt-in state
  const [optinLoading, setOptinLoading] = useState(true);
  const [optinSyncing, setOptinSyncing] = useState(false);
  const [optinRecords, setOptinRecords] = useState<TrackingRecord[]>([]);
  const [optinSearch, setOptinSearch] = useState("");
  const [optinStatusFilter, setOptinStatusFilter] = useState<string>("all");
  const [optinFilterOpen, setOptinFilterOpen] = useState(false);
  const [optinEditCell, setOptinEditCell] = useState<{ oppId: string; field: string } | null>(null);
  const [optinEditValue, setOptinEditValue] = useState("");

  // Payment done state
  const [pdLoading, setPdLoading] = useState(true);
  const [pdSyncing, setPdSyncing] = useState(false);
  const [pdRecords, setPdRecords] = useState<TrackingRecord[]>([]);
  const [pdSearch, setPdSearch] = useState("");
  const [pdStatusFilter, setPdStatusFilter] = useState<string>("all");
  const [pdFilterOpen, setPdFilterOpen] = useState(false);
  const [pdEditCell, setPdEditCell] = useState<{ oppId: string; field: string } | null>(null);
  const [pdEditValue, setPdEditValue] = useState("");

  // Call booked state
  const [cbLoading, setCbLoading] = useState(true);
  const [cbSyncing, setCbSyncing] = useState(false);
  const [cbRecords, setCbRecords] = useState<TrackingRecord[]>([]);
  const [cbSearch, setCbSearch] = useState("");
  const [cbStatusFilter, setCbStatusFilter] = useState<string>("all");
  const [cbFilterOpen, setCbFilterOpen] = useState(false);
  const [cbEditCell, setCbEditCell] = useState<{ oppId: string; field: string } | null>(null);
  const [cbEditValue, setCbEditValue] = useState("");

  // Load pipelines
  useEffect(() => {
    apiFetch("/api/ghl/pipelines")
      .then((r) => r.json())
      .then((data) => {
        if (data.pipelines?.length > 0) {
          setPipelines(data.pipelines);
          setSelectedPipeline(data.pipelines[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const currentPipeline = pipelines.find((p) => p.id === selectedPipeline);

  // Find stages
  const findStage = (keywords: string[]) =>
    currentPipeline?.stages.find((s) => keywords.some((k) => s.name.toLowerCase().includes(k)));

  const optInStage = findStage(["opt in", "optin"]);
  const paymentDoneStage = findStage(["payment done", "payment_done"]);
  const callBookedStage = findStage(["call booked", "call_booked"]);

  /* ── Data loaders ── */

  const loadOptinRecords = useCallback(async () => {
    try { const r = await apiFetch("/api/sales/optin-tracking"); const d = await r.json(); if (!d.error) setOptinRecords(d.records || []); } catch {}
  }, []);

  const loadPdRecords = useCallback(async () => {
    try { const r = await apiFetch("/api/sales/payment-done-tracking"); const d = await r.json(); if (!d.error) setPdRecords(d.records || []); } catch {}
  }, []);

  const loadCbRecords = useCallback(async () => {
    try { const r = await apiFetch("/api/sales/call-booked-tracking"); const d = await r.json(); if (!d.error) setCbRecords(d.records || []); } catch {}
  }, []);

  useEffect(() => {
    Promise.all([loadOptinRecords(), loadPdRecords(), loadCbRecords()]).finally(() => {
      setOptinLoading(false); setPdLoading(false); setCbLoading(false);
    });
  }, [loadOptinRecords, loadPdRecords, loadCbRecords]);

  /* ── Sync handlers ── */

  const makeSyncHandler = (
    stage: { id: string; name: string } | undefined,
    stageName: string,
    apiPath: string,
    setSyncing: (v: boolean) => void,
    loadRecords: () => Promise<void>,
  ) => async () => {
    if (!currentPipeline || !stage) {
      setError(stage ? "Select a pipeline" : `No "${stageName}" stage found. Stages: ${currentPipeline?.stages.map((s) => s.name).join(", ")}`);
      return;
    }
    setSyncing(true); setError("");
    try {
      await syncStage(selectedPipeline, stage.id, currentPipeline.name, stage.name, apiPath);
      await loadRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const syncOptins = useCallback(makeSyncHandler(optInStage, "Opt In", "/api/sales/optin-tracking", setOptinSyncing, loadOptinRecords), [selectedPipeline, currentPipeline, optInStage, loadOptinRecords]);
  const syncPd = useCallback(makeSyncHandler(paymentDoneStage, "Payment Done", "/api/sales/payment-done-tracking", setPdSyncing, loadPdRecords), [selectedPipeline, currentPipeline, paymentDoneStage, loadPdRecords]);
  const syncCb = useCallback(makeSyncHandler(callBookedStage, "Call Booked", "/api/sales/call-booked-tracking", setCbSyncing, loadCbRecords), [selectedPipeline, currentPipeline, callBookedStage, loadCbRecords]);

  /* ── Update handlers ── */

  const makeUpdateHandler = (apiPath: string, setRecords: React.Dispatch<React.SetStateAction<TrackingRecord[]>>) =>
    async (oppId: string, updates: Record<string, unknown>) => {
      try {
        const res = await apiFetch(apiPath, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunity_id: oppId, ...updates }) });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setRecords((prev) => prev.map((r) => r.opportunity_id === oppId ? { ...r, ...updates } as TrackingRecord : r));
      } catch (err) { console.error("Update failed:", err); }
    };

  const updateOptin = makeUpdateHandler("/api/sales/optin-tracking", setOptinRecords);
  const updatePd = makeUpdateHandler("/api/sales/payment-done-tracking", setPdRecords);
  const updateCb = makeUpdateHandler("/api/sales/call-booked-tracking", setCbRecords);

  /* ── Filtering ── */

  const filterRecords = (records: TrackingRecord[], statusFilter: string, search: string) =>
    records.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.contact_name?.toLowerCase().includes(q) || r.contact_email?.toLowerCase().includes(q) || r.contact_phone?.toLowerCase().includes(q) || r.source?.toLowerCase().includes(q);
      }
      return true;
    });

  const countStatuses = (records: TrackingRecord[], statuses: string[]) =>
    statuses.reduce((a, s) => { a[s] = records.filter((r) => r.status === s).length; return a; }, {} as Record<string, number>);

  const filteredOptins = filterRecords(optinRecords, optinStatusFilter, optinSearch);
  const filteredPd = filterRecords(pdRecords, pdStatusFilter, pdSearch);
  const filteredCb = filterRecords(cbRecords, cbStatusFilter, cbSearch);

  const optinCounts = countStatuses(optinRecords, ALL_OPTIN_STATUSES);
  const pdCounts = countStatuses(pdRecords, ALL_PD_STATUSES);
  const cbCounts = countStatuses(cbRecords, ALL_CB_STATUSES);

  // Tab-aware header
  const tabConfig = {
    optins: { syncing: optinSyncing, stage: optInStage, sync: syncOptins, label: "Sync Opt Ins" },
    payment_done: { syncing: pdSyncing, stage: paymentDoneStage, sync: syncPd, label: "Sync Payment Done" },
    call_booked: { syncing: cbSyncing, stage: callBookedStage, sync: syncCb, label: "Sync Call Booked" },
  };
  const active = tabConfig[activeTab];

  return (
    <Shell>
    <div className="flex flex-col h-[calc(100vh-48px)] overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex-shrink-0 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Sales Setting</h1>
              <p className="text-muted text-sm mt-0.5">Track opt-ins, payments, and call bookings</p>
            </div>
            {pipelines.length > 0 && (
              <select value={selectedPipeline} onChange={(e) => setSelectedPipeline(e.target.value)} className="px-3 py-1.5 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent">
                {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            {active.stage && (
              <span className="text-[10px] px-2 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">Stage: {active.stage.name}</span>
            )}
          </div>
          <button onClick={active.sync} disabled={active.syncing} className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-lg transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${active.syncing ? "animate-spin" : ""}`} />
            {active.syncing ? "Syncing..." : active.label}
          </button>
        </div>
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "text-accent border-accent" : "text-muted border-transparent hover:text-foreground"}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mx-6 mt-3 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</div>}

      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === "optins" && (
          <TrackingSheet loading={optinLoading} records={filteredOptins} totalCount={optinRecords.length} statusConfig={OPTIN_STATUS_CONFIG} allStatuses={ALL_OPTIN_STATUSES} statusCounts={optinCounts}
            searchQuery={optinSearch} setSearchQuery={setOptinSearch} statusFilter={optinStatusFilter} setStatusFilter={setOptinStatusFilter}
            showFilterDropdown={optinFilterOpen} setShowFilterDropdown={setOptinFilterOpen}
            editingCell={optinEditCell} setEditingCell={setOptinEditCell} editValue={optinEditValue} setEditValue={setOptinEditValue}
            updateRecord={updateOptin} emptyMessage='No opt-in records yet. Select your pipeline and click "Sync Opt Ins" to import.' />
        )}
        {activeTab === "payment_done" && (
          <TrackingSheet loading={pdLoading} records={filteredPd} totalCount={pdRecords.length} statusConfig={PD_STATUS_CONFIG} allStatuses={ALL_PD_STATUSES} statusCounts={pdCounts}
            searchQuery={pdSearch} setSearchQuery={setPdSearch} statusFilter={pdStatusFilter} setStatusFilter={setPdStatusFilter}
            showFilterDropdown={pdFilterOpen} setShowFilterDropdown={setPdFilterOpen}
            editingCell={pdEditCell} setEditingCell={setPdEditCell} editValue={pdEditValue} setEditValue={setPdEditValue}
            updateRecord={updatePd} emptyMessage='No payment done records. Click "Sync Payment Done" to import.' showCallScheduled />
        )}
        {activeTab === "call_booked" && (
          <TrackingSheet loading={cbLoading} records={filteredCb} totalCount={cbRecords.length} statusConfig={CB_STATUS_CONFIG} allStatuses={ALL_CB_STATUSES} statusCounts={cbCounts}
            searchQuery={cbSearch} setSearchQuery={setCbSearch} statusFilter={cbStatusFilter} setStatusFilter={setCbStatusFilter}
            showFilterDropdown={cbFilterOpen} setShowFilterDropdown={setCbFilterOpen}
            editingCell={cbEditCell} setEditingCell={setCbEditCell} editValue={cbEditValue} setEditValue={setCbEditValue}
            updateRecord={updateCb} emptyMessage='No call booked records. Click "Sync Call Booked" to import.' showRating showComments />
        )}
      </div>
    </div>
    </Shell>
  );
}

/* ── Reusable Tracking Sheet ─────────────────────────── */

function TrackingSheet({
  loading, records, totalCount, statusConfig, allStatuses, statusCounts,
  searchQuery, setSearchQuery, statusFilter, setStatusFilter,
  showFilterDropdown, setShowFilterDropdown,
  editingCell, setEditingCell, editValue, setEditValue,
  updateRecord, emptyMessage,
  showCallScheduled, showRating, showComments,
}: {
  loading: boolean; records: TrackingRecord[]; totalCount: number;
  statusConfig: StatusCfg; allStatuses: string[]; statusCounts: Record<string, number>;
  searchQuery: string; setSearchQuery: (v: string) => void;
  statusFilter: string; setStatusFilter: (v: string) => void;
  showFilterDropdown: boolean; setShowFilterDropdown: (v: boolean) => void;
  editingCell: { oppId: string; field: string } | null; setEditingCell: (v: { oppId: string; field: string } | null) => void;
  editValue: string; setEditValue: (v: string) => void;
  updateRecord: (oppId: string, updates: Record<string, unknown>) => void;
  emptyMessage: string;
  showCallScheduled?: boolean; showRating?: boolean; showComments?: boolean;
}) {
  const COLUMNS = [
    { key: "sno", label: "#", width: "w-12" },
    { key: "contact_name", label: "Contact Name", width: "w-44" },
    { key: "contact_email", label: "Email", width: "w-48" },
    { key: "contact_phone", label: "Phone", width: "w-36" },
    { key: "source", label: "Source", width: "w-32" },
    { key: "status", label: "Status", width: "w-40" },
    ...(showRating ? [{ key: "rating", label: "Rating", width: "w-28" }] : []),
    ...(showComments ? [{ key: "comments", label: "Comments", width: "w-52" }] : []),
    { key: "notes", label: "Notes", width: "w-48" },
    ...(showCallScheduled ? [{ key: "call_scheduled_at", label: "Call Scheduled", width: "w-36" }] : []),
    { key: "last_contacted_at", label: "Last Contacted", width: "w-36" },
    { key: "actions", label: "Actions", width: "w-24" },
  ];

  function startEdit(oppId: string, field: string, currentValue: string) {
    setEditingCell({ oppId, field }); setEditValue(currentValue || "");
  }
  function commitEdit() {
    if (editingCell) { updateRecord(editingCell.oppId, { [editingCell.field]: editValue }); setEditingCell(null); setEditValue(""); }
  }
  function cancelEdit() { setEditingCell(null); setEditValue(""); }

  if (loading) return <div className="p-6 space-y-4"><SettingsSkeleton /></div>;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Toolbar */}
      <div className="px-6 py-3 flex items-center gap-3 flex-shrink-0 border-b border-border bg-surface/50">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input type="text" placeholder="Search by name, email, phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent placeholder:text-muted/50" />
        </div>
        <div className="relative">
          <button onClick={() => setShowFilterDropdown(!showFilterDropdown)} className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-foreground hover:border-accent/30 transition-colors">
            <Filter className="w-3.5 h-3.5 text-muted" />
            {statusFilter === "all" ? "All Statuses" : statusConfig[statusFilter]?.label}
            <ChevronDown className="w-3 h-3 text-muted" />
          </button>
          {showFilterDropdown && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-surface border border-border rounded-lg shadow-xl z-20 py-1">
              <button onClick={() => { setStatusFilter("all"); setShowFilterDropdown(false); }} className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${statusFilter === "all" ? "text-accent bg-accent/5" : "text-foreground hover:bg-surface-hover"}`}>
                All Statuses ({totalCount})
              </button>
              {allStatuses.map((s) => (
                <button key={s} onClick={() => { setStatusFilter(s); setShowFilterDropdown(false); }}
                  className={`w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center justify-between ${statusFilter === s ? "text-accent bg-accent/5" : "text-foreground hover:bg-surface-hover"}`}>
                  <span className={statusConfig[s].color}>{statusConfig[s].label}</span>
                  <span className="text-muted text-xs">{statusCounts[s] || 0}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="text-xs text-muted ml-auto">Showing {records.length} of {totalCount}</span>
      </div>

      {/* Status Pills */}
      <div className="px-6 py-2 flex gap-2 flex-wrap flex-shrink-0 border-b border-border">
        {allStatuses.map((s) => (
          <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
            className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-colors ${statusFilter === s ? statusConfig[s].bg + " " + statusConfig[s].color : "border-border text-muted hover:border-border/80"}`}>
            {statusConfig[s].label}
            <span>{statusCounts[s] || 0}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse min-w-[1100px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface border-b border-border">
              {COLUMNS.map((col) => (
                <th key={col.key} className={`${col.width} text-left text-[11px] font-semibold text-muted uppercase tracking-wider px-3 py-2.5 border-r border-border last:border-r-0`}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={COLUMNS.length} className="text-center py-16 text-muted text-sm">{totalCount === 0 ? emptyMessage : "No records match your filters."}</td></tr>
            ) : records.map((record, idx) => (
              <tr key={record.opportunity_id} className="border-b border-border hover:bg-surface-hover/50 transition-colors group">
                <td className="px-3 py-2 text-xs text-muted border-r border-border">{idx + 1}</td>
                <td className="px-3 py-2 text-xs text-foreground font-medium border-r border-border">{record.contact_name || "-"}</td>
                <td className="px-3 py-2 text-xs text-foreground border-r border-border">
                  {record.contact_email ? <a href={`mailto:${record.contact_email}`} className="hover:text-accent transition-colors">{record.contact_email}</a> : <span className="text-muted">-</span>}
                </td>
                <td className="px-3 py-2 text-xs text-foreground border-r border-border">
                  {record.contact_phone ? <a href={`tel:${record.contact_phone}`} className="hover:text-accent transition-colors">{record.contact_phone}</a> : <span className="text-muted">-</span>}
                </td>
                <td className="px-3 py-2 text-xs text-foreground border-r border-border">{record.source || "-"}</td>
                <td className="px-2 py-1.5 border-r border-border">
                  <StatusDropdown current={record.status} statusConfig={statusConfig} allStatuses={allStatuses} onChange={(s) => updateRecord(record.opportunity_id, { status: s })} />
                </td>

                {/* Rating (stars) */}
                {showRating && (
                  <td className="px-2 py-1.5 border-r border-border">
                    <RatingStars value={record.rating || 0} onChange={(v) => updateRecord(record.opportunity_id, { rating: v })} />
                  </td>
                )}

                {/* Comments (editable) */}
                {showComments && (
                  <td className="px-3 py-2 text-xs border-r border-border cursor-pointer" onClick={() => startEdit(record.opportunity_id, "comments", record.comments || "")}>
                    {editingCell?.oppId === record.opportunity_id && editingCell?.field === "comments" ? (
                      <input autoFocus type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                        className="w-full bg-background border border-accent rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none" />
                    ) : (
                      <span className={record.comments ? "text-foreground" : "text-muted/40 italic"}>{record.comments || "Click to add..."}</span>
                    )}
                  </td>
                )}

                {/* Notes (editable) */}
                <td className="px-3 py-2 text-xs border-r border-border cursor-pointer" onClick={() => startEdit(record.opportunity_id, "notes", record.notes || "")}>
                  {editingCell?.oppId === record.opportunity_id && editingCell?.field === "notes" ? (
                    <input autoFocus type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit}
                      onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                      className="w-full bg-background border border-accent rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none" />
                  ) : (
                    <span className={record.notes ? "text-foreground" : "text-muted/40 italic"}>{record.notes || "Click to add..."}</span>
                  )}
                </td>

                {showCallScheduled && (
                  <td className="px-3 py-2 text-xs text-muted border-r border-border">
                    {record.call_scheduled_at ? new Date(record.call_scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-"}
                  </td>
                )}
                <td className="px-3 py-2 text-xs text-muted border-r border-border">
                  {record.last_contacted_at ? new Date(record.last_contacted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {record.contact_phone && <a href={`tel:${record.contact_phone}`} className="p-1 rounded hover:bg-green-500/10 text-muted hover:text-green-400 transition-colors" title="Call"><Phone className="w-3.5 h-3.5" /></a>}
                    {record.contact_email && <a href={`mailto:${record.contact_email}`} className="p-1 rounded hover:bg-blue-500/10 text-muted hover:text-blue-400 transition-colors" title="Email"><Mail className="w-3.5 h-3.5" /></a>}
                    {record.contact_phone && <a href={`https://wa.me/${record.contact_phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-green-500/10 text-muted hover:text-green-400 transition-colors" title="WhatsApp"><MessageSquare className="w-3.5 h-3.5" /></a>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Rating Stars ─────────────────────────────────────── */

function RatingStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onChange(star === value ? 0 : star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="p-0 transition-colors"
        >
          <Star
            className={`w-3.5 h-3.5 ${
              star <= (hover || value)
                ? "text-yellow-400 fill-yellow-400"
                : "text-muted/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

/* ── Status Dropdown ─────────────────────────────────── */

function StatusDropdown({ current, statusConfig, allStatuses, onChange }: {
  current: string; statusConfig: StatusCfg; allStatuses: string[]; onChange: (status: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const config = statusConfig[current] || { label: current, color: "text-muted", bg: "bg-surface border-border" };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className={`w-full flex items-center justify-between gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md border ${config.bg} ${config.color} transition-colors`}>
        {config.label}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-44 bg-surface border border-border rounded-lg shadow-xl z-30 py-1">
            {allStatuses.map((s) => (
              <button key={s} onClick={() => { onChange(s); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${current === s ? "bg-accent/5 font-medium" : "hover:bg-surface-hover"} ${statusConfig[s].color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[s].color.replace("text-", "bg-")}`} />
                {statusConfig[s].label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
