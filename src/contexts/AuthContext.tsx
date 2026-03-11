"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
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
  authError: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  isAdmin: false,
  authError: false,
  signOut: async () => {},
  refreshUser: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

async function fetchUserData(userId: string, email: string): Promise<{ user: AuthUser; role: Role | null }> {
  // Fetch user profile with role (users table has direct role_id FK)
  const { data: profile, error } = await supabase
    .from("users")
    .select("full_name, avatar_url, role:roles(*)")
    .eq("id", userId)
    .single();

  // If query failed (e.g. RLS blocked due to stale token), throw so caller can retry
  if (error || !profile) {
    throw new Error(error?.message || "Profile not found");
  }

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
  const [authError, setAuthError] = useState(false);
  const router = useRouter();
  const handlingRef = useRef(false);

  const handleSession = useCallback(async (session: { user: { id: string; email?: string } } | null) => {
    // Prevent concurrent executions from overlapping onAuthStateChange events
    if (handlingRef.current) return;
    handlingRef.current = true;

    try {
      if (session?.user) {
        const uid = session.user.id;
        const email = session.user.email!;

        // Try fetching profile data — retry once after 1.5s if first attempt fails
        // (INITIAL_SESSION can fire with a stale token before Supabase refreshes it,
        //  causing RLS-protected queries to fail on the first try)
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const data = await Promise.race([
              fetchUserData(uid, email),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
            ]);
            setUser(data.user);
            setRole(data.role);
            setAuthError(false);
            setLoading(false);
            return;
          } catch {
            if (attempt === 0) {
              // Wait for token refresh before retrying
              await new Promise((r) => setTimeout(r, 1500));
            }
          }
        }

        // Both attempts failed — set basic user but flag the error state
        setUser({ id: uid, email, full_name: null });
        setRole(null);
        setAuthError(true);
      } else {
        setUser(null);
        setRole(null);
        setAuthError(false);
      }
      setLoading(false);
    } finally {
      handlingRef.current = false;
    }
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
        authError,
        signOut: handleSignOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
