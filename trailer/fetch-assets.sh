#!/usr/bin/env bash
# Lädt die echte Fortnite-Map (aktuelle Season, aus den Spieldateien) nach trailer/assets/fortnite/.
# Nicht committen: Rechte bei Epic Games.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p assets/fortnite
curl -fsS -o assets/fortnite/map_blank.png https://fortnite-api.com/images/map.png
curl -fsS -o assets/fortnite/map_en.png    https://fortnite-api.com/images/map_en.png
curl -fsS -o assets/fortnite/map.json      https://fortnite-api.com/v1/map
echo "OK: assets/fortnite/"
