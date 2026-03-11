"use client";

import { useState, useEffect, useCallback } from "react";
import AuthGuard from "@/components/AuthGuard";
import { apiFetch } from "@/lib/api-fetch";
import { useAuth } from "@/contexts/AuthContext";
import TaskDetailModal, { type Task, type TaskUser } from "@/components/tasks/TaskDetailModal";
import { ChevronDown, ChevronRight, Users, Plus } from "lucide-react";

const PRIORITY_META: Record<Task["priority"], { dot: string }> = {
  urgent: { dot: "bg-red-500" },
  high: { dot: "bg-orange-500" },
  medium: { dot: "bg-amber-500" },
  low: { dot: "bg-green-500" },
};

const STATUS_COLORS: Record<Task["status"], string> = {
  todo: "bg-gray-500/15 text-gray-400",
  in_progress: "bg-blue-500/15 text-blue-400",
  review: "bg-amber-500/15 text-amber-400",
  done: "bg-green-500/15 text-green-400",
};

const STATUS_LABELS: Record<Task["status"], string> = {
  todo: "Todo",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

interface Project {
  id: string;
  name: string;
}

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

interface AssigneeGroup {
  user: TaskUser | null;
  tasks: Task[];
}

function buildGroups(tasks: Task[], users: TaskUser[]): AssigneeGroup[] {
  const map = new Map<string, AssigneeGroup>();

  // Init with all users (so people with 0 tasks still appear)
  for (const u of users) {
    map.set(u.id, { user: u, tasks: [] });
  }

  // Bucket tasks
  for (const t of tasks) {
    const key = t.assigned_to || "__unassigned__";
    if (!map.has(key)) {
      map.set(key, { user: t.assigned_user, tasks: [] });
    }
    map.get(key)!.tasks.push(t);
  }

  // Sort: people with tasks first, then unassigned
  const groups = [...map.values()];
  groups.sort((a, b) => {
    if (!a.user) return 1;
    if (!b.user) return -1;
    return b.tasks.length - a.tasks.length;
  });

  return groups;
}

function PersonSection({
  group,
  onTaskClick,
  onAssignTask,
  isAdmin,
  filterStatus,
  filterProject,
}: {
  group: AssigneeGroup;
  onTaskClick: (id: string) => void;
  onAssignTask: (userId: string) => void;
  isAdmin: boolean;
  filterStatus: string;
  filterProject: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const name = group.user?.full_name || group.user?.email || "Unassigned";

  const filteredTasks = group.tasks.filter((t) => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterProject && t.project_id !== filterProject) return false;
    return true;
  });

  const openTasks = group.tasks.filter((t) => t.status !== "done").length;
  const doneTasks = group.tasks.filter((t) => t.status === "done").length;
  const total = group.tasks.length;
  const pct = total > 0 ? Math.round((doneTasks / total) * 100) : 0;

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden mb-4 group">
      {/* Person header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setCollapsed(!collapsed)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setCollapsed(!collapsed); }}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left cursor-pointer"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-muted shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted shrink-0" />
        )}
        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent shrink-0">
          {initials(name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">{name}</span>
            <span className="text-xs text-muted">{openTasks} open</span>
          </div>
          {total > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1 bg-surface-hover rounded-full overflow-hidden max-w-32">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] text-muted">{pct}%</span>
            </div>
          )}
        </div>
        {isAdmin && group.user && (
          <button
            onClick={(e) => { e.stopPropagation(); onAssignTask(group.user!.id); }}
            className="flex items-center gap-1 text-[10px] text-accent hover:bg-accent/10 px-2 py-1 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            title="Assign task to this person"
          >
            <Plus className="w-3 h-3" />
            Assign
          </button>
        )}
      </div>

      {/* Tasks */}
      {!collapsed && (
        <div className="border-t border-border">
          {filteredTasks.length === 0 ? (
            <p className="text-xs text-muted px-4 py-3 italic">
              {group.tasks.length === 0 ? "No tasks assigned." : "No tasks match the current filter."}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {filteredTasks.map((task) => {
                const pm = PRIORITY_META[task.priority];
                return (
                  <button
                    key={task.id}
                    onClick={() => onTaskClick(task.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors text-left group"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pm.dot}`} />
                    <span className="flex-1 text-sm text-foreground truncate">{task.title}</span>
                    {task.project && (
                      <span className="text-[10px] text-muted bg-surface-hover group-hover:bg-border px-1.5 py-0.5 rounded-full shrink-0 hidden sm:block">
                        {task.project.name}
                      </span>
                    )}
                    {task.due_date && (
                      <span className="text-[10px] text-muted shrink-0">
                        {new Date(task.due_date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    <span className={`text-[10px] shrink-0 px-1.5 py-0.5 rounded-full ${STATUS_COLORS[task.status]}`}>
                      {STATUS_LABELS[task.status]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TeamTasksContent() {
  const { isAdmin } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamUsers, setTeamUsers] = useState<TaskUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterProject, setFilterProject] = useState("");

  // Quick assign: open modal pre-filled for a specific user
  const [quickAssignUserId, setQuickAssignUserId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, usersRes, projectsRes] = await Promise.all([
        apiFetch("/api/tasks").then((r) => r.json()),
        apiFetch("/api/tasks/users").then((r) => r.json()),
        apiFetch("/api/tasks/projects").then((r) => r.json()),
      ]);
      setTasks(tasksRes.tasks || []);
      setTeamUsers(usersRes.users || []);
      setProjects(projectsRes.projects || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function handleTaskUpdate(updated: Task) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  function handleTaskDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const groups = buildGroups(tasks, teamUsers);
  const totalOpen = tasks.filter((t) => t.status !== "done").length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-muted" />
            Team Tasks
          </h1>
          <p className="text-sm text-muted mt-0.5">{totalOpen} open across {teamUsers.length} members</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            className="bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="todo">Todo</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div>
          {groups.map((group) => (
            <PersonSection
              key={group.user?.id || "__unassigned__"}
              group={group}
              onTaskClick={setActiveTaskId}
              onAssignTask={(uid) => setQuickAssignUserId(uid)}
              isAdmin={isAdmin}
              filterStatus={filterStatus}
              filterProject={filterProject}
            />
          ))}
        </div>
      )}

      <TaskDetailModal
        taskId={activeTaskId}
        onClose={() => setActiveTaskId(null)}
        onUpdate={handleTaskUpdate}
        onDelete={handleTaskDelete}
      />

      {/* Quick-assign: we reuse TaskDetailModal in "create" mode by opening a null task —
          instead we just open the board in filtered mode for now */}
      {quickAssignUserId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setQuickAssignUserId(null)}
        >
          <div
            className="bg-surface border border-border rounded-xl p-5 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Assign New Task to {teamUsers.find((u) => u.id === quickAssignUserId)?.full_name || "User"}
            </h3>
            <QuickAssignForm
              userId={quickAssignUserId}
              projects={projects}
              onCreated={(t) => {
                setTasks((prev) => [t, ...prev]);
                setQuickAssignUserId(null);
              }}
              onCancel={() => setQuickAssignUserId(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function QuickAssignForm({
  userId,
  projects,
  onCreated,
  onCancel,
}: {
  userId: string;
  projects: Project[];
  onCreated: (task: Task) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          assigned_to: userId,
          project_id: projectId || null,
          priority,
        }),
      }).then((r) => r.json());
      if (res.task) onCreated(res.task);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        autoFocus
        className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
        placeholder="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
      />
      <select
        className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
        value={priority}
        onChange={(e) => setPriority(e.target.value as Task["priority"])}
      >
        <option value="urgent">Urgent</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <select
        className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
      >
        <option value="">No project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={submitting || !title.trim()}
          className="flex-1 py-2 bg-accent text-white text-sm rounded-lg disabled:opacity-40 hover:bg-accent/90"
        >
          {submitting ? "Assigning…" : "Assign Task"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-sm text-muted hover:text-foreground">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function TeamTasksPage() {
  return (
    <AuthGuard>
      <TeamTasksContent />
    </AuthGuard>
  );
}
