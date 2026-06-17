"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/states";
import { ApiError } from "@/lib/api-client";
import { useProfile, useUpdateProfile, useChangePassword } from "@/modules/auth/hooks";

// ─────────────────────────────────────────────────────────────────────────────
// Profile page — edit name/email/theme and change password.
// ─────────────────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border-default bg-surface-secondary p-6">
      <h2 className="mb-4 text-base font-semibold text-text-primary">{title}</h2>
      {children}
    </section>
  );
}

function Alert({ type, message }: { type: "success" | "error"; message: string }) {
  return (
    <div
      role="alert"
      className={
        "rounded-md border px-3 py-2 text-sm " +
        (type === "success"
          ? "border-success/40 bg-success/10 text-success"
          : "border-danger/40 bg-danger/10 text-danger")
      }
    >
      {message}
    </div>
  );
}

export default function ProfilePage() {
  const profileQuery = useProfile();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  // ── Profile form state ─────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (profileQuery.data) {
      setName(profileQuery.data.name);
      setEmail(profileQuery.data.email);
    }
  }, [profileQuery.data]);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    try {
      await updateProfile.mutateAsync({ name: name.trim(), email: email.trim() });
      setProfileMsg({ type: "success", text: "Profile updated." });
    } catch (err) {
      setProfileMsg({
        type: "error",
        text: err instanceof ApiError ? err.message : "Failed to update profile.",
      });
    }
  }

  // ── Change password form state ─────────────────────────────────────────────
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confirmPw) {
      setPwMsg({ type: "error", text: "Passwords do not match." });
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword: currentPw, newPassword: newPw, confirmPassword: confirmPw });
      setPwMsg({ type: "success", text: "Password changed successfully." });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err) {
      setPwMsg({
        type: "error",
        text: err instanceof ApiError ? err.message : "Failed to change password.",
      });
    }
  }

  if (profileQuery.isLoading) return <div className="px-8 py-6"><LoadingState /></div>;

  return (
    <div className="px-8 py-6 max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Profile</h1>
        <p className="mt-0.5 text-sm text-text-secondary">Manage your account details and password.</p>
      </div>

      {/* Profile info */}
      <Section title="Account information">
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <Field label="Name" htmlFor="profile-name">
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
            />
          </Field>
          <Field label="Email" htmlFor="profile-email">
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          {profileMsg && <Alert type={profileMsg.type} message={profileMsg.text} />}
          <div className="flex justify-end">
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Section>

      {/* Change password */}
      <Section title="Change password">
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <Field label="Current password" htmlFor="cur-pw">
            <Input
              id="cur-pw"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          <Field label="New password" htmlFor="new-pw">
            <Input
              id="new-pw"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm-pw">
            <Input
              id="confirm-pw"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
          {pwMsg && <Alert type={pwMsg.type} message={pwMsg.text} />}
          <div className="flex justify-end">
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </Section>
    </div>
  );
}
