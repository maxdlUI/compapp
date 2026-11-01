#!/usr/bin/env bash
# Lädt die Original-Assets (nicht im Repo, wegen Lizenz/Marke) nach ./assets:
#  - SF Pro (Apple, https://developer.apple.com/fonts/) – nur für UI-Mockups von Apple-Plattformen lizenziert
#  - iPhone 17 Pro Bezel (Apple Design Resources)
#  - WhatsApp-Logo (Wikimedia Commons, Marke von WhatsApp LLC / Meta)
# Benötigt: curl, 7z (p7zip-full)
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p assets .tmp; cd .tmp
curl -fSL -o SF-Pro.dmg https://devimages-cdn.apple.com/design/resources/download/SF-Pro.dmg
curl -fSL -o Bezel.dmg https://devimages-cdn.apple.com/design/resources/download/Bezel-iPhone-17.dmg
curl -fSL -o ../assets/whatsapp-logo.svg https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg
7z e -y Bezel.dmg "Bezel-iPhone-17/PNG/iPhone 17 Pro/iPhone 17 Pro - Silver - Portrait.png" >/dev/null
mv "iPhone 17 Pro - Silver - Portrait.png" ../assets/iphone-17-pro-silver.png
7z e -y SF-Pro.dmg SFProFonts.pkg >/dev/null && 7z x -y -opkg SFProFonts.pkg >/dev/null && 7z x -y -opay "pkg/Payload~" >/dev/null
for w in Regular Medium Semibold Bold Heavy; do cp pay/Library/Fonts/SF-Pro-Display-$w.otf pay/Library/Fonts/SF-Pro-Text-$w.otf ../assets/; done
cd .. && rm -rf .tmp && echo "Assets bereit in ./assets"
