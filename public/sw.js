// Forge Coach service worker — caches the app shell so it loads instantly
// on repeat visits and works with zero internet connection.
// Data (clients, programs, etc.) still comes from Supabase / the app's own
// offline queue - this only caches the HTML/JS/CSS files themselves.

const CACHE_NAME = "forge-shell-v1";
const SHELL_FILES = ["/", "/index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first for the app's own files (JS/CSS/HTML), network-first for
// everything else (Supabase API calls, images) so data stays fresh.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isOwnAsset = url.origin === self.location.origin;

  if (!isOwnAsset) return; // let API/network calls pass straight through

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
