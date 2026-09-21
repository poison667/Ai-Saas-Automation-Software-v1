/* Lumina service worker — offline-first for the app shell, network-first for the API */
const CACHE = "lumina-shell-v7";
const SHELL = ["/", "/styles.css", "/core.js", "/pages1.js", "/pages2.js", "/pages3.js",
               "/pages4.js", "/pages5.js", "/pages6.js", "/pages7.js", "/pages8.js", "/pages9.js", "/manifest.webmanifest", "/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) {
    // API: always network (fresh data); fall back to nothing — UI handles errors
    return;
  }
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match("/")))
  );
});
