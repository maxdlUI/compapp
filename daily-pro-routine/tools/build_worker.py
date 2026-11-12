"""Packs the built web app (app/) into one Cloudflare Pages _worker.js that serves every file itself.
Used for publishing through the Cloudflare API with a Pages-only token (no separate asset upload).

Usage:  python3 tools/build_worker.py   ->  writes dist-worker/_worker.js
"""
import base64, json, mimetypes, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "app")
OUT = os.path.join(ROOT, "dist-worker")

TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".webmanifest": "application/manifest+json",
         ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon", ".svg": "image/svg+xml", ".json": "application/json", ".css": "text/css; charset=utf-8"}
NO_CACHE = {"/index.html", "/sw.js", "/manifest.webmanifest"}

REL = json.load(open(os.path.join(ROOT, "release.json")))

files = {}
for dirpath, _, names in os.walk(APP):
    for n in names:
        if n == "_headers":
            continue
        full = os.path.join(dirpath, n)
        rel = "/" + os.path.relpath(full, APP).replace(os.sep, "/")
        ext = os.path.splitext(n)[1].lower()
        ctype = TYPES.get(ext) or mimetypes.guess_type(n)[0] or "application/octet-stream"
        cache = "no-cache" if rel in NO_CACHE else "public, max-age=86400"
        files[rel] = {"t": ctype, "c": cache, "b": base64.b64encode(open(full, "rb").read()).decode("ascii")}

worker = """// Repline web app, served from one Pages worker. Built by tools/build_worker.py; do not edit by hand.
const FILES = %s;
const RELEASE = %s;
const bin = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const cache = new Map();
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    let path = decodeURIComponent(url.pathname);
    // Windows app download: streamed from the private R2 bucket (binding DOWNLOADS). No public bucket link exists.
    if (path === "/download/windows" || path === "/download/windows/") {
      if (!env || !env.DOWNLOADS) return new Response("Download is not available right now.", { status: 503, headers: { "content-type": "text/plain" } });
      const w = RELEASE.windows;
      const head = { "content-type": "application/zip", "content-disposition": `attachment; filename="${w.filename}"`, "cache-control": "no-store", "x-content-type-options": "nosniff" };
      if (request.method === "HEAD") return new Response(null, { headers: { ...head, "content-length": String(w.bytes) } });
      const obj = await env.DOWNLOADS.get(w.key);
      if (!obj) return new Response("Download is not available right now.", { status: 404, headers: { "content-type": "text/plain" } });
      return new Response(obj.body, { headers: { ...head, "content-length": String(obj.size), etag: obj.httpEtag } });
    }
    if (path === "/download/windows.json") return new Response(JSON.stringify({ version: RELEASE.version, url: "/download/windows", bytes: RELEASE.windows.bytes }), { headers: { "content-type": "application/json", "cache-control": "no-cache" } });
    if (path === "/" || path === "") path = "/index.html";
    let f = FILES[path];
    let status = 200;
    if (!f) { if (/\\.[a-z0-9]+$/i.test(path)) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } }); f = FILES["/index.html"]; path = "/index.html"; }
    if (!cache.has(path)) cache.set(path, bin(f.b));
    const headers = { "content-type": f.t, "cache-control": f.c, "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin" };
    return new Response(request.method === "HEAD" ? null : cache.get(path), { status, headers });
  }
};
""" % (json.dumps(files, separators=(",", ":")), json.dumps(REL))

os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, "_worker.js"), "w", encoding="utf-8").write(worker)
print("dist-worker/_worker.js", round(len(worker) / 1024), "KB,", len(files), "files")
