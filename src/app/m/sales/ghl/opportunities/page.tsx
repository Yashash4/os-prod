"use client";

import { useEffect, useState, useRef } from "react";
import {
  Loader2,
  X,
  User,
  Mail,
  Phone,
  Briefcase,
  Tag,
  DollarSign,
  Globe,
  Users,
  Calendar,
  FileText,
  CheckSquare,
  CreditCard,
  Link2,
  PhoneCall,
  Video,
  BarChart3,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────── */

interface Pipeline {
  id: string;
  name: string;
  stages: { id: string; name: string }[];
}

interface Opportunity {
  id: string;
  name: string;
  status: string;
  monetaryValue: number;
  pipelineStageId: string;
  pipelineId?: string;
  source?: string;
  assignedTo?: string;
  lastStatusChangeAt?: string;
  lastStageChangeAt?: string;
  followers?: string[];
  contactId?: string;
  contact?: {
    id?: string;
    name: string;
    email: string;
    phone?: string;
    tags?: string[];
  };
  createdAt?: string;
  updatedAt?: string;
}

interface ContactDetail {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  country?: string;
  timezone?: string;
  type?: string;
  dnd?: boolean;
  customFields?: { id: string; value: string }[];
}

interface NoteItem {
  id: string;
  body: string;
  createdAt?: string;
  userId?: string;
}

interface TaskItem {
  id: string;
  title?: string;
  body?: string;
  status?: string;
  dueDate?: string;
  assignedTo?: string;
  completed?: boolean;
}

type ModalTab =
  | "opportunity"
  | "contact_status"
  | "call_status"
  | "meet_status"
  | "conversion_status"
  | "appointment"
  | "tasks"
  | "notes"
  | "payments"
  | "associated";

const MODAL_TABS: { key: ModalTab; label: string }[] = [
  { key: "opportunity", label: "Opportunity Details" },
  { key: "contact_status", label: "Contact Status" },
  { key: "call_status", label: "Call Status" },
  { key: "meet_status", label: "Meet Status" },
  { key: "conversion_status", label: "Conversion Status" },
  { key: "appointment", label: "Book/Update Appointment" },
  { key: "tasks", label: "Tasks" },
  { key: "notes", label: "Notes" },
  { key: "payments", label: "Payments" },
  { key: "associated", label: "Associated Objects" },
];

/* ── Main Component ────────────────────────────────── */

export default function OpportunitiesPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Detail modal
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [modalTab, setModalTab] = useState<ModalTab>("opportunity");
  const [contactDetail, setContactDetail] = useState<ContactDetail | null>(
    null
  );
  const [contactLoading, setContactLoading] = useState(false);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Users
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/ghl/pipelines").then((r) => r.json()),
      fetch("/api/ghl/users").then((r) => r.json()),
    ])
      .then(([pData, uData]) => {
        if (pData.error) throw new Error(pData.error);
        setPipelines(pData.pipelines || []);
        setUsers(uData.users || []);
        if (pData.pipelines?.length > 0) {
          setSelectedPipeline(pData.pipelines[0].id);
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load")
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedPipeline) return;
    fetch(`/api/ghl/opportunities?pipeline_id=${selectedPipeline}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setOpportunities(data.opportunities || []);
      })
      .catch((err) => console.error("Failed to fetch opportunities:", err));
  }, [selectedPipeline]);

  // Fetch contact + notes + tasks when opp is selected
  useEffect(() => {
    if (!selectedOpp) {
      setContactDetail(null);
      setNotes([]);
      setTasks([]);
      return;
    }

    const cid = selectedOpp.contact?.id || selectedOpp.contactId;
    if (!cid) return;

    // Contact
    setContactLoading(true);
    fetch(`/api/ghl/contacts?contactId=${cid}`)
      .then((r) => r.json())
      .then((d) => d.contact && setContactDetail(d.contact))
      .catch(() => {})
      .finally(() => setContactLoading(false));

    // Notes
    setNotesLoading(true);
    fetch(`/api/ghl/contacts/notes?contactId=${cid}`)
      .then((r) => r.json())
      .then((d) => setNotes(d.notes || []))
      .catch(() => {})
      .finally(() => setNotesLoading(false));

    // Tasks
    setTasksLoading(true);
    fetch(`/api/ghl/contacts/tasks?contactId=${cid}`)
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks || []))
      .catch(() => {})
      .finally(() => setTasksLoading(false));
  }, [selectedOpp]);

  const userNameMap: Record<string, string> = {};
  users.forEach((u) => {
    userNameMap[u.id] = u.name;
  });

  const currentPipeline = pipelines.find((p) => p.id === selectedPipeline);
  const stages = currentPipeline?.stages || [];

  const stageOpps = stages.map((stage) => ({
    ...stage,
    opportunities: opportunities.filter((o) => o.pipelineStageId === stage.id),
    totalValue: opportunities
      .filter((o) => o.pipelineStageId === stage.id)
      .reduce((sum, o) => sum + (o.monetaryValue || 0), 0),
  }));

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  function getStageName(stageId: string) {
    return stages.find((s) => s.id === stageId)?.name || "-";
  }

  function openOpp(opp: Opportunity) {
    setSelectedOpp(opp);
    setModalTab("opportunity");
  }

  const contactName =
    contactDetail?.name ||
    (contactDetail
      ? `${contactDetail.firstName || ""} ${contactDetail.lastName || ""}`.trim()
      : selectedOpp?.contact?.name || "-");

  /* ── Render ──────────────────────────────────────── */

  return (
    <div className="px-4 pt-4 pb-2 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Opportunities
            </h1>
            <p className="text-muted text-sm mt-0.5">Pipeline and deals</p>
          </div>
          {pipelines.length > 0 && (
            <select
              value={selectedPipeline}
              onChange={(e) => setSelectedPipeline(e.target.value)}
              className="px-3 py-1.5 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <span className="text-sm text-accent">
            {opportunities.length} opportunities
          </span>
          <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Read Only
          </span>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      )}

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Kanban Board */}
      {!loading && !error && (
        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden">
          <div
            className="flex gap-3 h-full"
            style={{ minWidth: `${stages.length * 280}px` }}
          >
            {stageOpps.map((stage) => (
              <div
                key={stage.id}
                className="w-[270px] flex-shrink-0 flex flex-col"
              >
                <div className="bg-surface border border-border rounded-t-lg px-3 py-2.5 flex-shrink-0">
                  <h3 className="text-sm font-medium text-foreground">
                    {stage.name}
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    {stage.opportunities.length} Opportunities&nbsp;&nbsp;₹
                    {stage.totalValue.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="flex-1 space-y-2 pt-2 overflow-y-auto">
                  {stage.opportunities.map((opp) => (
                    <div
                      key={opp.id}
                      onClick={() => openOpp(opp)}
                      className="bg-surface border border-border rounded-lg p-3 hover:border-accent/30 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-sm font-medium text-foreground leading-tight">
                          {opp.name}
                        </h4>
                        <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 ml-2">
                          <span className="text-[10px] font-bold text-accent">
                            {getInitials(opp.contact?.name || opp.name)}
                          </span>
                        </div>
                      </div>
                      {opp.source && (
                        <p className="text-xs text-muted mb-1">
                          <span className="text-muted/70">Source:</span>{" "}
                          {opp.source}
                        </p>
                      )}
                      <p className="text-xs text-muted">
                        <span className="text-muted/70">Value:</span> ₹
                        {(opp.monetaryValue || 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                  ))}
                  {stage.opportunities.length === 0 && (
                    <div className="text-center py-8 text-muted text-xs">
                      No opportunities
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Detail Modal ────────────────────────────── */}
      {selectedOpp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setSelectedOpp(null)}
        >
          <div
            className="bg-surface border border-border rounded-xl w-full max-w-4xl h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {selectedOpp.name}
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  View opportunity details, notes and appointments
                </p>
              </div>
              <button
                onClick={() => setSelectedOpp(null)}
                className="p-1.5 hover:bg-surface-hover rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            {/* Modal Body: Sidebar + Content */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left Sidebar Nav */}
              <div className="w-48 border-r border-border flex-shrink-0 overflow-y-auto py-2">
                {MODAL_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setModalTab(tab.key)}
                    className={`w-full text-left px-4 py-2 text-xs transition-colors ${
                      modalTab === tab.key
                        ? "text-accent bg-accent/5 border-l-2 border-accent font-medium"
                        : "text-muted hover:text-foreground hover:bg-surface-hover border-l-2 border-transparent"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Right Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* ── Opportunity Details Tab ── */}
                {modalTab === "opportunity" && (
                  <div>
                    {/* Contact Details */}
                    <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      Contact Details
                    </h3>
                    {contactLoading ? (
                      <div className="flex items-center gap-2 py-3">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                        <span className="text-xs text-muted">Loading...</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 mb-6">
                        <FieldBox
                          icon={<User className="w-3.5 h-3.5" />}
                          label="Primary Contact Name"
                          value={contactName}
                        />
                        <FieldBox
                          icon={<Mail className="w-3.5 h-3.5" />}
                          label="Primary Email"
                          value={
                            contactDetail?.email ||
                            selectedOpp.contact?.email ||
                            "-"
                          }
                        />
                        <FieldBox
                          icon={<Phone className="w-3.5 h-3.5" />}
                          label="Primary Phone"
                          value={
                            contactDetail?.phone ||
                            selectedOpp.contact?.phone ||
                            "-"
                          }
                        />
                        <FieldBox
                          icon={<Users className="w-3.5 h-3.5" />}
                          label="Additional Contacts (Max: 10)"
                          value="-"
                        />
                      </div>
                    )}

                    {/* Opportunity Details */}
                    <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                      Opportunity Details
                    </h3>
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <FieldBox
                        icon={<Briefcase className="w-3.5 h-3.5" />}
                        label="Opportunity Name"
                        value={selectedOpp.name}
                      />
                      <FieldBox
                        icon={<Briefcase className="w-3.5 h-3.5" />}
                        label="Pipeline"
                        value={currentPipeline?.name || "-"}
                      />
                      <FieldBox
                        icon={<Briefcase className="w-3.5 h-3.5" />}
                        label="Stage"
                        value={getStageName(selectedOpp.pipelineStageId)}
                      />
                      <FieldBox
                        icon={<BarChart3 className="w-3.5 h-3.5" />}
                        label="Status"
                        value={selectedOpp.status || "-"}
                        statusColor={
                          selectedOpp.status === "open"
                            ? "text-green-400"
                            : selectedOpp.status === "won"
                              ? "text-blue-400"
                              : selectedOpp.status === "lost"
                                ? "text-red-400"
                                : ""
                        }
                      />
                      <FieldBox
                        icon={<DollarSign className="w-3.5 h-3.5" />}
                        label="Opportunity Value"
                        value={`₹ ${(selectedOpp.monetaryValue || 0).toLocaleString("en-IN")}`}
                      />
                      <FieldBox
                        icon={<Users className="w-3.5 h-3.5" />}
                        label="Owner"
                        value={
                          selectedOpp.assignedTo
                            ? userNameMap[selectedOpp.assignedTo] ||
                              selectedOpp.assignedTo
                            : "-"
                        }
                      />
                      <FieldBox
                        icon={<Users className="w-3.5 h-3.5" />}
                        label="Followers"
                        value={
                          selectedOpp.followers?.length
                            ? selectedOpp.followers
                                .map((f) => userNameMap[f] || f)
                                .join(", ")
                            : "-"
                        }
                      />
                      <FieldBox
                        icon={<Briefcase className="w-3.5 h-3.5" />}
                        label="Business Name"
                        value="-"
                      />
                      <FieldBox
                        icon={<Globe className="w-3.5 h-3.5" />}
                        label="Opportunity Source"
                        value={selectedOpp.source || "-"}
                      />
                    </div>

                    {/* Tags */}
                    {contactDetail?.tags && contactDetail.tags.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                          Tags
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                          {contactDetail.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/20"
                            >
                              <Tag className="w-2.5 h-2.5" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    {selectedOpp.createdAt && (
                      <div className="pt-4 border-t border-border">
                        <p className="text-[11px] text-muted">
                          Created on:{" "}
                          {new Date(selectedOpp.createdAt).toLocaleDateString(
                            "en-IN",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}{" "}
                          (IST)
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Contact Status Tab ── */}
                {modalTab === "contact_status" && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">
                      Contact Status
                    </h3>
                    {contactLoading ? (
                      <LoadingSpinner />
                    ) : contactDetail ? (
                      <div className="grid grid-cols-2 gap-3">
                        <FieldBox
                          icon={<User className="w-3.5 h-3.5" />}
                          label="Contact Name"
                          value={contactName}
                        />
                        <FieldBox
                          icon={<Globe className="w-3.5 h-3.5" />}
                          label="Type"
                          value={contactDetail.type || "lead"}
                        />
                        <FieldBox
                          icon={<Globe className="w-3.5 h-3.5" />}
                          label="Country"
                          value={contactDetail.country || "-"}
                        />
                        <FieldBox
                          icon={<Globe className="w-3.5 h-3.5" />}
                          label="Timezone"
                          value={contactDetail.timezone || "-"}
                        />
                        <FieldBox
                          icon={<Phone className="w-3.5 h-3.5" />}
                          label="DND Status"
                          value={contactDetail.dnd ? "Enabled" : "Disabled"}
                          statusColor={
                            contactDetail.dnd
                              ? "text-red-400"
                              : "text-green-400"
                          }
                        />
                      </div>
                    ) : (
                      <EmptyState text="No contact data available" />
                    )}
                  </div>
                )}

                {/* ── Call Status Tab ── */}
                {modalTab === "call_status" && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">
                      Call Status
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <FieldBox
                        icon={<PhoneCall className="w-3.5 h-3.5" />}
                        label="Last Call Status"
                        value={"-"}
                      />
                      <FieldBox
                        icon={<PhoneCall className="w-3.5 h-3.5" />}
                        label="Total Calls"
                        value={"-"}
                      />
                    </div>
                    <p className="text-[11px] text-muted mt-4">
                      Call history data from GHL conversations
                    </p>
                  </div>
                )}

                {/* ── Meet Status Tab ── */}
                {modalTab === "meet_status" && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">
                      Meet Status
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <FieldBox
                        icon={<Video className="w-3.5 h-3.5" />}
                        label="Meeting Status"
                        value={"-"}
                      />
                      <FieldBox
                        icon={<Calendar className="w-3.5 h-3.5" />}
                        label="Last Meeting"
                        value={"-"}
                      />
                    </div>
                  </div>
                )}

                {/* ── Conversion Status Tab ── */}
                {modalTab === "conversion_status" && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">
                      Conversion Status
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <FieldBox
                        icon={<BarChart3 className="w-3.5 h-3.5" />}
                        label="Opportunity Status"
                        value={selectedOpp.status || "-"}
                        statusColor={
                          selectedOpp.status === "open"
                            ? "text-green-400"
                            : selectedOpp.status === "won"
                              ? "text-blue-400"
                              : "text-red-400"
                        }
                      />
                      <FieldBox
                        icon={<BarChart3 className="w-3.5 h-3.5" />}
                        label="Current Stage"
                        value={getStageName(selectedOpp.pipelineStageId)}
                      />
                      <FieldBox
                        icon={<Calendar className="w-3.5 h-3.5" />}
                        label="Last Status Change"
                        value={
                          selectedOpp.lastStatusChangeAt
                            ? new Date(
                                selectedOpp.lastStatusChangeAt
                              ).toLocaleDateString("en-IN", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"
                        }
                      />
                      <FieldBox
                        icon={<Calendar className="w-3.5 h-3.5" />}
                        label="Last Stage Change"
                        value={
                          selectedOpp.lastStageChangeAt
                            ? new Date(
                                selectedOpp.lastStageChangeAt
                              ).toLocaleDateString("en-IN", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"
                        }
                      />
                    </div>
                  </div>
                )}

                {/* ── Book/Update Appointment Tab ── */}
                {modalTab === "appointment" && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">
                      Appointment
                    </h3>
                    <EmptyState text="View appointments in the Calendar page" />
                    <p className="text-[11px] text-muted text-center mt-2">
                      Calendar is read-only. Go to{" "}
                      <a
                        href="/m/sales/ghl/calendar"
                        className="text-accent hover:underline"
                      >
                        GHL &gt; Calendar
                      </a>{" "}
                      to view appointments.
                    </p>
                  </div>
                )}

                {/* ── Tasks Tab ── */}
                {modalTab === "tasks" && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">
                      Tasks
                    </h3>
                    {tasksLoading ? (
                      <LoadingSpinner />
                    ) : tasks.length === 0 ? (
                      <EmptyState text="No tasks found for this contact" />
                    ) : (
                      <div className="space-y-2">
                        {tasks.map((task) => (
                          <div
                            key={task.id}
                            className="bg-background border border-border rounded-lg p-3"
                          >
                            <div className="flex items-start gap-2">
                              <CheckSquare
                                className={`w-4 h-4 mt-0.5 flex-shrink-0 ${task.completed ? "text-green-400" : "text-muted"}`}
                              />
                              <div>
                                <p className="text-xs font-medium text-foreground">
                                  {task.title || task.body || "Untitled task"}
                                </p>
                                {task.dueDate && (
                                  <p className="text-[11px] text-muted mt-0.5">
                                    Due:{" "}
                                    {new Date(
                                      task.dueDate
                                    ).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Notes Tab ── */}
                {modalTab === "notes" && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">
                      Notes
                    </h3>
                    {notesLoading ? (
                      <LoadingSpinner />
                    ) : notes.length === 0 ? (
                      <EmptyState text="No notes found for this contact" />
                    ) : (
                      <div className="space-y-2">
                        {notes.map((note) => (
                          <div
                            key={note.id}
                            className="bg-background border border-border rounded-lg p-3"
                          >
                            <p className="text-xs text-foreground whitespace-pre-wrap">
                              {note.body}
                            </p>
                            {note.createdAt && (
                              <p className="text-[10px] text-muted mt-2">
                                {new Date(note.createdAt).toLocaleDateString(
                                  "en-IN",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Payments Tab ── */}
                {modalTab === "payments" && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">
                      Payments
                    </h3>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <FieldBox
                        icon={<CreditCard className="w-3.5 h-3.5" />}
                        label="Opportunity Value"
                        value={`₹ ${(selectedOpp.monetaryValue || 0).toLocaleString("en-IN")}`}
                      />
                      <FieldBox
                        icon={<CreditCard className="w-3.5 h-3.5" />}
                        label="Payment Status"
                        value={"-"}
                      />
                    </div>
                  </div>
                )}

                {/* ── Associated Objects Tab ── */}
                {modalTab === "associated" && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">
                      Associated Objects
                    </h3>
                    <div className="space-y-2">
                      <div className="bg-background border border-border rounded-lg p-3 flex items-center gap-2">
                        <Link2 className="w-3.5 h-3.5 text-muted" />
                        <div>
                          <p className="text-[10px] text-muted">Contact</p>
                          <p className="text-xs text-foreground">
                            {contactName}
                          </p>
                        </div>
                      </div>
                      <div className="bg-background border border-border rounded-lg p-3 flex items-center gap-2">
                        <Link2 className="w-3.5 h-3.5 text-muted" />
                        <div>
                          <p className="text-[10px] text-muted">Pipeline</p>
                          <p className="text-xs text-foreground">
                            {currentPipeline?.name || "-"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Helper Components ─────────────────────────────── */

function FieldBox({
  icon,
  label,
  value,
  statusColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  statusColor?: string;
}) {
  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-muted">{icon}</span>
        <p className="text-[10px] text-muted">{label}</p>
      </div>
      <p
        className={`text-xs font-medium ${statusColor || "text-foreground"} capitalize`}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-8">
      <FileText className="w-8 h-8 text-muted/20 mx-auto mb-2" />
      <p className="text-xs text-muted">{text}</p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="w-4 h-4 animate-spin text-accent mr-2" />
      <span className="text-xs text-muted">Loading...</span>
    </div>
  );
}
