"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-fetch";
import Shell from "@/components/Shell";
import AuthGuard from "@/components/AuthGuard";
import {
  ClipboardList,
  Plus,
  Calendar,
  ChevronDown,
  X,
  Loader2,
  ArrowLeft,
  Filter,
} from "lucide-react";
import Link from "next/link";

/* ── Types ───────────────────────────────────────── */

interface Project {
  id: string;
  name: string;
}

interface TaskUser {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url?: string;
}

interface Task {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  due_date: string | null;
  label: string | null;
  order: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  assigned_user: TaskUser | null;
  project: { id: string; name: string } | null;
}

const STATUS_ORDER = ["todo", "in_progress", "review", "done"] as const;
const STATUS_LABELS: Record<string, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};
const STATUS_DOT: Record<string, string> = {
  todo: "bg-gray-400",
  in_progress: "bg-blue-400",
  review: "bg-amber-400",
  done: "bg-green-400",
};
const STATUS_BORDER: Record<string, string> = {
  todo: "border-gray-500/30",
  in_progress: "border-blue-500/30",
  review: "border-amber-500/30",
  done: "border-green-500/30",
};
const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-400",
  high: "bg-orange-500/15 text-orange-400",
  medium: "bg-amber-500/15 text-amber-400",
  low: "bg-green-500/15 text-green-400",
};
const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-400",
  high: "bg-orange-400",
  medium: "bg-amber-400",
  low: "bg-green-400",
};

function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ── Main Board Page ─────────────────────────────── */

export default function TasksBoardPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState<string>("");
  const [showFilter, setShowFilter] = useState(false);
  const [statusMenu, setStatusMenu] = useState<string | null>(null);

  // New task modal state
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newProjectId, setNewProjectId] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  /* ── Data fetching ─────────────────────────────── */

  const fetchData = useCallback(async () => {
    try {
      const params = filterProject ? `?project_id=${filterProject}` : "";
      const [tasksRes, projectsRes] = await Promise.all([
        apiFetch(`/api/tasks${params}`),
        apiFetch("/api/tasks/projects"),
      ]);
      const tasksJson = await tasksRes.json();
      const projectsJson = await projectsRes.json();
      if (tasksRes.ok) setTasks(tasksJson.tasks || []);
      if (projectsRes.ok) setProjects(projectsJson.projects || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [filterProject]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchData();
  }, [user, fetchData]);

  /* ── Status change ─────────────────────────────── */

  const updateStatus = async (taskId: string, newStatus: string) => {
    setStatusMenu(null);
    try {
      const res = await apiFetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });
      if (res.ok) {
        const json = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === taskId ? json.task : t)));
      }
    } catch {
      /* ignore */
    }
  };

  /* ── Add task ──────────────────────────────────── */

  const addTask = async () => {
    if (!newTitle.trim() || !addingToColumn) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          status: addingToColumn,
          priority: newPriority,
          project_id: newProjectId || null,
          due_date: newDueDate || null,
          assigned_to: user?.id || null,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setTasks((prev) => [...prev, json.task]);
        setNewTitle("");
        setNewPriority("medium");
        setNewProjectId("");
        setNewDueDate("");
        setAddingToColumn(null);
      }
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  /* ── Columns ───────────────────────────────────── */

  const columns = STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    tasks: tasks.filter((t) => t.status === status),
  }));

  /* ── Render ────────────────────────────────────── */

  return (
    <AuthGuard>
      <Shell>
        <div className="p-6 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <div className="flex items-center gap-3">
              <Link href="/m/tasks" className="text-muted hover:text-foreground transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <ClipboardList className="w-7 h-7 text-accent" />
              <div>
                <h1 className="text-2xl font-semibold text-foreground">Board</h1>
                <p className="text-muted text-sm">Kanban task board</p>
              </div>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowFilter(!showFilter)}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-surface hover:bg-surface-hover border border-border rounded-lg text-muted transition-colors"
              >
                <Filter className="w-4 h-4" />
                {filterProject
                  ? projects.find((p) => p.id === filterProject)?.name || "Filter"
                  : "All Projects"}
              </button>
              {showFilter && (
                <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-20 w-56">
                  <button
                    onClick={() => {
                      setFilterProject("");
                      setShowFilter(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-hover transition-colors ${
                      !filterProject ? "text-accent" : "text-foreground"
                    }`}
                  >
                    All Projects
                  </button>
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setFilterProject(p.id);
                        setShowFilter(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-hover transition-colors ${
                        filterProject === p.id ? "text-accent" : "text-foreground"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center flex-1">
              <Loader2 className="w-6 h-6 text-muted animate-spin" />
            </div>
          ) : (
            /* ── Kanban Columns ───────────────────────── */
            <div className="flex gap-4 flex-1 overflow-x-auto pb-4">
              {columns.map((col) => (
                <div
                  key={col.status}
                  className={`flex-shrink-0 w-72 bg-surface border ${STATUS_BORDER[col.status]} rounded-xl flex flex-col max-h-[calc(100vh-200px)]`}
                >
                  {/* Column header */}
                  <div className="px-4 py-3 flex items-center justify-between border-b border-border">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[col.status]}`} />
                      <span className="text-sm font-medium text-foreground">{col.label}</span>
                      <span className="text-xs text-muted bg-background px-1.5 py-0.5 rounded">
                        {col.tasks.length}
                      </span>
                    </div>
                    <button
                      onClick={() => setAddingToColumn(col.status)}
                      className="text-muted hover:text-accent transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {col.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-background border border-border rounded-lg p-3 hover:border-accent/30 transition-colors group"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-sm font-medium text-foreground leading-snug flex-1 mr-2">
                            {task.title}
                          </h4>
                          {/* Status dropdown */}
                          <div className="relative flex-shrink-0">
                            <button
                              onClick={() => setStatusMenu(statusMenu === task.id ? null : task.id)}
                              className="text-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            {statusMenu === task.id && (
                              <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-10 w-36">
                                {STATUS_ORDER.filter((s) => s !== task.status).map((s) => (
                                  <button
                                    key={s}
                                    onClick={() => updateStatus(task.id, s)}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-hover transition-colors text-foreground flex items-center gap-2"
                                  >
                                    <div className={`w-2 h-2 rounded-full ${STATUS_DOT[s]}`} />
                                    {STATUS_LABELS[s]}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Priority */}
                          <div className="flex items-center gap-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[task.priority] || PRIORITY_DOT.medium}`} />
                            <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
                              {task.priority}
                            </span>
                          </div>

                          {/* Due date */}
                          {task.due_date && (
                            <span className="text-xs text-muted flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(task.due_date)}
                            </span>
                          )}

                          {/* Spacer */}
                          <div className="flex-1" />

                          {/* Assignee */}
                          {task.assigned_user && (
                            <div
                              className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-medium"
                              title={task.assigned_user.full_name || task.assigned_user.email}
                            >
                              {initials(task.assigned_user.full_name)}
                            </div>
                          )}
                        </div>

                        {/* Label */}
                        {task.label && (
                          <div className="mt-2">
                            <span className="text-xs bg-surface px-2 py-0.5 rounded text-muted">
                              {task.label}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}

                    {col.tasks.length === 0 && (
                      <div className="text-center py-8">
                        <p className="text-xs text-muted">No tasks</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Add Task Modal ───────────────────────── */}
          {addingToColumn && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">
                    Add Task to {STATUS_LABELS[addingToColumn]}
                  </h2>
                  <button
                    onClick={() => setAddingToColumn(null)}
                    className="text-muted hover:text-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTask()}
                    placeholder="Task title"
                    className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
                    autoFocus
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted mb-1 block">Priority</label>
                      <select
                        value={newPriority}
                        onChange={(e) => setNewPriority(e.target.value)}
                        className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted mb-1 block">Project</label>
                      <select
                        value={newProjectId}
                        onChange={(e) => setNewProjectId(e.target.value)}
                        className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                      >
                        <option value="">None</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted mb-1 block">Due date</label>
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                    />
                  </div>
                  <button
                    onClick={addTask}
                    disabled={saving || !newTitle.trim()}
                    className="w-full py-2 text-sm bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {saving ? "Adding..." : "Add Task"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Shell>
    </AuthGuard>
  );
}
