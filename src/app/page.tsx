"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import AuthGuard from "@/components/AuthGuard";
import ModuleCard from "@/components/ModuleCard";
import QuickChat from "@/components/QuickChat";

import { useAuth } from "@/contexts/AuthContext";
import { MODULE_REGISTRY } from "@/lib/modules";
import type { Module } from "@/types";
import { apiFetch } from "@/lib/api-fetch";

type ModuleLike = Omit<Module, "id" | "created_at"> | Module;

export default function Home() {
  const { user, role, isAdmin, loading: authLoading } = useAuth();
  const [modules, setModules] = useState<ModuleLike[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);

  useEffect(() => {
    // Wait for auth to fully resolve before deciding on modules.
    // Without this, the effect fires with user=null while auth is still
    // loading, sets loaded=true with empty modules, and flashes "No modules".
    if (authLoading) return;

    async function load() {
      if (!user) {
        setModules([]);
        setLoaded(true);
        return;
      }

      // Admins see all top-level modules
      if (isAdmin) {
        setModules(
          MODULE_REGISTRY.filter((m) => m.parent_slug === null && m.is_active)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        );
        setLoaded(true);
        return;
      }

      try {
        const params = new URLSearchParams();
        if (role) params.set("role_id", role.id);
        params.set("user_id", user.id);
        const res = await apiFetch(`/api/modules/effective?${params.toString()}`);
        const data = await res.json();
        const effective: Module[] = data.modules || [];
        const topLevel = effective.filter((m: Module) => m.parent_slug === null);
        setModules(topLevel);
      } catch {
        // On API failure, show nothing rather than leaking all modules
        setModules([]);
      } finally {
        setLoaded(true);
      }
    }
    load();
  }, [user, role, isAdmin, authLoading]);

  // Fetch chat unread count
  useEffect(() => {
    if (!user) return;
    async function fetchChatUnread() {
      try {
        const res = await apiFetch("/api/chat/channels");
        const data = await res.json();
        const channels: { unread_count?: number }[] = data.channels || [];
        setChatUnread(channels.reduce((sum, ch) => sum + (ch.unread_count || 0), 0));
      } catch {
        // ignore
      }
    }
    fetchChatUnread();
    const interval = setInterval(fetchChatUnread, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const displayModules = loaded ? modules : [];

  const [showChat, setShowChat] = useState(true);

  return (
    <AuthGuard>
      <Shell>
        <div className="relative h-[calc(100vh-3rem)]">
          {/* Module grid — always centered */}
          <div className="h-full overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto">
              <div className="mb-8">
                <h1 className="text-2xl font-semibold text-foreground">
                  Welcome back{user?.full_name ? `, ${user.full_name}` : ""}
                </h1>
                <p className="text-muted text-sm mt-1">
                  Select a module to get started
                </p>
              </div>

              {(!loaded || authLoading) && displayModules.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              ) : loaded && displayModules.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-muted text-sm">
                    No modules have been assigned to your account yet.
                  </p>
                  <p className="text-muted/60 text-xs mt-1">
                    Contact your administrator to get access.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 max-w-2xl mx-auto sm:mx-0">
                  {displayModules.map((mod, i) => (
                    <ModuleCard
                      key={mod.slug}
                      name={mod.name}
                      description={mod.description}
                      icon={mod.icon}
                      href={mod.path}
                      index={i}
                      badge={mod.slug === "chat" ? chatUnread : 0}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Chat — floating panel on the right */}
          {showChat ? (
            <div className="absolute top-3 right-3 bottom-3 w-96 bg-surface border border-border rounded-xl shadow-2xl hidden lg:flex flex-col overflow-hidden z-10">
              <QuickChat onClose={() => setShowChat(false)} />
            </div>
          ) : (
            <button
              onClick={() => setShowChat(true)}
              className="absolute bottom-5 right-5 w-12 h-12 rounded-full bg-accent text-black flex items-center justify-center shadow-lg hover:scale-105 transition-transform hidden lg:flex z-10"
              title="Open Quick Chat"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
          )}
        </div>
      </Shell>
    </AuthGuard>
  );
}
