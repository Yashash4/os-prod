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
  MessageSquare,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Send,
  X,
  Loader2,
  LayoutGrid,
  ListTodo,
  Trash2,
} from "lucide-react";
import Link from "next/link";

/* ── Types ───────────────────────────────────────── */

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  owner_id: string;
  created_at: string;
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

interface Comment {
  id: string;
  task_id: string;
  body: string;
  user_id: string;
  created_at: string;
  user: TaskUser | null;
}

const STATUS_ORDER = ["todo", "in_progress", "review", "done"] as const;
const STATUS_LABELS: Record<string, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};
const STATUS_COLORS: Record<string, string> = {
  todo: "bg-gray-500/15 text-gray-400",
  in_progress: "bg-blue-500/15 text-blue-400",
  review: "bg-amber-500/15 text-amber-400",
  done: "bg-green-500/15 text-green-400",
};
const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-400",
  high: "bg-orange-500/15 text-orange-400",
  medium: "bg-amber-500/15 text-amber-400",
  low: "bg-green-500/15 text-green-400",
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

/* ── Main Page ───────────────────────────────────── */

export default function TasksPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"my" | "projects">("my");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [saving, setSaving] = useState(false);

  /* ── Data fetching ─────────────────────────────── */

  const fetchTasks = useCallback(async () => {
    try {
      const params = tab === "my" && user ? `?assigned_to=${user.id}` : "";
      const res = await apiFetch(`/api/tasks${params}`);
      const json = await res.json();
      if (res.ok) setTasks(json.tasks || []);
    } catch {
      /* ignore */
    }
  }, [tab, user]);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await apiFetch("/api/tasks/projects");
      const json = await res.json();
      if (res.ok) setProjects(json.projects || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([fetchTasks(), fetchProjects()]).finally(() => setLoading(false));
  }, [user, fetchTasks, fetchProjects]);

  /* ── Comments ──────────────────────────────────── */

  const loadComments = useCallback(async (taskId: string) => {
    setLoadingComments(true);
    try {
      const res = await apiFetch(`/api/tasks/comments?task_id=${taskId}`);
      const json = await res.json();
      if (res.ok) setComments(json.comments || []);
    } catch {
      /* ignore */
    } finally {
      setLoadingComments(false);
    }
  }, []);

  const toggleTask = (taskId: string) => {
    if (expandedTask === taskId) {
      setExpandedTask(null);
      setComments([]);
    } else {
      setExpandedTask(taskId);
      loadComments(taskId);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim() || !expandedTask) return;
    try {
      const res = await apiFetch("/api/tasks/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: expandedTask, body: commentText.trim() }),
      });
      if (res.ok) {
        const json = await res.json();
        setComments((prev) => [...prev, json.comment]);
        setCommentText("");
      }
    } catch {
      /* ignore */
    }
  };

  /* ── Task status change ────────────────────────── */

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
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

  /* ── Create project ────────────────────────────── */

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/tasks/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName.trim(), description: newProjectDesc.trim() || null }),
      });
      if (res.ok) {
        const json = await res.json();
        setProjects((prev) => [json.project, ...prev]);
        setNewProjectName("");
        setNewProjectDesc("");
        setShowNewProject(false);
      }
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete project ────────────────────────────── */

  const deleteProject = async (id: string) => {
    try {
      const res = await apiFetch(`/api/tasks/projects?id=${id}`, { method: "DELETE" });
      if (res.ok) setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {
      /* ignore */
    }
  };

  /* ── Grouped tasks ─────────────────────────────── */

  const grouped = STATUS_ORDER.reduce<Record<string, Task[]>>((acc, s) => {
    acc[s] = tasks.filter((t) => t.status === s);
    return acc;
  }, {});

  /* ── Project task counts ───────────────────────── */

  const projectTaskCounts = (projectId: string) =>
    tasks.filter((t) => t.project_id === projectId).length;

  /* ── Render ────────────────────────────────────── */

  return (
    <AuthGuard>
      <Shell>
        <div className="p-6 max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-7 h-7 text-accent" />
              <div>
                <h1 className="text-2xl font-semibold text-foreground">Tasks</h1>
                <p className="text-muted text-sm">Manage tasks and projects</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/m/tasks/board"
                className="flex items-center gap-2 px-3 py-2 text-sm bg-surface hover:bg-surface-hover border border-border rounded-lg text-muted transition-colors"
              >
                <FolderKanban className="w-4 h-4" />
                Board View
              </Link>
              <button
                onClick={() => setShowNewProject(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-accent text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                New Project
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-surface rounded-lg p-1 w-fit border border-border">
            <button
              onClick={() => setTab("my")}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors ${
                tab === "my" ? "bg-background text-foreground shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              <ListTodo className="w-4 h-4" />
              My Tasks
            </button>
            <button
              onClick={() => setTab("projects")}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors ${
                tab === "projects" ? "bg-background text-foreground shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              All Projects
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-muted animate-spin" />
            </div>
          ) : tab === "my" ? (
            /* ── My Tasks ─────────────────────────────── */
            <div className="space-y-6">
              {STATUS_ORDER.map((status) => {
                const items = grouped[status];
                if (!items || items.length === 0) return null;
                return (
                  <div key={status}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[status]}`}>
                        {STATUS_LABELS[status]}
                      </span>
                      <span className="text-xs text-muted">{items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {items.map((task) => (
                        <div key={task.id} className="bg-surface border border-border rounded-lg">
                          {/* Task row */}
                          <button
                            onClick={() => toggleTask(task.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors rounded-lg"
                          >
                            {expandedTask === task.id ? (
                              <ChevronDown className="w-4 h-4 text-muted flex-shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
                            )}
                            <span className="text-sm text-foreground font-medium flex-1 truncate">
                              {task.title}
                            </span>
                            {task.project && (
                              <span className="text-xs text-muted bg-background px-2 py-0.5 rounded">
                                {task.project.name}
                              </span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
                              {task.priority}
                            </span>
                            {task.due_date && (
                              <span className="text-xs text-muted flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(task.due_date)}
                              </span>
                            )}
                            {task.assigned_user && (
                              <div className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-medium flex-shrink-0">
                                {initials(task.assigned_user.full_name)}
                              </div>
                            )}
                          </button>

                          {/* Expanded detail */}
                          {expandedTask === task.id && (
                            <div className="px-4 pb-4 border-t border-border">
                              <div className="pt-3 space-y-3">
                                {task.description && (
                                  <p className="text-sm text-muted">{task.description}</p>
                                )}

                                {/* Status changer */}
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted">Status:</span>
                                  {STATUS_ORDER.map((s) => (
                                    <button
                                      key={s}
                                      onClick={() => updateTaskStatus(task.id, s)}
                                      className={`text-xs px-2 py-1 rounded transition-colors ${
                                        task.status === s
                                          ? STATUS_COLORS[s]
                                          : "text-muted hover:text-foreground bg-background"
                                      }`}
                                    >
                                      {STATUS_LABELS[s]}
                                    </button>
                                  ))}
                                </div>

                                {/* Comments */}
                                <div className="pt-2">
                                  <div className="flex items-center gap-2 mb-2">
                                    <MessageSquare className="w-4 h-4 text-muted" />
                                    <span className="text-xs font-medium text-muted">Comments</span>
                                  </div>
                                  {loadingComments ? (
                                    <Loader2 className="w-4 h-4 text-muted animate-spin" />
                                  ) : (
                                    <div className="space-y-2">
                                      {comments.map((c) => (
                                        <div key={c.id} className="bg-background rounded p-2">
                                          <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-medium text-foreground">
                                              {c.user?.full_name || c.user?.email || "Unknown"}
                                            </span>
                                            <span className="text-xs text-muted">
                                              {formatDate(c.created_at)}
                                            </span>
                                          </div>
                                          <p className="text-sm text-muted">{c.body}</p>
                                        </div>
                                      ))}
                                      <div className="flex gap-2">
                                        <input
                                          type="text"
                                          value={commentText}
                                          onChange={(e) => setCommentText(e.target.value)}
                                          onKeyDown={(e) => e.key === "Enter" && submitComment()}
                                          placeholder="Add a comment..."
                                          className="flex-1 text-sm bg-background border border-border rounded px-3 py-1.5 text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
                                        />
                                        <button
                                          onClick={submitComment}
                                          className="p-1.5 text-accent hover:text-accent/80 transition-colors"
                                        >
                                          <Send className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {tasks.length === 0 && (
                <div className="text-center py-16">
                  <ClipboardList className="w-10 h-10 text-muted mx-auto mb-3 opacity-50" />
                  <p className="text-muted text-sm">No tasks assigned to you yet.</p>
                </div>
              )}
            </div>
          ) : (
            /* ── All Projects ─────────────────────────── */
            <div>
              {projects.length === 0 ? (
                <div className="text-center py-16">
                  <FolderKanban className="w-10 h-10 text-muted mx-auto mb-3 opacity-50" />
                  <p className="text-muted text-sm">No projects yet. Create your first project.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="bg-surface border border-border rounded-lg p-4 hover:bg-surface-hover transition-colors group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-sm font-medium text-foreground">{project.name}</h3>
                        <div className="flex items-center gap-1">
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              project.status === "active"
                                ? "bg-green-500/15 text-green-400"
                                : project.status === "archived"
                                ? "bg-gray-500/15 text-gray-400"
                                : "bg-amber-500/15 text-amber-400"
                            }`}
                          >
                            {project.status}
                          </span>
                          <button
                            onClick={() => deleteProject(project.id)}
                            className="p-1 text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {project.description && (
                        <p className="text-xs text-muted mb-3 line-clamp-2">{project.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <ClipboardList className="w-3 h-3" />
                          {projectTaskCounts(project.id)} tasks
                        </span>
                        <span>{formatDate(project.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── New Project Modal ────────────────────── */}
          {showNewProject && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">New Project</h2>
                  <button onClick={() => setShowNewProject(false)} className="text-muted hover:text-foreground">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Project name"
                    className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
                  />
                  <textarea
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    placeholder="Description (optional)"
                    rows={3}
                    className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:border-accent resize-none"
                  />
                  <button
                    onClick={createProject}
                    disabled={saving || !newProjectName.trim()}
                    className="w-full py-2 text-sm bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {saving ? "Creating..." : "Create Project"}
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
