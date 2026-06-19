"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { Brand } from "@/components/brand";
import { StorageUsageBar } from "@/components/shell/storage-usage-bar";
import { useUnreadCount } from "@/modules/messaging/hooks";
import { NotificationBell } from "@/components/notifications/notification-bell";

// ─────────────────────────────────────────────────────────────────────────────
// Persistent left sidebar (V1 nav only).
//
// Per PLAN-v1: V1 surfaces Dashboard, Archive, Settings, Profile. V2 items
// (Library, Messages, Bulletin, Mail Hub, Graph) are intentionally omitted until
// their modules exist. Bottom area = storage usage + user card + logout.
// ─────────────────────────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function Icon({ d }: { d: string }) {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <Icon d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z" /> },
  { href: "/bulletin", label: "Bulletin", icon: <Icon d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" /> },
  { href: "/messaging", label: "Messages", icon: <Icon d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /> },
  { href: "/library", label: "Library", icon: <Icon d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z" /> },
  { href: "/graph", label: "Graph", icon: <Icon d="M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM4 17a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm16 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM12 8v3m0 3v3M6.5 18.5l4-2.5M17.5 18.5l-4-2.5" /> },
  { href: "/archive", label: "Archive", icon: <Icon d="M3 7h18M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /> },
  { href: "/archive/shared", label: "Shared with me", icon: <Icon d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /> },
  { href: "/archive/starred", label: "Starred", icon: <Icon d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" /> },
  { href: "/archive/trash", label: "Trash", icon: <Icon d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" /> },
  { href: "/settings", label: "Settings", icon: <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-2-1.2L14.5 2h-4l-.4 2.6a7.3 7.3 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.3 7.3 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2Z" /> },
  { href: "/profile", label: "Profile", icon: <Icon d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm-8 9a8 8 0 0 1 16 0" /> },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clear } = useAuth();
  const { data: unreadData } = useUnreadCount();
  const unreadCount = unreadData?.count ?? 0;

  async function handleLogout() {
    try {
      await api.post("/api/auth/logout");
    } finally {
      clear();
      router.push("/login");
    }
  }

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-sidebar-width flex-col border-r border-border-default bg-surface-secondary px-2 py-4">
      {/* Brand */}
      <div className="mb-8 px-2">
        <Brand size={32} />
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar">
        {NAV.map((item) => {
          // Exact match wins; prefix match only if no sibling nav item matches more specifically.
          const exactMatch = pathname === item.href;
          const prefixMatch = !exactMatch && pathname.startsWith(item.href + "/");
          // Suppress prefix match for /archive if a deeper archive sub-route is also in NAV.
          const deeperActive = prefixMatch && NAV.some(
            (other) => other.href !== item.href && (pathname === other.href || pathname.startsWith(other.href + "/"))
          );
          const active = exactMatch || (prefixMatch && !deeperActive);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "flex items-center gap-3 rounded px-3 h-9 text-sm transition-colors " +
                (active
                  ? "bg-surface-container-high font-semibold text-primary"
                  : "text-text-secondary hover:bg-surface-container hover:text-text-primary")
              }
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.href === "/messaging" && unreadCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: notifications + storage usage + user + logout */}
      <div className="mt-auto space-y-2 border-t border-border-default px-1 pt-4">
        <NotificationBell />
        <StorageUsageBar />
        <div className="flex items-center gap-3 rounded border border-border-default bg-surface-container-low p-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high text-sm font-semibold text-text-primary">
            {(user?.name ?? "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-text-primary">{user?.name ?? "—"}</p>
            <p className="truncate text-xs text-text-secondary">{user?.email ?? ""}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-container hover:text-danger"
        >
          <Icon d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
