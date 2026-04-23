"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, ArrowLeft, CheckCircle, Mail, Zap } from "lucide-react";
import { signIn } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";

type Mode = "login" | "forgot" | "magic";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [actionEmail, setActionEmail] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSent, setActionSent] = useState(false);
  const [actionError, setActionError] = useState("");

  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/");
    }
  }, [authLoading, user, router]);

  function switchMode(next: Mode) {
    setMode(next);
    setActionEmail("");
    setActionSent(false);
    setActionError("");
    setError("");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    setActionError("");
    try {
      const res = await fetch("/api/auth/request-password-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: actionEmail }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Something went wrong");
      }
      setActionSent(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    setActionError("");
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: actionEmail }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Something went wrong");
      }
      setActionSent(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setActionLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  if (user) return null;

  const subtitle =
    mode === "forgot"
      ? "Reset your password"
      : mode === "magic"
      ? "Sign in with magic link"
      : "Sign in to your account";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-surface border border-border rounded-2xl p-8">
          <div className="text-center mb-8">
            <Image
              src="/logo.png"
              alt="Apex"
              width={80}
              height={80}
              className="mx-auto mb-4 invert mix-blend-screen"
            />
            <h1 className="text-xl font-bold text-foreground">APEX OS</h1>
            <p className="text-muted text-sm mt-1">{subtitle}</p>
          </div>

          {/* ── Forgot password ── */}
          {mode === "forgot" && (
            actionSent ? (
              <div className="text-center space-y-3">
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
                <p className="text-foreground font-medium text-sm">Check your email</p>
                <p className="text-muted text-xs">
                  If an account exists for{" "}
                  <span className="text-foreground">{actionEmail}</span>, we&apos;ve
                  sent a password reset link.
                </p>
                <button
                  onClick={() => switchMode("login")}
                  className="mt-4 text-xs text-accent hover:text-accent/80 transition-colors font-medium"
                >
                  Back to Sign in
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={handleForgot} className="space-y-4">
                  {actionError && (
                    <div className="text-red-500 text-sm text-center bg-red-500/10 py-2 rounded-lg">
                      {actionError}
                    </div>
                  )}
                  <p className="text-xs text-muted bg-surface-hover/50 rounded-lg px-3 py-2 border border-border/50 flex items-start gap-2">
                    <Mail className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-accent" />
                    <span>
                      Enter your email address and we&apos;ll send you a link to reset your
                      password.
                    </span>
                  </p>
                  <div>
                    <label className="block text-sm text-muted mb-1.5">Email</label>
                    <input
                      type="email"
                      value={actionEmail}
                      onChange={(e) => setActionEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
                      placeholder="you@apexfashionlab.com"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Send Reset Link
                  </button>
                </form>
                <button
                  onClick={() => switchMode("login")}
                  className="w-full mt-3 flex items-center justify-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Back to Sign in
                </button>
              </>
            )
          )}

          {/* ── Magic link ── */}
          {mode === "magic" && (
            actionSent ? (
              <div className="text-center space-y-3">
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
                <p className="text-foreground font-medium text-sm">Check your email</p>
                <p className="text-muted text-xs">
                  If an account exists for{" "}
                  <span className="text-foreground">{actionEmail}</span>, we&apos;ve
                  sent a magic sign-in link. It expires in 1 hour.
                </p>
                <button
                  onClick={() => switchMode("login")}
                  className="mt-4 text-xs text-accent hover:text-accent/80 transition-colors font-medium"
                >
                  Back to Sign in
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={handleMagicLink} className="space-y-4">
                  {actionError && (
                    <div className="text-red-500 text-sm text-center bg-red-500/10 py-2 rounded-lg">
                      {actionError}
                    </div>
                  )}
                  <p className="text-xs text-muted bg-surface-hover/50 rounded-lg px-3 py-2 border border-border/50 flex items-start gap-2">
                    <Zap className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-accent" />
                    <span>
                      Enter your email and we&apos;ll send a one-click sign-in link. No
                      password needed.
                    </span>
                  </p>
                  <div>
                    <label className="block text-sm text-muted mb-1.5">Email</label>
                    <input
                      type="email"
                      value={actionEmail}
                      onChange={(e) => setActionEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
                      placeholder="you@apexfashionlab.com"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Send Magic Link
                  </button>
                </form>
                <button
                  onClick={() => switchMode("login")}
                  className="w-full mt-3 flex items-center justify-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Back to Sign in
                </button>
              </>
            )
          )}

          {/* ── Normal login ── */}
          {mode === "login" && (
            <>
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <div className="text-red-500 text-sm text-center bg-red-500/10 py-2 rounded-lg">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm text-muted mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
                    placeholder="you@apexfashionlab.com"
                    required
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm text-muted">Password</label>
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="text-xs text-accent hover:text-accent/80 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Sign in
                </button>
              </form>

              <div className="mt-4 relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-2 bg-surface text-muted text-xs">or</span>
                </div>
              </div>

              <button
                onClick={() => switchMode("magic")}
                className="w-full mt-4 py-2.5 border border-border text-foreground text-sm font-medium rounded-lg hover:bg-surface-hover transition-colors flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 text-accent" />
                Sign in with magic link
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
