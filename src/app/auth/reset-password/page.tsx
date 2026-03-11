"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

/** Parse hash fragment into key-value pairs */
function parseHash(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const hash = window.location.hash.substring(1);
  if (!hash) return {};
  const params: Record<string, string> = {};
  for (const part of hash.split("&")) {
    const [k, v] = part.split("=");
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || "");
  }
  return params;
}

function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    function markReady() {
      if (!settled) {
        settled = true;
        setSessionReady(true);
        setChecking(false);
      }
    }

    function markFailed() {
      if (!settled) {
        settled = true;
        setChecking(false);
      }
    }

    async function handleRecovery() {
      // 1. Clear any stale session that could cause "Refresh Token Not Found"
      await supabase.auth.signOut({ scope: "local" });

      // 2. Listen for auth state changes (Supabase auto-processes hash tokens)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          markReady();
        }
      });

      // 3. Check for query-param tokens (newer Supabase format)
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");
      const code = searchParams.get("code");

      if (tokenHash && type === "recovery") {
        // Newer Supabase email links: ?token_hash=...&type=recovery
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (!error) { markReady(); return () => subscription.unsubscribe(); }
      }

      if (code) {
        // PKCE flow: ?code=...
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) { markReady(); return () => subscription.unsubscribe(); }
      }

      // 4. Check for hash fragment tokens (implicit flow)
      const hashParams = parseHash();
      if (hashParams.access_token && hashParams.refresh_token) {
        // Manually set session from hash tokens
        const { error } = await supabase.auth.setSession({
          access_token: hashParams.access_token,
          refresh_token: hashParams.refresh_token,
        });
        if (!error) {
          markReady();
          // Clean hash from URL
          window.history.replaceState(null, "", window.location.pathname);
          return () => subscription.unsubscribe();
        }
      }

      // 5. If hash tokens exist but setSession failed, or if auto-detection
      //    hasn't fired yet, wait briefly for the onAuthStateChange event
      const hasAnyToken =
        hashParams.access_token ||
        tokenHash ||
        code ||
        window.location.hash.includes("access_token");

      if (hasAnyToken && !settled) {
        timeoutId = setTimeout(() => {
          // Final fallback: check if session was established by auto-detection
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) markReady();
            else markFailed();
          });
        }, 3000);
      } else if (!settled) {
        // No tokens at all — check existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) markReady();
        else markFailed();
      }

      return () => {
        subscription.unsubscribe();
        if (timeoutId) clearTimeout(timeoutId);
      };
    }

    let cleanup: (() => void) | undefined;
    handleRecovery().then((fn) => { cleanup = fn; });

    return () => { cleanup?.(); };
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => router.push("/"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-8 text-center">
          <Image src="/logo.png" alt="Apex" width={80} height={80} className="mx-auto mb-4 invert mix-blend-screen" />
          <h1 className="text-xl font-bold text-foreground mb-2">Invalid or Expired Link</h1>
          <p className="text-muted text-sm mb-4">
            This password reset link is no longer valid. Please request a new one from the login page.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-surface border border-border rounded-2xl p-8">
          <div className="text-center mb-8">
            <Image src="/logo.png" alt="Apex" width={80} height={80} className="mx-auto mb-4 invert mix-blend-screen" />
            <h1 className="text-xl font-bold text-foreground">APEX OS</h1>
            <p className="text-muted text-sm mt-1">Set your password</p>
          </div>

          {success ? (
            <div className="text-center space-y-3">
              <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
              <p className="text-foreground font-medium">Password set successfully!</p>
              <p className="text-muted text-xs">Redirecting to dashboard...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="text-red-500 text-sm text-center bg-red-500/10 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm text-muted mb-1.5">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                />
              </div>

              <div>
                <label className="block text-sm text-muted mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
                  required
                  minLength={8}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Set Password
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
