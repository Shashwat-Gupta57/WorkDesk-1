"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  User, Lock, Palette, Bell, Shield, AlertTriangle,
  CheckCircle2, Loader2, AlertCircle, Monitor, LogOut,
  Eye, EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile, useUpdateProfile, useChangePassword } from "@/modules/auth/hooks";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

// ─────────────────────────────────────────────────────────────────────────────
// Profile & Settings — tabbed left-nav layout matching reference design.
//
// Tabs: Profile | Security | Appearance | Notifications | Account
// All API operations use existing /api/auth/* routes.
// ─────────────────────────────────────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved" | "error";
type Tab = "profile" | "security" | "appearance" | "notifications" | "account";

// ── Shared primitives ─────────────────────────────────────────────────────────

const inputCls =
  "w-full h-9 px-3 text-[13px] bg-surface-secondary border border-border-default rounded " +
  "outline-none text-text-primary placeholder:text-text-secondary focus:border-primary transition-colors";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[12px] font-medium text-text-secondary">
        {label}
        {hint && <span className="font-normal text-text-secondary/60">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="pb-4 border-b border-border-default">
      <h2 className="text-[15px] font-semibold text-text-primary">{title}</h2>
      <p className="text-[13px] text-text-secondary mt-0.5">{description}</p>
    </div>
  );
}

function SaveRow({ state, label = "Save changes" }: { state: SaveState; label?: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        type="submit"
        disabled={state === "saving"}
        className="flex items-center gap-1.5 h-9 px-5 text-[13px] font-medium bg-primary text-on-primary rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {state === "saving" && <Loader2 size={13} className="animate-spin" />}
        {label}
      </button>
      {state === "saved" && (
        <span className="flex items-center gap-1.5 text-[13px] text-success">
          <CheckCircle2 size={14} /> Saved
        </span>
      )}
      {state === "error" && (
        <span className="flex items-center gap-1.5 text-[13px] text-danger">
          <AlertCircle size={14} /> Failed
        </span>
      )}
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="flex items-center gap-2 text-danger text-[13px]">
      <AlertCircle size={14} /> {msg}
    </div>
  );
}

// ── Left nav ──────────────────────────────────────────────────────────────────

const NAV: { id: Tab; icon: React.ReactNode; label: string }[] = [
  { id: "profile",       icon: <User size={13} />,    label: "Profile" },
  { id: "security",      icon: <Lock size={13} />,     label: "Security" },
  { id: "appearance",    icon: <Palette size={13} />,  label: "Appearance" },
  { id: "notifications", icon: <Bell size={13} />,     label: "Notifications" },
  { id: "account",       icon: <Shield size={13} />,   label: "Account" },
];

function NavItem({ id, icon, label, active, onClick }: {
  id: Tab; icon: React.ReactNode; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 h-8 px-3 rounded text-[13px] transition-colors",
        active
          ? "bg-primary/15 text-primary font-medium"
          : id === "account"
            ? "text-text-secondary hover:bg-surface-elevated hover:text-danger"
            : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
      )}
    >
      {icon} {label}
    </button>
  );
}

// ── Profile tab ───────────────────────────────────────────────────────────────

function ProfileTab() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const [form, setForm] = useState({ name: "", email: "" });
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (profile) setForm({ name: profile.name, email: profile.email });
  }, [profile]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required"); return; }
    setState("saving"); setError("");
    try {
      await updateProfile.mutateAsync({ name: form.name.trim(), email: form.email.trim() });
      setState("saved");
      setTimeout(() => setState("idle"), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
      setState("error");
    }
  }

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-text-secondary" /></div>;
  }

  const initials = (profile?.name ?? "?").split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <SectionHeader title="Profile" description="Your personal information visible to all team members." />

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/20 text-primary text-[22px] font-bold flex items-center justify-center shrink-0 select-none">
          {initials}
        </div>
        <div>
          <p className="text-[14px] font-semibold text-text-primary">{profile?.name}</p>
          <p className="text-[12px] text-text-secondary mt-0.5 capitalize">
            {profile?.role?.toLowerCase()} · Flex Studios
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <Field label="Name">
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required className={inputCls} placeholder="Your name"
          />
        </Field>
        <Field label="Email">
          <input
            type="email" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            required className={inputCls} placeholder="you@example.com"
          />
        </Field>
        <Field label="Role">
          <div className={cn(inputCls, "flex items-center opacity-60 cursor-not-allowed")}>
            {profile?.role?.toLowerCase()}
          </div>
        </Field>
        <Field label="Account status">
          <div className={cn(inputCls, "flex items-center gap-2 opacity-60 cursor-not-allowed")}>
            <span className={cn(
              "w-2 h-2 rounded-full shrink-0",
              profile?.status === "ACTIVE" ? "bg-success" : "bg-danger"
            )} />
            {profile?.status?.toLowerCase()}
          </div>
        </Field>
      </div>

      <ErrorMsg msg={error} />
      <SaveRow state={state} />
    </form>
  );
}

// ── Security tab ──────────────────────────────────────────────────────────────

function SecurityTab() {
  const changePassword = useChangePassword();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState("");

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) { setError("Passwords don't match"); return; }
    if (form.newPassword.length < 8) { setError("At least 8 characters required"); return; }
    setState("saving"); setError("");
    try {
      await changePassword.mutateAsync({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword,
      });
      setState("saved");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => setState("idle"), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to change password");
      setState("error");
    }
  }

  function pwStrength(pw: string) {
    if (pw.length < 8) return 1;
    const score = [/[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(pw)).length;
    if (pw.length >= 12 && score === 3) return 4;
    if (pw.length >= 10 && score >= 2) return 3;
    return 2;
  }
  const strengthColors = ["", "bg-danger", "bg-warning", "bg-success", "bg-success"];
  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];

  return (
    <form onSubmit={handlePassword} className="space-y-5">
      <SectionHeader title="Change Password" description="Choose a strong password of at least 8 characters." />
      <div className="space-y-4">
        <Field label="Current Password">
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              value={form.currentPassword}
              onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
              required className={cn(inputCls, "pr-9")} placeholder="Current password"
            />
            <button type="button" onClick={() => setShowCurrent(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors">
              {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </Field>
        <Field label="New Password">
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={form.newPassword}
              onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
              required className={cn(inputCls, "pr-9")} placeholder="At least 8 characters"
            />
            <button type="button" onClick={() => setShowNew(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors">
              {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {form.newPassword && (
            <div className="space-y-1 mt-1.5">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    i <= pwStrength(form.newPassword) ? strengthColors[pwStrength(form.newPassword)] : "bg-surface-elevated"
                  )} />
                ))}
              </div>
              <p className="text-[11px] text-text-secondary">{strengthLabels[pwStrength(form.newPassword)]}</p>
            </div>
          )}
        </Field>
        <Field label="Confirm New Password">
          <input
            type="password" value={form.confirmPassword}
            onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
            required className={inputCls} placeholder="Repeat new password"
          />
        </Field>
      </div>
      <ErrorMsg msg={error} />
      <SaveRow state={state} label="Update password" />
    </form>
  );
}

// ── Appearance tab ────────────────────────────────────────────────────────────

type DateFmt = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";

function AppearanceTab() {
  const [dateFmt, setDateFmt] = useState<DateFmt>("DD/MM/YYYY");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("workdesk_prefs");
      if (stored) {
        const p = JSON.parse(stored) as { dateFmt?: DateFmt };
        if (p.dateFmt) setDateFmt(p.dateFmt);
      }
    } catch {}
  }, []);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem("workdesk_prefs", JSON.stringify({ dateFmt }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const today = new Date();
  function previewDate(fmt: DateFmt) {
    const d = String(today.getDate()).padStart(2, "0");
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const y = today.getFullYear();
    if (fmt === "DD/MM/YYYY") return `${d}/${m}/${y}`;
    if (fmt === "MM/DD/YYYY") return `${m}/${d}/${y}`;
    return `${y}-${m}-${d}`;
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <SectionHeader title="Appearance" description="Customize how WorkDesk looks for you." />

      {/* Theme */}
      <div className="space-y-3">
        <p className="text-[12px] font-medium text-text-secondary">Theme</p>
        <div className="flex gap-2">
          {(["Dark", "System", "Light"] as const).map(t => (
            <div key={t} className={cn(
              "flex-1 h-16 rounded-lg border flex flex-col items-center justify-center gap-1.5 transition-colors",
              t === "Dark"
                ? "border-primary bg-primary/10"
                : "border-border-default bg-surface-secondary opacity-40 cursor-not-allowed"
            )}>
              <Monitor size={16} className={t === "Dark" ? "text-primary" : "text-text-secondary"} />
              <span className={cn("text-[11px] font-medium", t === "Dark" ? "text-primary" : "text-text-secondary")}>{t}</span>
              <span className={cn("text-[9px]", t === "Dark" ? "text-primary/70" : "text-text-secondary")}>
                {t === "Dark" ? "Active" : "V2"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Date format */}
      <div className="space-y-3">
        <p className="text-[12px] font-medium text-text-secondary">Date Format</p>
        <div className="space-y-2">
          {(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const).map(fmt => (
            <label key={fmt} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border-default bg-surface-secondary cursor-pointer hover:bg-surface-elevated transition-colors">
              <input type="radio" name="dateFmt" value={fmt} checked={dateFmt === fmt} onChange={() => setDateFmt(fmt)} className="accent-primary" />
              <span className="text-[13px] text-text-primary flex-1">{fmt}</span>
              <span className="text-[12px] text-text-secondary font-mono">{previewDate(fmt)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" className="h-9 px-5 text-[13px] font-medium bg-primary text-on-primary rounded hover:opacity-90 transition-opacity">
          Save preferences
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-[13px] text-success">
            <CheckCircle2 size={14} /> Saved
          </span>
        )}
      </div>
    </form>
  );
}

// ── Notifications tab ─────────────────────────────────────────────────────────

interface NotifPrefs { bulletinDeadlines: boolean; messageSounds: boolean; desktopNotifs: boolean; }

function NotificationsTab() {
  const [prefs, setPrefs] = useState<NotifPrefs>({
    bulletinDeadlines: true, messageSounds: true, desktopNotifs: false,
  });
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem("workdesk_notif_prefs");
      if (stored) setPrefs(JSON.parse(stored) as NotifPrefs);
    } catch {}
  }, []);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem("workdesk_notif_prefs", JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function requestDesktopPermission() {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    if (perm === "granted") setPrefs(p => ({ ...p, desktopNotifs: true }));
  }

  const notifGranted = mounted && "Notification" in window && Notification.permission === "granted";
  const notifDefault = mounted && "Notification" in window && Notification.permission === "default";

  function ToggleRow({ label, hint, value, onChange, extra }: {
    label: string; hint: string; value: boolean; onChange: (v: boolean) => void; extra?: React.ReactNode;
  }) {
    return (
      <div className="flex items-start gap-3 py-3 border-b border-border-default last:border-b-0">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-text-primary">{label}</p>
          <p className="text-[12px] text-text-secondary mt-0.5">{hint}</p>
          {extra}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={value}
          onClick={() => onChange(!value)}
          className={cn(
            "toggle-track relative inline-flex w-11 h-6 rounded-full shrink-0 mt-0.5",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary outline-offset-2",
            value ? "bg-primary" : "bg-surface-container border border-border-default"
          )}
        >
          <span className={cn(
            "toggle-thumb absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full bg-white",
            value ? "translate-x-5" : "translate-x-0"
          )} />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <SectionHeader title="Notifications" description="Control what alerts and sounds WorkDesk shows you." />

      <div className="rounded-lg border border-border-default bg-surface-secondary overflow-hidden px-4">
        <ToggleRow
          label="Bulletin deadline reminders"
          hint="Show a badge when you have pending countdown tasks."
          value={prefs.bulletinDeadlines}
          onChange={v => setPrefs(p => ({ ...p, bulletinDeadlines: v }))}
        />
        <ToggleRow
          label="Message sounds"
          hint="Play a subtle sound when a new message arrives."
          value={prefs.messageSounds}
          onChange={v => setPrefs(p => ({ ...p, messageSounds: v }))}
        />
        <ToggleRow
          label="Desktop notifications"
          hint={notifGranted ? "Browser permission granted." : "Show browser notifications for new messages."}
          value={prefs.desktopNotifs}
          onChange={v => {
            if (v && !notifGranted) { void requestDesktopPermission(); return; }
            setPrefs(p => ({ ...p, desktopNotifs: v }));
          }}
          extra={notifDefault ? (
            <button type="button" onClick={() => { void requestDesktopPermission(); }}
              className="mt-1.5 text-[11px] text-primary hover:underline">
              Grant browser permission →
            </button>
          ) : undefined}
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" className="h-9 px-5 text-[13px] font-medium bg-primary text-on-primary rounded hover:opacity-90 transition-opacity">
          Save preferences
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-[13px] text-success">
            <CheckCircle2 size={14} /> Saved
          </span>
        )}
      </div>
    </form>
  );
}

// ── Account tab ───────────────────────────────────────────────────────────────

function AccountTab() {
  const router = useRouter();
  const { clear } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await api.post("/api/auth/logout");
    } finally {
      clear();
      router.push("/login");
    }
  }

  return (
    <div className="space-y-8">
      <SectionHeader title="Account" description="Manage your WorkDesk account." />

      {/* Summary */}
      <div className="rounded-lg border border-border-default bg-surface-secondary p-4 space-y-3">
        <p className="text-[13px] font-medium text-text-primary">Account summary</p>
        <ul className="space-y-1.5 text-[13px] text-text-secondary">
          <li>· All your artifacts are stored in your archive</li>
          <li>· Messages and conversations are private to you and your recipients</li>
          <li>· Starred items and version history are preserved until explicitly deleted</li>
          <li>· Trash items are permanently purged after 30 days</li>
        </ul>
      </div>

      {/* Sign out */}
      <div className="rounded-lg border border-border-default bg-surface-secondary p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-text-primary">Sign out</p>
          <p className="text-[12px] text-text-secondary mt-0.5">End your current session and return to the login screen.</p>
        </div>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-1.5 h-8 px-4 text-[12px] font-medium border border-border-default rounded text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors disabled:opacity-50 shrink-0"
        >
          {signingOut ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
          Sign out
        </button>
      </div>

      {/* Danger zone */}
      <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} className="text-danger shrink-0" />
          <p className="text-[13px] font-semibold text-danger">Danger Zone</p>
        </div>
        <div>
          <p className="text-[13px] font-medium text-text-primary">Data export &amp; deletion</p>
          <p className="text-[12px] text-text-secondary mt-0.5">
            Contact your admin to request a data export or account deletion. Account deletion is irreversible
            and removes all your artifacts, versions, and messages permanently.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left nav */}
      <div className="w-[210px] shrink-0 border-r border-border-default bg-surface-secondary flex flex-col">
        <div className="px-4 py-3 border-b border-border-default shrink-0">
          <span className="text-[13px] font-semibold text-text-primary">Settings</span>
        </div>
        <nav className="p-2 space-y-0.5 flex-1 overflow-y-auto">
          {NAV.map(n => (
            <NavItem key={n.id} {...n} active={tab === n.id} onClick={() => setTab(n.id)} />
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-border-default shrink-0">
          <p className="text-[10px] text-text-secondary">WorkDesk · Flex Studios</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-[560px] p-8">
          {tab === "profile"       && <ProfileTab />}
          {tab === "security"      && <SecurityTab />}
          {tab === "appearance"    && <AppearanceTab />}
          {tab === "notifications" && <NotificationsTab />}
          {tab === "account"       && <AccountTab />}
        </div>
      </div>
    </div>
  );
}
