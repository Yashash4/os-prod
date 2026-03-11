"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { apiFetch } from "@/lib/api-fetch";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, FolderOpen, Trash2, ExternalLink, X } from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

interface ProjectWithStats extends Project {
  total: number;
  done: number;
  in_progress: number;
  todo: number;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function ProjectCard({
  project,
  onOpen,
  onDelete,
  canDelete,
}: {
  project: ProjectWithStats;
  onOpen: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const pct = project.total > 0 ? Math.round((project.done / project.total) * 100) : 0;
  const openCount = project.total - project.done;

  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4 hover:border-accent/40 hover:shadow-md transition-all group">
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <FolderOpen className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{project.name}</h3>
            {project.description && (
              <p className="text-xs text-muted mt-0.5 line-clamp-1">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onOpen}
            title="Open on board"
            className="p-1 text-muted hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          {canDelete && (
            <button
              onClick={onDelete}
              title="Delete project"
              className="p-1 text-muted hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Task counts */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-surface-hover rounded-lg py-2">
          <p className="text-base font-semibold text-foreground">{project.todo}</p>
          <p className="text-[10px] text-muted">Todo</p>
        </div>
        <div className="bg-blue-500/10 rounded-lg py-2">
          <p className="text-base font-semibold text-blue-400">{project.in_progress}</p>
          <p className="text-[10px] text-muted">Active</p>
        </div>
        <div className="bg-green-500/10 rounded-lg py-2">
          <p className="text-base font-semibold text-green-400">{project.done}</p>
          <p className="text-[10px] text-muted">Done</p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] text-muted">{openCount} task{openCount !== 1 ? "s" : ""} open</span>
          <span className="text-[10px] text-muted font-medium">{pct}%</span>
        </div>
        <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct === 100 ? "bg-green-500" : "bg-accent"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
          project.status === "active" ? "bg-green-500/15 text-green-400" :
          project.status === "completed" ? "bg-blue-500/15 text-blue-400" :
          "bg-gray-500/15 text-gray-400"
        }`}>
          {project.status}
        </span>
        <span className="text-[10px] text-muted">
          {new Date(project.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>
    </div>
  );
}

function NewProjectModal({ onCreated, onClose }: { onCreated: (p: Project) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!name.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await apiFetch("/api/tasks/projects", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      }).then((r) => r.json());
      if (res.project) {
        onCreated(res.project);
      } else if (res.error) {
        setError(res.error);
      }
    } catch {
      setError("Failed to create project");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-xl p-5 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">New Project</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <input
            autoFocus
            className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          />
          <textarea
            className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent resize-none"
            placeholder="Description (optional)"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSubmit}
              disabled={submitting || !name.trim()}
              className="flex-1 py-2 bg-accent text-white text-sm rounded-lg disabled:opacity-40 hover:bg-accent/90"
            >
              {submitting ? "Creating…" : "Create Project"}
            </button>
            <button onClick={onClose} className="px-4 py-2 text-sm text-muted hover:text-foreground">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectsContent() {
  const { isAdmin, user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectsRes, tasksRes] = await Promise.all([
        apiFetch("/api/tasks/projects").then((r) => r.json()),
        apiFetch("/api/tasks").then((r) => r.json()),
      ]);

      const raw: Project[] = projectsRes.projects || [];
      const tasks = tasksRes.tasks || [];

      const withStats: ProjectWithStats[] = raw.map((p) => {
        const ptasks = tasks.filter((t: { project_id: string; status: string }) => t.project_id === p.id);
        return {
          ...p,
          total: ptasks.length,
          done: ptasks.filter((t: { status: string }) => t.status === "done").length,
          in_progress: ptasks.filter((t: { status: string }) => t.status === "in_progress").length,
          todo: ptasks.filter((t: { status: string }) => t.status === "todo").length,
        };
      });

      setProjects(withStats);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleDelete(projectId: string) {
    if (!confirm("Delete this project? Tasks in this project will not be deleted.")) return;
    try {
      await apiFetch(`/api/tasks/projects?id=${projectId}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch {
      alert("Failed to delete project");
    }
  }

  function handleOpen(projectId: string) {
    router.push(`/m/tasks/board?project_id=${projectId}`);
  }

  function handleProjectCreated(p: Project) {
    setProjects((prev) => [{ ...p, total: 0, done: 0, in_progress: 0, todo: 0 }, ...prev]);
    setShowNewProject(false);
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Projects</h1>
          <p className="text-sm text-muted mt-0.5">{projects.length} project{projects.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowNewProject(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen className="w-10 h-10 text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-muted">No projects yet.</p>
          <button
            onClick={() => setShowNewProject(true)}
            className="mt-4 text-sm text-accent hover:underline"
          >
            Create your first project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onOpen={() => handleOpen(p.id)}
              onDelete={() => handleDelete(p.id)}
              canDelete={isAdmin || p.owner_id === user?.id}
            />
          ))}
        </div>
      )}

      {showNewProject && (
        <NewProjectModal
          onCreated={handleProjectCreated}
          onClose={() => setShowNewProject(false)}
        />
      )}
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <AuthGuard>
      <ProjectsContent />
    </AuthGuard>
  );
}
