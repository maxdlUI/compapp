"""Builds the installable Repline web app (app/) and the Windows desktop app source (desktop/app/)
from the single page source daily-pro-routine/index.html.

Usage:  python3 tools/build_app.py
Then deploy the app/ folder to any HTTPS host (for example Netlify or repline.gg).
"""
import json, os, re, shutil, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "index.html")
APP = os.path.join(ROOT, "app")
DESK = os.path.join(ROOT, "desktop", "app")

src = open(SRC, encoding="utf-8").read()
cut = src.index('<svg width="0"')
head, body = src[:cut], src[cut:]
head = re.sub(r'<meta name="claude:viewport-fit-sides"[^>]*>\n?', "", head)

HEAD_TOP = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#000000">
<meta name="color-scheme" content="dark">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Repline">
<style>
:root { padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
body { margin: 0; }
img { max-width: 100%; }
[hidden] { display: none !important; }
@media (hover: hover) and (pointer: fine) {
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-track { background: #000; }
  ::-webkit-scrollbar-thumb { background: #333336; border-radius: 99px; border: 2px solid #000; }
  ::-webkit-scrollbar-thumb:hover { background: #48484a; }
}
</style>
"""

SW_REG = """
<script>
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
</script>
"""

page = HEAD_TOP + head + "</head>\n<body>\n" + body + SW_REG + "</body>\n</html>\n"

os.makedirs(APP, exist_ok=True)
open(os.path.join(APP, "index.html"), "w", encoding="utf-8").write(page)

manifest = {
    "name": "Repline",
    "short_name": "Repline",
    "description": "Daily Pro Routine. Pick a goal, pick a length, train set by set.",
    "id": "./",
    "start_url": "./",
    "scope": "./",
    "display": "standalone",
    "orientation": "any",
    "background_color": "#000000",
    "theme_color": "#000000",
    "categories": ["games", "sports", "productivity"],
    "icons": [
        {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
        {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
        {"src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}
    ],
    "shortcuts": [
        {"name": "Start routine", "url": "./#goal", "icons": [{"src": "icons/icon-192.png", "sizes": "192x192"}]}
    ]
}
open(os.path.join(APP, "manifest.webmanifest"), "w", encoding="utf-8").write(json.dumps(manifest, indent=2) + "\n")

IMG = os.path.join(ROOT, "img")
if os.path.isdir(os.path.join(APP, "img")):
    shutil.rmtree(os.path.join(APP, "img"))
if os.path.isdir(IMG):
    shutil.copytree(IMG, os.path.join(APP, "img"))
VENDOR = os.path.join(ROOT, "vendor")
if os.path.isdir(os.path.join(APP, "vendor")):
    shutil.rmtree(os.path.join(APP, "vendor"))
if os.path.isdir(VENDOR):
    shutil.copytree(VENDOR, os.path.join(APP, "vendor"), ignore=shutil.ignore_patterns("*.txt"))
files = ["./", "index.html", "manifest.webmanifest"] + (["img/" + f for f in sorted(os.listdir(IMG)) if f.endswith("-s.webp")] if os.path.isdir(IMG) else []) + (["vendor/" + f for f in sorted(os.listdir(os.path.join(APP, "vendor")))] if os.path.isdir(os.path.join(APP, "vendor")) else []) + ["icons/" + f for f in sorted(os.listdir(os.path.join(APP, "icons"))) if f.endswith(".png")]
version = hashlib.sha1(page.encode("utf-8")).hexdigest()[:10]
sw = f"""// Repline service worker: keeps the app working offline.
const CACHE = "repline-{version}";
const FILES = {json.dumps(files)};
self.addEventListener("install", (e) => {{ e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); }});
self.addEventListener("activate", (e) => {{ e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); }});
self.addEventListener("fetch", (e) => {{
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  if (r.mode === "navigate") {{
    e.respondWith(fetch(r).then((res) => {{ const copy = res.clone(); caches.open(CACHE).then((c) => c.put("index.html", copy)); return res; }}).catch(() => caches.match("index.html")));
    return;
  }}
  e.respondWith(caches.match(r).then((hit) => hit || fetch(r)));
}});
// Training reminders sent by the "remind" edge function
self.addEventListener("push", (e) => {{
  let d = {{}}; try {{ d = e.data ? e.data.json() : {{}}; }} catch (x) {{}}
  e.waitUntil(self.registration.showNotification(d.title || "Repline", {{ body: d.body || "", icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "repline-reminder", data: {{ url: d.url || "./" }} }}));
}});
self.addEventListener("notificationclick", (e) => {{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({{ type: "window", includeUncontrolled: true }}).then((ws) => {{ for (const w of ws) if ("focus" in w) return w.focus(); return self.clients.openWindow((e.notification.data && e.notification.data.url) || "./"); }}));
}});
"""
open(os.path.join(APP, "sw.js"), "w", encoding="utf-8").write(sw)

# Netlify / static host niceties
open(os.path.join(APP, "_headers"), "w").write("/sw.js\n  Cache-Control: no-cache\n/manifest.webmanifest\n  Content-Type: application/manifest+json\n")

# Desktop copy (Electron loads it from disk; no service worker needed there)
if os.path.isdir(DESK):
    shutil.rmtree(DESK)
shutil.copytree(APP, DESK, ignore=shutil.ignore_patterns("sw.js", "_headers"))
print("built app/ and desktop/app/ · cache", version)
