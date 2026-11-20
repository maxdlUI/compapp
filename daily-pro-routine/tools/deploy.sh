#!/usr/bin/env bash
# Publishes Repline to Cloudflare Pages (project "repline").
#   tools/deploy.sh preview      -> https://preview.repline.pages.dev  (check here first)
#   tools/deploy.sh production   -> https://repline.pages.dev  (and later repline.gg)
# Needs a Cloudflare API token with "Account · Cloudflare Pages · Edit". In the Claude cloud
# environment "compapp" the token is injected for api.cloudflare.com, so nothing is read from disk.
set -euo pipefail
cd "$(dirname "$0")/.."
TARGET="${1:-preview}"
case "$TARGET" in preview) BRANCH=preview ;; production) BRANCH=main ;; *) echo "use: preview | production"; exit 1 ;; esac
API=https://api.cloudflare.com/client/v4
AUTH=()
[ -n "${CLOUDFLARE_API_TOKEN:-}" ] && AUTH=(-H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")
python3 tools/build_app.py
python3 tools/build_worker.py
ACC="${CLOUDFLARE_ACCOUNT_ID:-$(curl -sS "${AUTH[@]}" "$API/accounts?per_page=5" | python3 -c "import sys,json; print(json.load(sys.stdin)['result'][0]['id'])")}"
curl -sS -m 180 "${AUTH[@]}" -X POST "$API/accounts/$ACC/pages/projects/repline/deployments" \
  -F 'manifest={}' -F "branch=$BRANCH" -F "_worker.js=@dist-worker/_worker.js;filename=_worker.js;type=application/javascript+module" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result') or {}; print('ok' if d.get('success') else 'FAILED', r.get('environment',''), r.get('url',''), d.get('errors') or '')"
