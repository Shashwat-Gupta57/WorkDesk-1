"use client";

import { useEffect } from "react";

// Registers the service worker in production (or when explicitly enabled).
// Silently skips in unsupported browsers.
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failures are non-fatal — app works without the SW.
      });
    }
  }, []);

  return null;
}
