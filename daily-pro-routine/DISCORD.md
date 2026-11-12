# Repline Discord-Server: Bauplan

Diesen Server legst du in deinem Discord-Konto an. Alle Texte unten sind auf Englisch, passend zur Website, und können direkt kopiert werden.

## Wichtig vorab: Dateigröße beim Download

- Die Windows-App ist als Zip rund **115 MB** groß.
- Discord erlaubt ohne Nitro nur **10 MB** pro Datei. Auch mit Server-Boosts reicht es nicht, denn Level 3 erlaubt höchstens 100 MB.
- **Hochladen geht nur mit Discord Nitro**: bis 500 MB pro Datei. Nitro Basic erlaubt nur 50 MB, das reicht nicht.
- Links zu Discord-Anhängen laufen nach etwa 24 Stunden ab. Ein Download-Button auf der Website kann deshalb nicht direkt auf die Datei zeigen. Er führt in den Server, und dort lädt man die App aus **#download** herunter.
- Automatische Updates gibt es auf diesem Weg nicht. Bei jeder neuen Version postest du die neue Datei in #download, und alle mit der Rolle **App updates** werden benachrichtigt.

## 1. Server anlegen

1. Discord öffnen, links auf **+** (Server hinzufügen) klicken, dann **Selbst erstellen** und **Für einen Club oder eine Community** wählen.
2. Name: **Repline**. Als Icon `Repline-Discord-Icon.png` hochladen (liegt bei).
3. **Servereinstellungen → Community aktivieren:** Das schaltet Regeln-Kanal, Willkommensbildschirm, Ankündigungskanäle und Onboarding frei.
4. **Servereinstellungen → Sicherheit:**
   - Verifizierungsstufe **Mittel** (Konto älter als 5 Minuten)
   - Filter für anstößige Medien: **Alle Mitglieder**
   - **2FA für Moderation** an
5. **AutoMod:** „Spam-Inhalte blockieren“ und „Mention-Spam blockieren“ (ab 5 Erwähnungen) aktivieren.

## 2. Rollen (von oben nach unten)

| Rolle | Farbe | Zweck |
|---|---|---|
| **Founder** | Weiß | Du, alle Rechte |
| **Mod** | Blau `#3f8dff` | Nachrichten verwalten, Timeout, Threads verwalten |
| **Dev** | Cyan `#38e0ff` | Tester, sehen #dev-log |
| **Partner** | Lila `#a855f7` | Map-Ersteller, Teams, Creator |
| **Pro** | Verlauf Blau→Lila, sonst Lila | Pro-Abonnenten (später automatisch) |
| **Standard** | Grün `#30d158` | Standard-Abonnenten (später automatisch) |
| **App updates** | keine Farbe, erwähnbar | Selbst wählbar: Ping bei neuer App-Version |
| **Cup player** / **Grinder** | keine Farbe | Selbst wählbar im Onboarding |

## 3. Kategorien und Kanäle

**START HERE** (für @everyone nur lesen)
- `#welcome`: Willkommenstext (unten)
- `#rules`: Regeln (unten), als Regeln-Kanal der Community festlegen
- `#announcements`: Ankündigungskanal. Neues zu Website und App.
- `#download`: Hier liegt die Windows-App. Nur du postest.

**COMMUNITY**
- `#general`: Slowmode 5 Sekunden
- `#clips`: Clips und Fortschritt, nur Medien und Links
- `#find-a-duo`: Trainings- und Cup-Partner suchen
- `#my-routines`: eigene Routinen aus dem Baukasten teilen

**HELP**
- `#support`: Forum-Kanal mit den Tags *Website*, *Windows app*, *Account*, *Sign-in*
- `#bug-reports`: Forum-Kanal
- `#ideas`: Forum-Kanal, Reaktionen 👍 erlaubt

**PARTNERS**
- `#partners-info`: nur lesen. Was Partner bekommen (Coming soon).
- `#partner-requests`: Forum-Kanal, für Anfragen von Map-Erstellern, Teams und Creators

**VOICE**
- 🔊 Training 1 · 🔊 Training 2 · 🔊 Duo (Limit 2) · 🔊 Trio (Limit 3) · 🔊 Squad (Limit 4)

**TEAM** (privat: nur Founder, Mod, Dev)
- `#team-chat` · `#dev-log`

## 4. Onboarding (Servereinstellungen → Onboarding)

- **Standardkanäle:** welcome, rules, announcements, download, general, support
- **Frage 1 „What brings you here?“** (Mehrfachauswahl):
  - „Download the Windows app“ → Rolle *App updates*, Kanal #download
  - „Cups“ → Rolle *Cup player*
  - „Getting better every day“ → Rolle *Grinder*
- **Willkommensbildschirm:** #download „Get the Windows app“, #support „Need help?“, #general „Say hi“

## 5. Einladungslink für die Website

- Rechtsklick auf `#welcome` → **Leute einladen** → **Einladungslink bearbeiten** → **Läuft ab: Nie**, **Max. Anzahl: Kein Limit**.
- Den Link (`https://discord.gg/…`) schickst du mir. Damit werden alle Discord-Knöpfe auf der Website aktiv, und „Download for Windows“ führt in den Server.

---

## Texte zum Kopieren

### #welcome

```
**Welcome to Repline.** 👋

Your daily pro routine for Fortnite. Set by set, timed, with an in-game overlay.

🌐 **Website** · https://repline.pages.dev
💻 **Windows app** · #download
📣 **News** · #announcements
❓ **Help** · #support

Start with the rules in #rules, then say hi in #general.
```

### #rules

```
**Rules**

**1 · Be respectful.** No hate, harassment, slurs or personal attacks.
**2 · No cheats.** No cheats, exploits, account selling or boosting.
**3 · No spam.** No ads, self-promo or DM ads without permission from the team.
**4 · Keep it in the right channel.** Help in #support, bugs in #bug-reports.
**5 · Safe content only.** No NSFW, gore or shock content.
**6 · Never share accounts.** The team will never ask for your password or 2FA code.
**7 · Follow Discord's rules.** https://discord.com/terms · https://discord.com/guidelines

Breaking the rules can lead to a timeout, kick or ban.
Repline is an independent service, not affiliated with Epic Games.
```

### #download (Post pro Version, die Zip als Anhang)

```
**Repline for Windows · v1.4** 💻

**Install**
1. Download the zip below.
2. Right-click it → **Extract All**.
3. Open the folder and start **Repline.exe**.

Windows may show "Windows protected your PC". Click **More info** → **Run anyway**.
The app is new and not signed yet, which is why Windows shows this.

**What's new in 1.4**
• Get ready countdown between sets (30 s, change it in Settings)
• Sign in with Discord to train
• Overlay shows the countdown

Windows 10 and 11 · 64-bit
Problems? → #support
```

### #announcements (Vorlage für neue Versionen)

```
@App updates **Repline v1.X is out.**

• …
• …

Download in #download. Delete the old folder after you extract the new one.
Your progress is saved in your account.
```

### #partners-info

```
**Partners · coming soon**

Map creators, teams and coaches who build Repline with us.
Your maps inside every routine, with your name on them.

Interested? Open a post in #partner-requests.
```

## Später

- Rollen **Pro** und **Standard** automatisch vergeben, sobald Stripe läuft: per Bot oder Discord „Linked Roles“. Das Discord-Login gibt es schon.
- Sobald R2 oder eine eigene Domain da ist, kann der Download wieder direkt über die Website laufen, mit Auto-Update. Discord bleibt dann für Community und Support.
