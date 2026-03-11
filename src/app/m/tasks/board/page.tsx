"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { apiFetch } from "@/lib/api-fetch";
import { useAuth } from "@/contexts/AuthContext";
import TaskDetailModal, { type Task, type TaskUser } from "@/components/tasks/TaskDetailModal";
import { Plus, ChevronDown, Filter } from "lucide-react";

const STATUSES: { key: Task["status"]; label: string; color: string; headerColor: string }[] = [
  { key: "todo", label: "Todo", color: "bg-gray-500/15 text-gray-400", headerColor: "bg-gray-500" },
  { key: "in_progress", label: "In Progress", color: "bg-blue-500/15 text-blue-400", headerColor: "bg-blue-500" },
  { key: "review", label: "Review", color: "bg-amber-500/15 text-amber-400", headerColor: "bg-amber-500" },
  { key: "done", label: "Done", color: "bg-green-500/15 text-green-400", headerColor: "bg-green-500" },
];

const PRIORITY_META: Record<Task["priority"], { dot: string; label: string }> = {
  urgent: { dot: "bg-red-500", label: "Urgent" },
  high: { dot: "bg-orange-500", label: "High" },
  medium: { dot: "bg-amber-500", label: "Medium" },
  low: { dot: "bg-green-500", label: "Low" },
};

interface Project {
  id: string;
  name: string;
}

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function isOverdue(due: string | null) {
  if (!due) return false;
  return new Date(due) < new Date(new Date().toDateString());
}

function isDueSoon(due: string | null) {
  if (!due) return false;
  const d = new Date(due);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  return diff >= 0 && diff <= 2 * 24 * 60 * 60 * 1000;
}

function BoardContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamUsers, setTeamUsers] = useState<TaskUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterProject, setFilterProject] = useState(searchParams.get("project_id") || "");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterPriority, setFilterPriority] = useState("");

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const [addingCol, setAddingCol] = useState<Task["status"] | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  const [statusMenuFor, setStatusMenuFor] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<Task["status"] | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterProject) params.set("project_id", filterProject);

      const [tasksRes, projectsRes, usersRes] = await Promise.all([
        apiFetch(`/api/tasks?${params.toString()}`).then((r) => r.json()),
        apiFetch("/api/tasks/projects").then((r) => r.json()),
        apiFetch("/api/tasks/users").then((r) => r.json()),
      ]);
      setTasks(tasksRes.tasks || []);
      setProjects(projectsRes.projects || []);
      setTeamUsers(usersRes.users || []);
    } finally {
      setLoading(false);
    }
  }, [filterProject]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function getColumnTasks(status: Task["status"]) {
    return tasks.filter((t) => {
      if (t.status !== status) return false;
      if (filterAssignee === "__me__" && t.assigned_to !== user?.id) return false;
      if (filterAssignee && filterAssignee !== "__me__" && t.assigned_to !== filterAssignee) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      return true;
    });
  }

  async function handleAddTask(status: Task["status"]) {
    if (!newTitle.trim()) return;
    setAddingTask(true);
    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title: newTitle.trim(), status, assigned_to: user?.id || null }),
      }).then((r) => r.json());
      if (res.task) {
        setTasks((prev) => [res.task, ...prev]);
      }
      setNewTitle("");
      setAddingCol(null);
    } finally {
      setAddingTask(false);
    }
  }

  async function handleStatusChange(taskId: string, newStatus: Task["status"]) {
    const res = await apiFetch("/api/tasks", {
      method: "PUT",
      body: JSON.stringify({ id: taskId, status: newStatus }),
    }).then((r) => r.json());
    if (res.task) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? res.task : t)));
    }
    setStatusMenuFor(null);
  }

  function handleTaskUpdate(updated: Task) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  function handleTaskDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const activeFiltersCount = [filterAssignee, filterPriority].filter(Boolean).length;

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-surface shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5 text-muted">
          <Filter className="w-3.5 h-3.5" />
          <span className="text-xs">Filter</span>
          {activeFiltersCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-accent text-white text-[10px] flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </div>

        <select
          className="bg-surface-hover border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select
          className="bg-surface-hover border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
        >
          <option value="">All Assignees</option>
          <option value="__me__">My Tasks</option>
          {teamUsers.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
          ))}
        </select>

        <select
          className="bg-surface-hover border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
        >
          <option value="">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {(filterProject || filterAssignee || filterPriority) && (
          <button
            onClick={() => { setFilterProject(""); setFilterAssignee(""); setFilterPriority(""); }}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Board columns */}
      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex gap-4 p-5 overflow-x-auto flex-1 min-h-0 items-start">
          {STATUSES.map((col) => {
            const colTasks = getColumnTasks(col.key);
            return (
              <div
                key={col.key}
                className={`flex flex-col w-72 shrink-0 max-h-full rounded-xl transition-colors ${
                  dragOverCol === col.key ? "bg-accent/10 ring-2 ring-accent/40" : ""
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverCol(col.key);
                }}
                onDragLeave={(e) => {
                  // Only clear if leaving the column (not entering a child)
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverCol(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverCol(null);
                  const taskId = e.dataTransfer.getData("text/plain");
                  const task = tasks.find((t) => t.id === taskId);
                  if (task && task.status !== col.key) {
                    handleStatusChange(taskId, col.key);
                  }
                }}
              >
                {/* Column header */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.headerColor}`} />
                  <span className="text-sm font-semibold text-foreground">{col.label}</span>
                  <span className="ml-auto text-xs text-muted bg-surface-hover px-2 py-0.5 rounded-full font-medium">
                    {colTasks.length}
                  </span>
                </div>

                {/* Cards list */}
                <div className="space-y-2 overflow-y-auto flex-1">
                  {colTasks.map((task) => {
                    const pm = PRIORITY_META[task.priority];
                    const overdue = isOverdue(task.due_date);
                    const soon = isDueSoon(task.due_date);
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", task.id);
                          e.dataTransfer.effectAllowed = "move";
                          // Make card semi-transparent while dragging
                          requestAnimationFrame(() => {
                            (e.target as HTMLElement).style.opacity = "0.4";
                          });
                        }}
                        onDragEnd={(e) => {
                          (e.target as HTMLElement).style.opacity = "1";
                          setDragOverCol(null);
                        }}
                        className="bg-surface border border-border rounded-xl p-3 cursor-grab hover:border-accent/50 hover:shadow-md transition-all group relative active:cursor-grabbing"
                        onClick={() => setActiveTaskId(task.id)}
                      >
                        {/* Priority + title */}
                        <div className="flex items-start gap-2 mb-2.5">
                          <span
                            className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${pm.dot}`}
                            title={pm.label}
                          />
                          <p className="text-sm text-foreground font-medium leading-snug">{task.title}</p>
                        </div>

                        {/* Badges */}
                        {(task.project || task.label) && (
                          <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                            {task.project && (
                              <span className="text-[10px] bg-surface-hover text-muted px-1.5 py-0.5 rounded-full">
                                {task.project.name}
                              </span>
                            )}
                            {task.label && (
                              <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">
                                {task.label}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between">
                          <div>
                            {task.due_date && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                overdue ? "text-red-400 bg-red-500/10" :
                                soon ? "text-amber-400 bg-amber-500/10" :
                                "text-muted bg-surface-hover"
                              }`}>
                                {overdue ? "⚠ " : ""}
                                {new Date(task.due_date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Move status button (hover only) */}
                            <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setStatusMenuFor(statusMenuFor === task.id ? null : task.id);
                                }}
                                className="flex items-center gap-0.5 text-[10px] text-muted hover:text-foreground bg-surface-hover hover:bg-border px-1.5 py-0.5 rounded-full transition-colors"
                              >
                                Move <ChevronDown className="w-2.5 h-2.5" />
                              </button>
                              {statusMenuFor === task.id && (
                                <div
                                  className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-xl z-20 py-1 w-32"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {STATUSES.filter((s) => s.key !== task.status).map((s) => (
                                    <button
                                      key={s.key}
                                      className="w-full text-left px-3 py-1.5 text-xs text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                                      onClick={() => handleStatusChange(task.id, s.key)}
                                    >
                                      {s.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            {/* Assignee avatar */}
                            {task.assigned_user && (
                              <div
                                className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-[9px] font-bold text-accent shrink-0"
                                title={task.assigned_user.full_name || task.assigned_user.email}
                              >
                                {initials(task.assigned_user.full_name || task.assigned_user.email)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {colTasks.length === 0 && (
                    <div className="border border-dashed border-border rounded-xl h-20 flex items-center justify-center">
                      <span className="text-xs text-muted/50">No tasks</span>
                    </div>
                  )}
                </div>

                {/* Inline add task */}
                <div className="mt-2">
                  {addingCol === col.key ? (
                    <div className="bg-surface border border-accent/40 rounded-xl p-3">
                      <input
                        autoFocus
                        className="w-full bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
                        placeholder="Task title…"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddTask(col.key);
                          if (e.key === "Escape") { setAddingCol(null); setNewTitle(""); }
                        }}
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleAddTask(col.key)}
                          disabled={addingTask || !newTitle.trim()}
                          className="px-3 py-1 bg-accent text-white text-xs rounded-lg disabled:opacity-40 hover:bg-accent/90"
                        >
                          {addingTask ? "Adding…" : "Add"}
                        </button>
                        <button
                          onClick={() => { setAddingCol(null); setNewTitle(""); }}
                          className="px-3 py-1 text-xs text-muted hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="flex items-center gap-1.5 w-full px-2 py-2 text-xs text-muted hover:text-foreground hover:bg-surface-hover rounded-xl transition-colors"
                      onClick={() => { setAddingCol(col.key); setNewTitle(""); }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add task
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task detail modal */}
      <TaskDetailModal
        taskId={activeTaskId}
        onClose={() => setActiveTaskId(null)}
        onUpdate={handleTaskUpdate}
        onDelete={handleTaskDelete}
      />

      {/* Dismiss status menu */}
      {statusMenuFor && (
        <div className="fixed inset-0 z-10" onClick={() => setStatusMenuFor(null)} />
      )}
    </div>
  );
}

export default function BoardPage() {
  return (
    <AuthGuard>
      <Suspense
        fallback={
          <div className="flex items-center justify-center flex-1 h-64">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <BoardContent />
      </Suspense>
    </AuthGuard>
  );
}
