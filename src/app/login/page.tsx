"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, ArrowLeft, CheckCircle, Mail } from "lucide-react";
import { signIn } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Password setup state
  const [showSetup, setShowSetup] = useState(false);
  const [setupEmail, setSetupEmail] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupSent, setSetupSent] = useState(false);
  const [setupError, setSetupError] = useState("");

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/");
    }
  }, [authLoading, user, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signIn(email, password);
      // Don't navigate here — the useEffect above handles redirect
      // once AuthContext fully resolves user + role. Navigating immediately
      // causes a race where the home page renders before role is loaded.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetupRequest(e: React.FormEvent) {
    e.preventDefault();
    setSetupLoading(true);
    setSetupError("");

    try {
      const res = await fetch("/api/auth/request-password-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: setupEmail }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Something went wrong");
      }
      setSetupSent(true);
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSetupLoading(false);
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
            <p className="text-muted text-sm mt-1">
              {showSetup ? "Set up your password" : "Sign in to your account"}
            </p>
          </div>

          {showSetup ? (
            // Password setup flow
            setupSent ? (
              <div className="text-center space-y-3">
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
                <p className="text-foreground font-medium text-sm">Check your email</p>
                <p className="text-muted text-xs">
                  If an account exists for <span className="text-foreground">{setupEmail}</span>, we&apos;ve sent a link to set your password.
                </p>
                <button
                  onClick={() => {
                    setShowSetup(false);
                    setSetupSent(false);
                    setSetupEmail("");
                  }}
                  className="mt-4 text-xs text-accent hover:text-accent/80 transition-colors font-medium"
                >
                  Back to Sign in
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={handleSetupRequest} className="space-y-4">
                  {setupError && (
                    <div className="text-red-500 text-sm text-center bg-red-500/10 py-2 rounded-lg">
                      {setupError}
                    </div>
                  )}

                  <p className="text-xs text-muted bg-surface-hover/50 rounded-lg px-3 py-2 border border-border/50 flex items-start gap-2">
                    <Mail className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-accent" />
                    <span>Enter the email address your admin used to create your account. We&apos;ll send you a link to set your password.</span>
                  </p>

                  <div>
                    <label className="block text-sm text-muted mb-1.5">Email</label>
                    <input
                      type="email"
                      value={setupEmail}
                      onChange={(e) => setSetupEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
                      placeholder="you@apexfashionlab.com"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={setupLoading}
                    className="w-full py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {setupLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Send Setup Link
                  </button>
                </form>

                <button
                  onClick={() => {
                    setShowSetup(false);
                    setSetupError("");
                    setSetupEmail("");
                  }}
                  className="w-full mt-3 flex items-center justify-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Back to Sign in
                </button>
              </>
            )
          ) : (
            // Normal login flow
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
                  <label className="block text-sm text-muted mb-1.5">Password</label>
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

              <div className="mt-4 text-center">
                <button
                  onClick={() => setShowSetup(true)}
                  className="text-xs text-accent hover:text-accent/80 transition-colors font-medium"
                >
                  First time? Set up your password
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
