"use client";

import { useState, useEffect, useCallback } from "react";
import AuthGuard from "@/components/AuthGuard";
import { apiFetch } from "@/lib/api-fetch";
import { useAuth } from "@/contexts/AuthContext";
import TaskDetailModal, { type Task } from "@/components/tasks/TaskDetailModal";
import { Plus, ChevronDown, ChevronRight, AlertCircle, Clock, Calendar, CheckCircle2 } from "lucide-react";

const PRIORITY_META: Record<Task["priority"], { dot: string; label: string; color: string }> = {
  urgent: { dot: "bg-red-500", label: "Urgent", color: "text-red-400" },
  high: { dot: "bg-orange-500", label: "High", color: "text-orange-400" },
  medium: { dot: "bg-amber-500", label: "Medium", color: "text-amber-400" },
  low: { dot: "bg-green-500", label: "Low", color: "text-green-400" },
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

interface Group {
  key: string;
  label: string;
  icon: React.ReactNode;
  tasks: Task[];
  defaultCollapsed?: boolean;
}

function isOverdue(due: string | null) {
  if (!due) return false;
  return new Date(due) < new Date(new Date().toDateString());
}

function isToday(due: string | null) {
  if (!due) return false;
  return new Date(due).toDateString() === new Date().toDateString();
}

function isThisWeek(due: string | null) {
  if (!due) return false;
  const d = new Date(due);
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return d > now && d <= weekEnd;
}

function groupTasks(tasks: Task[]): Group[] {
  const overdue: Task[] = [];
  const today: Task[] = [];
  const thisWeek: Task[] = [];
  const later: Task[] = [];
  const noDueDate: Task[] = [];
  const done: Task[] = [];

  for (const t of tasks) {
    if (t.status === "done") { done.push(t); continue; }
    if (!t.due_date) { noDueDate.push(t); continue; }
    if (isOverdue(t.due_date)) { overdue.push(t); continue; }
    if (isToday(t.due_date)) { today.push(t); continue; }
    if (isThisWeek(t.due_date)) { thisWeek.push(t); continue; }
    later.push(t);
  }

  const groups: Group[] = [];
  if (overdue.length > 0)
    groups.push({ key: "overdue", label: "Overdue", icon: <AlertCircle className="w-3.5 h-3.5 text-red-400" />, tasks: overdue });
  if (today.length > 0)
    groups.push({ key: "today", label: "Due Today", icon: <Clock className="w-3.5 h-3.5 text-amber-400" />, tasks: today });
  if (thisWeek.length > 0)
    groups.push({ key: "week", label: "This Week", icon: <Calendar className="w-3.5 h-3.5 text-blue-400" />, tasks: thisWeek });
  if (later.length > 0)
    groups.push({ key: "later", label: "Later", icon: <Calendar className="w-3.5 h-3.5 text-muted" />, tasks: later });
  if (noDueDate.length > 0)
    groups.push({ key: "no_date", label: "No Due Date", icon: <Calendar className="w-3.5 h-3.5 text-muted/50" />, tasks: noDueDate });
  if (done.length > 0)
    groups.push({ key: "done", label: "Done", icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />, tasks: done, defaultCollapsed: true });

  return groups;
}

function TaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  const pm = PRIORITY_META[task.priority];
  const overdue = isOverdue(task.due_date) && task.status !== "done";

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors text-left group rounded-lg"
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${pm.dot}`} title={pm.label} />
      <span className="flex-1 text-sm text-foreground truncate">{task.title}</span>
      {task.project && (
        <span className="text-[10px] text-muted bg-surface-hover group-hover:bg-border px-1.5 py-0.5 rounded-full shrink-0">
          {task.project.name}
        </span>
      )}
      {task.due_date && (
        <span className={`text-[10px] shrink-0 px-1.5 py-0.5 rounded-full ${
          overdue ? "text-red-400 bg-red-500/10" : "text-muted bg-surface-hover group-hover:bg-border"
        }`}>
          {new Date(task.due_date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
        </span>
      )}
      <span className={`text-[10px] shrink-0 px-1.5 py-0.5 rounded-full ${STATUS_COLORS[task.status]}`}>
        {STATUS_LABELS[task.status]}
      </span>
    </button>
  );
}

function GroupSection({ group, onTaskClick }: { group: Group; onTaskClick: (id: string) => void }) {
  const [collapsed, setCollapsed] = useState(group.defaultCollapsed ?? false);

  return (
    <div className="mb-4">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full px-1 py-1.5 text-left group"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-muted" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted" />
        )}
        {group.icon}
        <span className="text-xs font-semibold text-foreground">{group.label}</span>
        <span className="text-xs text-muted">({group.tasks.length})</span>
      </button>
      {!collapsed && (
        <div className="mt-1 space-y-0.5">
          {group.tasks.map((t) => (
            <TaskRow key={t.id} task={t} onClick={() => onTaskClick(t.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function MyTasksContent() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/tasks?assigned_to=${user.id}`).then((r) => r.json());
      setTasks(res.tasks || []);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  async function handleAddTask() {
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title: newTitle.trim(), assigned_to: user?.id || null }),
      }).then((r) => r.json());
      if (res.task) {
        setTasks((prev) => [res.task, ...prev]);
        setNewTitle("");
        setCreatingTask(false);
      }
    } finally {
      setAdding(false);
    }
  }

  function handleTaskUpdate(updated: Task) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  function handleTaskDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const groups = groupTasks(tasks);
  const openCount = tasks.filter((t) => t.status !== "done").length;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">My Tasks</h1>
          <p className="text-sm text-muted mt-0.5">{openCount} open task{openCount !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setCreatingTask(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Task
        </button>
      </div>

      {/* Inline create */}
      {creatingTask && (
        <div className="bg-surface border border-accent/40 rounded-xl p-4 mb-5">
          <input
            autoFocus
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none mb-3"
            placeholder="Task title…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddTask();
              if (e.key === "Escape") { setCreatingTask(false); setNewTitle(""); }
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddTask}
              disabled={adding || !newTitle.trim()}
              className="px-3 py-1.5 bg-accent text-white text-xs rounded-lg disabled:opacity-40 hover:bg-accent/90"
            >
              {adding ? "Adding…" : "Add task"}
            </button>
            <button
              onClick={() => { setCreatingTask(false); setNewTitle(""); }}
              className="px-3 py-1.5 text-xs text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Task groups */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 className="w-10 h-10 text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-muted">No tasks assigned to you.</p>
          <button
            onClick={() => setCreatingTask(true)}
            className="mt-4 text-sm text-accent hover:underline"
          >
            Create your first task
          </button>
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted text-center py-16">All caught up!</p>
      ) : (
        <div>
          {groups.map((group) => (
            <GroupSection key={group.key} group={group} onTaskClick={setActiveTaskId} />
          ))}
        </div>
      )}

      <TaskDetailModal
        taskId={activeTaskId}
        onClose={() => setActiveTaskId(null)}
        onUpdate={handleTaskUpdate}
        onDelete={handleTaskDelete}
      />
    </div>
  );
}

export default function MyTasksPage() {
  return (
    <AuthGuard>
      <MyTasksContent />
    </AuthGuard>
  );
}
