"""Publishes a built Windows installer to the private R2 bucket and records it in release.json.

Usage:  python3 tools/publish_windows.py <dist-dir>      (the electron-builder output with latest.yml)
Then:   tools/deploy.sh production                      (the site worker serves the new latest.yml and installer)

Keeps the new installer and the one before it in the bucket; older files are removed. Needs a Cloudflare
token with "Workers R2 Storage · Edit" (injected by the environment, nothing is read from disk).
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REL = os.path.join(ROOT, "release.json")
API = "https://api.cloudflare.com/client/v4"
BUCKET = "repline-downloads"

def api(method, path, *extra):
    out = subprocess.run(["curl", "-sS", "-m", "900", "-X", method, API + path, *extra], capture_output=True, text=True).stdout
    d = json.loads(out)
    if not d.get("success"):
        sys.exit(f"Cloudflare error on {method} {path}: {d.get('errors')}")
    return d.get("result")

dist = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "desktop", "dist")
yml = open(os.path.join(dist, "latest.yml"), encoding="utf-8").read()
meta = {}
for line in yml.splitlines():
    if line and not line.startswith(" ") and ":" in line:
        k, v = line.split(":", 1); meta[k.strip()] = v.strip().strip("'")
version, name = meta["version"], meta["path"]
exe = os.path.join(dist, name)
size = os.path.getsize(exe)

acc = api("GET", "/accounts?per_page=5")[0]["id"]
key = "win/" + name
print(f"uploading {name} ({round(size / 1048576)} MB) …")
api("PUT", f"/accounts/{acc}/r2/buckets/{BUCKET}/objects/{key}", "-H", "Content-Type: application/vnd.microsoft.portable-executable", "--data-binary", "@" + exe)

old = json.load(open(REL)) if os.path.exists(REL) else {}
prev = (old.get("windows") or {}).get("key")
keep = {key, prev}
rel = {"version": version, "windows": {"key": key, "filename": name, "bytes": size}, "previous": prev, "latestYml": yml}
json.dump(rel, open(REL, "w"), indent=2)
open(REL, "a").write("\n")

listing = api("GET", f"/accounts/{acc}/r2/buckets/{BUCKET}/objects?per_page=100") or []
for o in listing:
    if o["key"] not in keep:
        api("DELETE", f"/accounts/{acc}/r2/buckets/{BUCKET}/objects/{o['key']}")
        print("removed old", o["key"])
print(f"release.json -> {version}. Now run: tools/deploy.sh production")
