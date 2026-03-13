"use client";

import { useEffect, useState, useCallback } from "react";
import { FolderOpen, Plus, Trash2, Loader2, X } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import PermissionGate from "@/components/PermissionGate";

/* ── Types ─────────────────────────────────────────── */

interface Category {
  id: string;
  name: string;
  icon: string | null;
  expense_count: number;
}

/* ── Component ─────────────────────────────────────── */

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", icon: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/finance/categories");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCategories(data.categories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!form.name) return;
    try {
      const res = await apiFetch("/api/finance/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, icon: form.icon || null }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCategories((prev) => [...prev, { ...data.category, expense_count: 0 }]);
      setForm({ name: "", icon: "" });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    try {
      const res = await apiFetch(`/api/finance/categories?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20 flex items-center justify-between">
          {error}
          <button onClick={() => setError("")}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderOpen className="w-5 h-5 text-accent" />
          <h1 className="text-lg font-bold">Expense Categories</h1>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-accent text-white px-3 py-1.5 rounded-lg text-sm hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Category name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
            />
            <input
              type="text"
              placeholder="Icon name (optional, e.g. Coffee)"
              value={form.icon}
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              className="bg-accent text-white px-4 py-2 rounded-lg text-sm hover:bg-accent/90 transition-colors"
            >
              Create Category
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="border border-border text-muted px-4 py-2 rounded-lg text-sm hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Category List */}
      <div className="border border-border rounded-xl overflow-hidden divide-y divide-border/50">
        {categories.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between px-4 py-3 hover:bg-surface-hover/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <FolderOpen className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted">
                  {c.expense_count} expense{c.expense_count !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleDelete(c.id)}
              className="text-muted hover:text-red-400 transition-colors p-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {categories.length === 0 && !loading && (
          <div className="py-12 text-center text-muted text-sm">
            No categories yet -- add one to get started
          </div>
        )}
      </div>
    </div>
  );
}
