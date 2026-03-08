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

  const role = (profile?.role as unknown as Role) ?? null;

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

  const loadUser = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const data = await fetchUserData(session.user.id, session.user.email!);
        setUser(data.user);
        setRole(data.role);
      } else {
        setUser(null);
        setRole(null);
      }
    } catch {
      setUser(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          const data = await fetchUserData(session.user.id, session.user.email!);
          setUser(data.user);
          setRole(data.role);
          setLoading(false);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setRole(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [loadUser]);

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
        refreshUser: loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
