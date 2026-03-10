"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Mail, Shield, Calendar, User, Lock, Eye, EyeOff, Check, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function ProfilePage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    router.replace("/login");
    return null;
  }

  const displayName = user.full_name || user.email.split("@")[0];
  const initial = displayName.charAt(0).toUpperCase();

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setPasswordSaving(true);
    try {
      // Verify current password by re-signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) {
        setPasswordError("Current password is incorrect");
        setPasswordSaving(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setPasswordSuccess(false);
        setShowPasswordSection(false);
      }, 2000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-surface border-b border-border">
        <div className="flex items-center gap-3 px-4 h-12">
          <Link href="/" className="flex-shrink-0 -my-1">
            <Image
              src="/logo.png"
              alt="Apex"
              width={120}
              height={120}
              className="invert mix-blend-screen h-9 w-auto"
            />
          </Link>
          <div className="w-px h-5 bg-border" />
          <div className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-muted hover:text-foreground transition-colors">
              APEX OS
            </Link>
            <span className="text-muted/50">/</span>
            <span className="text-foreground">My Profile</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="bg-surface border border-border rounded-xl p-6">
          {/* Avatar + Name */}
          <div className="flex items-center gap-4 mb-6">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={displayName}
                className="w-16 h-16 rounded-full object-cover border-2 border-border"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center border-2 border-accent/30">
                <span className="text-2xl font-bold text-background">{initial}</span>
              </div>
            )}
            <div>
              <h1 className="text-xl font-semibold text-foreground">{displayName}</h1>
              {role && (
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium">
                  <Shield className="w-3 h-3" />
                  {role.name}
                </span>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-5 space-y-4">
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-muted mt-0.5" />
              <div>
                <p className="text-xs text-muted mb-0.5">Full Name</p>
                <p className="text-sm text-foreground">{user.full_name || "—"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-muted mt-0.5" />
              <div>
                <p className="text-xs text-muted mb-0.5">Email</p>
                <p className="text-sm text-foreground">{user.email}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Shield className="w-4 h-4 text-muted mt-0.5" />
              <div>
                <p className="text-xs text-muted mb-0.5">Role</p>
                <p className="text-sm text-foreground">{role?.name || "—"}</p>
                {role?.description && (
                  <p className="text-xs text-muted mt-0.5">{role.description}</p>
                )}
              </div>
            </div>

            {role?.is_admin && (
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-muted mt-0.5" />
                <div>
                  <p className="text-xs text-muted mb-0.5">Access Level</p>
                  <p className="text-sm text-foreground">Administrator</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-surface border border-border rounded-xl p-6 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-muted" />
              <h2 className="text-sm font-semibold text-foreground">Security</h2>
            </div>
            {!showPasswordSection && (
              <button
                onClick={() => {
                  setShowPasswordSection(true);
                  setPasswordError("");
                  setPasswordSuccess(false);
                }}
                className="text-xs text-accent hover:text-accent/80 transition-colors font-medium"
              >
                Change Password
              </button>
            )}
          </div>

          {showPasswordSection && (
            <form onSubmit={handlePasswordChange} className="mt-4 space-y-3">
              {passwordError && (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="p-2.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  Password updated successfully
                </div>
              )}

              <div>
                <label className="block text-xs text-muted mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 pr-9 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                  >
                    {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-3 py-2 pr-9 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                  >
                    {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordSection(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setPasswordError("");
                  }}
                  className="px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="px-4 py-1.5 text-xs bg-accent text-background rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {passwordSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                  Update Password
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
