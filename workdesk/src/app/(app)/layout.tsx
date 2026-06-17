import { Sidebar } from "@/components/shell/sidebar";

// ─────────────────────────────────────────────────────────────────────────────
// Authenticated app shell layout.
// Route protection is enforced at the edge by src/proxy.ts — these routes
// (/dashboard, /archive, /settings, /profile) require a session.
// ─────────────────────────────────────────────────────────────────────────────

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface-primary">
      <Sidebar />
      <main className="ml-sidebar-width flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
