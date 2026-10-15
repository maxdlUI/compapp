// Service Worker: legt die App-Dateien beim ersten Besuch in den Cache.
// Danach startet die App auch ohne Internet. Updates laden im Hintergrund nach
// und sind beim nächsten Öffnen aktiv. CACHE hochzählen, wenn Dateien geändert werden (auch config.js).
// Anfragen an andere Server (Supabase, Google) fasst der Service Worker nicht an.
const CACHE = 'krevo-v4';
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'logic.js',
  'map.js',
  'i18n.js',
  'presets.js',
  'presets-ui.js',
  'intro.js',
  'config.js',
  'authclient.js',
  'auth-ui.js',
  'username.js',
  'manifest.webmanifest',
  'krevo-symbol.svg',
  'krevo-wordmark.svg',
  'favicon.svg',
  'favicon-32.png',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // keine fremden Anfragen anfassen

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          // Adressen mit Parametern (z. B. ?code= nach der Google-Anmeldung) landen nicht im Cache
          if (res && res.ok && !url.search) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached || (req.mode === 'navigate' ? caches.match('index.html') : undefined));
      return cached || network;
    })
  );
});
