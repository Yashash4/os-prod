"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { useAuth } from "@/contexts/AuthContext";
import {
  X,
  MessageSquare,
  Send,
  Trash2,
  AlertCircle,
  Calendar,
  User,
  Tag,
  FolderOpen,
  Flag,
} from "lucide-react";

export interface Task {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
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

export interface TaskUser {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url?: string | null;
}

interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  body: string;
  created_at: string;
  user: TaskUser | null;
}

interface Project {
  id: string;
  name: string;
}

interface Props {
  taskId: string | null;
  onClose: () => void;
  onUpdate: (task: Task) => void;
  onDelete: (id: string) => void;
}

const STATUS_OPTIONS: { value: Task["status"]; label: string; color: string }[] = [
  { value: "todo", label: "Todo", color: "bg-gray-500/15 text-gray-400" },
  { value: "in_progress", label: "In Progress", color: "bg-blue-500/15 text-blue-400" },
  { value: "review", label: "Review", color: "bg-amber-500/15 text-amber-400" },
  { value: "done", label: "Done", color: "bg-green-500/15 text-green-400" },
];

const PRIORITY_OPTIONS: { value: Task["priority"]; label: string; color: string; dot: string }[] = [
  { value: "urgent", label: "Urgent", color: "bg-red-500/15 text-red-400", dot: "bg-red-500" },
  { value: "high", label: "High", color: "bg-orange-500/15 text-orange-400", dot: "bg-orange-500" },
  { value: "medium", label: "Medium", color: "bg-amber-500/15 text-amber-400", dot: "bg-amber-500" },
  { value: "low", label: "Low", color: "bg-green-500/15 text-green-400", dot: "bg-green-500" },
];

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function isOverdue(due: string | null) {
  if (!due) return false;
  return new Date(due) < new Date(new Date().toDateString());
}

export default function TaskDetailModal({ taskId, onClose, onUpdate, onDelete }: Props) {
  const { user, isAdmin } = useAuth();

  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [teamUsers, setTeamUsers] = useState<TaskUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Task["status"]>("todo");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [label, setLabel] = useState("");

  const loadTask = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      const [taskRes, commentsRes, usersRes, projectsRes] = await Promise.all([
        apiFetch(`/api/tasks?id=${taskId}`).then((r) => r.json()),
        apiFetch(`/api/tasks/comments?task_id=${taskId}`).then((r) => r.json()),
        apiFetch("/api/tasks/users").then((r) => r.json()),
        apiFetch("/api/tasks/projects").then((r) => r.json()),
      ]);

      if (taskRes.task) {
        const t: Task = taskRes.task;
        setTask(t);
        setTitle(t.title);
        setDescription(t.description || "");
        setStatus(t.status);
        setPriority(t.priority);
        setAssignedTo(t.assigned_to || "");
        setProjectId(t.project_id || "");
        setDueDate(t.due_date ? t.due_date.split("T")[0] : "");
        setLabel(t.label || "");
      }
      setComments(commentsRes.comments || []);
      setTeamUsers(usersRes.users || []);
      setProjects(projectsRes.projects || []);
    } catch {
      setError("Failed to load task");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (taskId) loadTask();
  }, [taskId, loadTask]);

  async function handleSave() {
    if (!task) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/tasks", {
        method: "PUT",
        body: JSON.stringify({
          id: task.id,
          title,
          description: description || null,
          status,
          priority,
          assigned_to: assignedTo || null,
          project_id: projectId || null,
          due_date: dueDate || null,
          label: label || null,
        }),
      }).then((r) => r.json());
      if (res.task) {
        setTask(res.task);
        onUpdate(res.task);
      }
    } catch {
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!task || !confirm("Delete this task? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/tasks?id=${task.id}`, { method: "DELETE" });
      onDelete(task.id);
      onClose();
    } catch {
      setError("Failed to delete task");
      setDeleting(false);
    }
  }

  async function handleSendComment() {
    if (!task || !commentBody.trim()) return;
    setSendingComment(true);
    try {
      const res = await apiFetch("/api/tasks/comments", {
        method: "POST",
        body: JSON.stringify({ task_id: task.id, body: commentBody.trim() }),
      }).then((r) => r.json());
      if (res.comment) {
        setComments((prev) => [...prev, res.comment]);
        setCommentBody("");
      }
    } catch {
      setError("Failed to send comment");
    } finally {
      setSendingComment(false);
    }
  }

  if (!taskId) return null;

  const statusInfo = STATUS_OPTIONS.find((s) => s.value === status);
  const priorityInfo = PRIORITY_OPTIONS.find((p) => p.value === priority);
  const canDelete = isAdmin || task?.created_by === user?.id;
  const overdue = isOverdue(dueDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error && !task ? (
          <div className="flex items-center justify-center h-64 gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        ) : task ? (
          <>
            {/* Header */}
            <div className="flex items-start gap-3 p-5 border-b border-border">
              <span className={`mt-0.5 shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${statusInfo?.color}`}>
                {statusInfo?.label}
              </span>
              <input
                className="flex-1 bg-transparent text-foreground text-lg font-semibold focus:outline-none placeholder:text-muted"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
              />
              <button onClick={onClose} className="text-muted hover:text-foreground transition-colors mt-0.5">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto">
              <div className="flex gap-0 divide-x divide-border">
                {/* Left: description + comments */}
                <div className="flex-1 min-w-0 p-5 flex flex-col gap-5">
                  {/* Description */}
                  <div>
                    <p className="text-xs text-muted uppercase tracking-wider mb-2">Description</p>
                    <textarea
                      className="w-full bg-surface-hover border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent resize-none"
                      rows={5}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add a description…"
                    />
                  </div>

                  {/* Comments */}
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-3">
                      <MessageSquare className="w-3.5 h-3.5 text-muted" />
                      <p className="text-xs text-muted uppercase tracking-wider">
                        Comments ({comments.length})
                      </p>
                    </div>

                    {comments.length === 0 ? (
                      <p className="text-sm text-muted italic">No comments yet.</p>
                    ) : (
                      <div className="space-y-3 mb-4 max-h-48 overflow-y-auto pr-1">
                        {comments.map((c) => (
                          <div key={c.id} className="flex gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent shrink-0">
                              {initials(c.user?.full_name || c.user?.email)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2">
                                <span className="text-xs font-medium text-foreground">
                                  {c.user?.full_name || c.user?.email || "Unknown"}
                                </span>
                                <span className="text-[10px] text-muted">
                                  {formatDate(c.created_at)} {formatTime(c.created_at)}
                                </span>
                              </div>
                              <p className="text-sm text-muted mt-0.5 whitespace-pre-wrap">{c.body}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Comment input */}
                    <div className="flex gap-2 mt-2">
                      <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent shrink-0">
                        {initials(user?.full_name)}
                      </div>
                      <div className="flex-1 flex gap-2">
                        <input
                          className="flex-1 bg-surface-hover border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
                          placeholder="Add a comment…"
                          value={commentBody}
                          onChange={(e) => setCommentBody(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendComment();
                            }
                          }}
                        />
                        <button
                          onClick={handleSendComment}
                          disabled={!commentBody.trim() || sendingComment}
                          className="px-3 py-1.5 bg-accent text-white rounded-lg text-sm disabled:opacity-40 hover:bg-accent/90 transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: metadata */}
                <div className="w-60 shrink-0 p-5 space-y-4">
                  {/* Assignee */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <User className="w-3 h-3 text-muted" />
                      <span className="text-[10px] text-muted uppercase tracking-wider">Assignee</span>
                    </div>
                    <select
                      className="w-full bg-surface-hover border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {teamUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name || u.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[10px] text-muted uppercase tracking-wider">Status</span>
                    </div>
                    <select
                      className="w-full bg-surface-hover border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as Task["status"])}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Priority */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Flag className="w-3 h-3 text-muted" />
                      <span className="text-[10px] text-muted uppercase tracking-wider">Priority</span>
                    </div>
                    <select
                      className="w-full bg-surface-hover border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as Task["priority"])}
                    >
                      {PRIORITY_OPTIONS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                    {priorityInfo && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${priorityInfo.dot}`} />
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${priorityInfo.color}`}>
                          {priorityInfo.label}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Project */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <FolderOpen className="w-3 h-3 text-muted" />
                      <span className="text-[10px] text-muted uppercase tracking-wider">Project</span>
                    </div>
                    <select
                      className="w-full bg-surface-hover border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                    >
                      <option value="">No project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Due Date */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Calendar className="w-3 h-3 text-muted" />
                      <span className="text-[10px] text-muted uppercase tracking-wider">Due Date</span>
                    </div>
                    <input
                      type="date"
                      className="w-full bg-surface-hover border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                    {overdue && (
                      <div className="mt-1 flex items-center gap-1 text-red-400">
                        <AlertCircle className="w-3 h-3" />
                        <span className="text-xs">Overdue</span>
                      </div>
                    )}
                  </div>

                  {/* Label */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Tag className="w-3 h-3 text-muted" />
                      <span className="text-[10px] text-muted uppercase tracking-wider">Label</span>
                    </div>
                    <input
                      className="w-full bg-surface-hover border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
                      placeholder="e.g. bug, feature"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                    />
                  </div>

                  {/* Metadata */}
                  <div className="pt-2 border-t border-border space-y-1">
                    <p className="text-[10px] text-muted">
                      Created {formatDate(task.created_at)}
                    </p>
                    {task.updated_at && task.updated_at !== task.created_at && (
                      <p className="text-[10px] text-muted">
                        Updated {formatDate(task.updated_at)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-border">
              <div className="flex items-center gap-3">
                {canDelete && (
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deleting ? "Deleting…" : "Delete task"}
                  </button>
                )}
                {error && (
                  <span className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {error}
                  </span>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-accent/90 transition-colors"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
