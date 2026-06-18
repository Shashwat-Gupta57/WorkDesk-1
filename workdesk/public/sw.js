// WorkDesk Service Worker — V1 offline shell cache
// Caches the app shell on install; serves from cache-then-network for navigation.
// API calls always go to the network (no offline data support in V1).

const CACHE_NAME = "workdesk-v1";

// App shell assets to pre-cache on install
const SHELL_URLS = ["/", "/login", "/dashboard"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Remove old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache API or Next internals
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/") ||
    request.method !== "GET"
  ) {
    return;
  }

  // Network-first for navigation; fall back to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful navigations
        if (response.ok && request.mode === "navigate") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
