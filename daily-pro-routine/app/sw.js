// Repline service worker: keeps the app working offline.
const CACHE = "repline-d0f4a4a6cf";
const FILES = ["./", "index.html", "manifest.webmanifest", "img/art-build-s.webp", "img/art-ranked-s.webp", "img/map-buildfights-s.webp", "img/map-clutch-s.webp", "img/map-realistics-s.webp", "img/map-turtle-s.webp", "img/map-v5-s.webp", "img/tile-brk-s.webp", "img/tile-kovaaks-s.webp", "img/tile-kovaaks2-s.webp", "img/tile-prep-s.webp", "img/tile-scrims-s.webp", "img/tile-vod-s.webp", "vendor/supabase.js", "icons/apple-touch-icon.png", "icons/favicon-32.png", "icons/icon-1024.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/icon-window-256.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("index.html", copy)); return res; }).catch(() => caches.match("index.html")));
    return;
  }
  e.respondWith(caches.match(r).then((hit) => hit || fetch(r)));
});
// Training reminders sent by the "remind" edge function
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) {}
  e.waitUntil(self.registration.showNotification(d.title || "Repline", { body: d.body || "", icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "repline-reminder", data: { url: d.url || "./" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ws) => { for (const w of ws) if ("focus" in w) return w.focus(); return self.clients.openWindow((e.notification.data && e.notification.data.url) || "./"); }));
});
