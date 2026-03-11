"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Role } from "@/types";

interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  role: Role | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
  refreshUser: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

async function fetchUserData(userId: string, email: string): Promise<{ user: AuthUser; role: Role | null }> {
  // Fetch user profile with role (users table has direct role_id FK)
  const { data: profile } = await supabase
    .from("users")
    .select("full_name, avatar_url, role:roles(*)")
    .eq("id", userId)
    .single();

  const rawRole = profile?.role;
  const role: Role | null =
    rawRole && typeof rawRole === "object" && !Array.isArray(rawRole) && "id" in rawRole
      ? (rawRole as unknown as Role)
      : null;

  return {
    user: {
      id: userId,
      email,
      full_name: profile?.full_name ?? null,
      avatar_url: profile?.avatar_url ?? undefined,
    },
    role,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const handleSession = useCallback(async (session: { user: { id: string; email?: string } } | null) => {
    if (session?.user) {
      try {
        const data = await Promise.race([
          fetchUserData(session.user.id, session.user.email!),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
        ]);
        setUser(data.user);
        setRole(data.role);
      } catch {
        // Profile fetch failed/timed out — set basic user so we don't block the app
        setUser({ id: session.user.id, email: session.user.email!, full_name: null });
        setRole(null);
      }
    } else {
      setUser(null);
      setRole(null);
    }
    setLoading(false);
  }, []);

  // refreshUser still available for manual refresh
  const refreshUser = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await handleSession(session);
    } catch {
      setUser(null);
      setRole(null);
      setLoading(false);
    }
  }, [handleSession]);

  useEffect(() => {
    // Use onAuthStateChange as single source of truth.
    // Supabase fires INITIAL_SESSION on subscribe — no need for getSession().
    // Calling getSession() grabs the auth lock and can block signIn if it hangs.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        await handleSession(session);
      }
    );

    // Safety net: if INITIAL_SESSION never fires within 10s, stop loading
    const timeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          setUser(null);
          setRole(null);
        }
        return false;
      });
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [handleSession]);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    router.push("/login");
  }, [router]);

  const isAdmin = role?.is_admin === true;

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        isAdmin,
        signOut: handleSignOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
