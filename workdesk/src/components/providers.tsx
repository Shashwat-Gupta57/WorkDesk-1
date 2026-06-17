"use client";

import { useState, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth-context";

// ─────────────────────────────────────────────────────────────────────────────
// Root client providers: TanStack Query + Auth session.
// Mounted once in the root layout, wrapping the whole app.
// ─────────────────────────────────────────────────────────────────────────────

export function Providers({ children }: { children: ReactNode }) {
  // One QueryClient per browser session (created lazily, never re-created on render).
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
