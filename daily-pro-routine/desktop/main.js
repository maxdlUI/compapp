// Repline for Windows: the main app window plus an optional in-game overlay.
const { app, BrowserWindow, shell, Menu, ipcMain, screen, globalShortcut, Notification } = require("electron");
const path = require("path");
const fs = require("fs");

if (!app.requestSingleInstanceLock()) app.quit();

/* ---------- Automatic updates ----------
   The installed app asks repline.pages.dev/download/win/latest.yml for the newest version (on start and every 6 hours),
   downloads the installer in the background and installs it on the next restart (or right away from the banner). */
let autoUpdater = null;
try { ({ autoUpdater } = require("electron-updater")); } catch (e) { autoUpdater = null; }
let updState = { state: "idle" };
const updOn = () => !!(autoUpdater && app.isPackaged);
function sendUpd() { if (win) win.webContents.send("update:state", { ...updState, current: app.getVersion(), enabled: updOn() }); }
// Small log in %APPDATA%/Repline/updates.log (kept under ~200 KB) to help with support questions.
function ulog(...a) {
  try {
    const f = path.join(app.getPath("userData"), "updates.log");
    if (fs.existsSync(f) && fs.statSync(f).size > 200000) fs.renameSync(f, f + ".old");
    fs.appendFileSync(f, `${new Date().toISOString()} ${a.map((x) => (x && x.stack) || String(x)).join(" ")}\n`);
  } catch (e) {}
}
function setupUpdates() {
  if (!updOn()) return;
  autoUpdater.logger = { info: ulog, warn: ulog, error: ulog, debug: () => {} };
  ulog("Repline", app.getVersion(), "update checks on");
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.disableDifferentialDownload = true;
  autoUpdater.on("checking-for-update", () => { if (updState.state !== "ready") { updState = { state: "checking" }; sendUpd(); } });
  autoUpdater.on("update-available", (i) => { updState = { state: "downloading", version: i.version, progress: 0 }; sendUpd(); });
  autoUpdater.on("update-not-available", () => { updState = { state: "latest", at: Date.now() }; sendUpd(); });
  autoUpdater.on("download-progress", (p) => { updState = { ...updState, state: "downloading", progress: Math.round(p.percent || 0) }; sendUpd(); });
  autoUpdater.on("update-downloaded", (i) => { updState = { state: "ready", version: i.version }; sendUpd(); });
  autoUpdater.on("error", () => { if (updState.state !== "ready") { updState = { state: "error", version: updState.version || null }; sendUpd(); } });
  const check = () => { if (updState.state !== "ready" && updState.state !== "downloading") autoUpdater.checkForUpdates().catch((e) => ulog("check failed", e)); };
  // Using an old version isn't allowed: check right at start and every 30 minutes, the app then asks to update.
  setTimeout(check, 1500);
  setInterval(check, 30 * 60 * 1000);
}
ipcMain.handle("update:get", () => ({ ...updState, current: app.getVersion(), enabled: updOn() }));
ipcMain.handle("update:check", () => { if (updOn() && updState.state !== "ready" && updState.state !== "downloading") autoUpdater.checkForUpdates().catch((e) => ulog("check failed", e)); return true; });
ipcMain.handle("update:install", () => { if (updOn() && updState.state === "ready") setImmediate(() => autoUpdater.quitAndInstall(true, true)); return true; });

/* ---------- Overlay settings (saved in the user's app data folder) ---------- */
const DEFAULTS = { enabled: true, position: "tl", x: null, y: null, size: "m", opacity: 0.92, hotkeys: true };
const SIZES = { s: 0.85, m: 1, l: 1.2 };
const BASE = { w: 380, h: 112 };
const MARGIN = 24;
let settingsFile = null;
let overlaySettings = { ...DEFAULTS };
function loadSettings() {
  settingsFile = path.join(app.getPath("userData"), "overlay.json");
  try { overlaySettings = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsFile, "utf8")) }; } catch (e) { overlaySettings = { ...DEFAULTS }; }
}
function saveSettings() { try { fs.writeFileSync(settingsFile, JSON.stringify(overlaySettings, null, 2)); } catch (e) {} }

let win = null;
let overlay = null;
let lastState = { active: false };
let moving = false;
let previewUntil = 0;
let customSound = "";

/* ---------- Main window ---------- */
function createMain() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 420,
    minHeight: 640,
    title: "Repline",
    backgroundColor: "#000000",
    icon: path.join(__dirname, "app", "icons", "icon-window-256.png"),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false, // keep the timer and the overlay running while the game is in front
      autoplayPolicy: "no-user-gesture-required"
    }
  });
  win.once("ready-to-show", () => win.show());
  win.loadFile(path.join(__dirname, "app", "index.html"));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (/^https?:/.test(url)) { e.preventDefault(); shell.openExternal(url); } });
  win.on("closed", () => { win = null; app.quit(); });
}

/* ---------- Overlay window ---------- */
function overlaySize() { const k = SIZES[overlaySettings.size] || 1; return { w: Math.round(BASE.w * k), h: Math.round(BASE.h * k), k }; }
function presetPoint(pos, w, h) {
  const a = screen.getPrimaryDisplay().workArea;
  const col = pos[1] === "l" ? 0 : pos[1] === "c" ? 1 : 2;
  const row = pos[0] === "t" ? 0 : pos[0] === "m" ? 1 : 2;
  const x = col === 0 ? a.x + MARGIN : col === 1 ? a.x + Math.round((a.width - w) / 2) : a.x + a.width - w - MARGIN;
  const y = row === 0 ? a.y + MARGIN : row === 1 ? a.y + Math.round((a.height - h) / 2) : a.y + a.height - h - MARGIN;
  return { x, y };
}
function onScreen(x, y, w, h) {
  return screen.getAllDisplays().some((d) => { const b = d.workArea; return x + w > b.x + 20 && x < b.x + b.width - 20 && y + h > b.y + 20 && y < b.y + b.height - 20; });
}
function overlayBounds() {
  const { w, h } = overlaySize();
  let p;
  if (overlaySettings.position === "custom" && overlaySettings.x != null && onScreen(overlaySettings.x, overlaySettings.y, w, h)) p = { x: overlaySettings.x, y: overlaySettings.y };
  else p = presetPoint(overlaySettings.position === "custom" ? "tl" : overlaySettings.position, w, h);
  return { x: p.x, y: p.y, width: w, height: h };
}
function createOverlay() {
  if (overlay) return;
  overlay = new BrowserWindow({
    ...overlayBounds(),
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    alwaysOnTop: true,
    show: false,
    title: "Repline overlay",
    webPreferences: { preload: path.join(__dirname, "overlay-preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, autoplayPolicy: "no-user-gesture-required" }
  });
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setVisibleOnAllWorkspaces(true);
  overlay.setIgnoreMouseEvents(true);
  overlay.loadFile(path.join(__dirname, "overlay.html"));
  overlay.webContents.on("did-finish-load", () => { applyOverlayLook(); sendOverlay(); updateOverlayVisibility(); if (customSound) overlay.webContents.send("overlay:custom", customSound); });
  overlay.on("moved", () => {
    if (!moving) return;
    const [x, y] = overlay.getPosition();
    overlaySettings = { ...overlaySettings, position: "custom", x, y };
    saveSettings();
    if (win) win.webContents.send("overlay:settings", overlaySettings);
  });
  overlay.on("closed", () => { overlay = null; });
}
function applyOverlayLook() {
  if (!overlay) return;
  const { k } = overlaySize();
  overlay.setBounds(overlayBounds());
  overlay.webContents.setZoomFactor(k);
  overlay.webContents.send("overlay:look", { opacity: overlaySettings.opacity, hotkeys: overlaySettings.hotkeys });
}
function sendOverlay() { if (overlay) overlay.webContents.send("overlay:state", { ...lastState, moving }); }
function updateOverlayVisibility() {
  if (!overlay) return;
  const show = (overlaySettings.enabled && (lastState.active || moving)) || Date.now() < previewUntil;
  if (show && !overlay.isVisible()) overlay.showInactive();
  if (!show && overlay.isVisible()) overlay.hide();
}
function setMoving(on) {
  moving = !!on;
  if (!overlay) createOverlay();
  overlay.setIgnoreMouseEvents(!moving);
  overlay.setFocusable(moving);
  sendOverlay();
  updateOverlayVisibility();
  if (moving) overlay.showInactive();
}

/* ---------- Hotkeys that work while the game is in front ---------- */
const HOTKEYS = { "CommandOrControl+Shift+Space": "toggle", "CommandOrControl+Shift+N": "next", "CommandOrControl+Shift+R": "restart", "CommandOrControl+Shift+O": "overlay", "CommandOrControl+Shift+E": "end" };
function registerHotkeys() {
  globalShortcut.unregisterAll();
  if (!overlaySettings.hotkeys) return;
  for (const [accel, name] of Object.entries(HOTKEYS)) {
    try {
      globalShortcut.register(accel, () => {
        if (name === "overlay") { overlaySettings.enabled = !overlaySettings.enabled; saveSettings(); updateOverlayVisibility(); if (win) win.webContents.send("overlay:settings", overlaySettings); return; }
        if (name === "end" && win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
        if (win) win.webContents.send("hotkey", name);
      });
    } catch (e) {}
  }
}

/* ---------- IPC ---------- */
ipcMain.handle("overlay:get", () => ({ ...overlaySettings, displays: screen.getAllDisplays().length }));
ipcMain.handle("overlay:set", (_e, patch) => {
  const allowed = ["enabled", "position", "size", "opacity", "hotkeys"];
  for (const k of allowed) if (patch && k in patch) overlaySettings[k] = patch[k];
  if (patch && patch.position && patch.position !== "custom") { overlaySettings.x = null; overlaySettings.y = null; }
  overlaySettings.opacity = Math.min(1, Math.max(0.4, Number(overlaySettings.opacity) || 0.92));
  saveSettings();
  if (overlaySettings.enabled) createOverlay();
  applyOverlayLook();
  updateOverlayVisibility();
  registerHotkeys();
  return { ...overlaySettings };
});
ipcMain.handle("overlay:move", (_e, on) => { setMoving(on); return moving; });
ipcMain.handle("overlay:preview", (_e, p) => {
  if (!overlay) createOverlay();
  previewUntil = Date.now() + 2700;
  updateOverlayVisibility();
  const send = () => overlay && overlay.webContents.send("overlay:preview", { sound: String(p && p.sound || "chime"), anim: String(p && p.anim || "wave") });
  if (overlay.webContents.isLoading()) overlay.webContents.once("did-finish-load", send); else send();
  setTimeout(updateOverlayVisibility, 2800);
  return true;
});
ipcMain.on("overlay:custom", (_e, dataUrl) => {
  customSound = typeof dataUrl === "string" && /^data:audio\//.test(dataUrl) && dataUrl.length < 1500000 ? dataUrl : "";
  if (overlay) overlay.webContents.send("overlay:custom", customSound);
});

/* ---------- Discord sign-in for the Windows app ----------
   The page asks Supabase for the Discord sign-in URL; we show it in a small window and catch the
   redirect back to repline.pages.dev/auth/desktop, then hand the one-time code to the page. */
const SUPABASE_AUTH = "https://wjwjvwjwlipjxsgufffj.supabase.co/auth/v1/authorize";
const DESKTOP_RETURN = "https://repline.pages.dev/auth/desktop";
let authWin = null;
ipcMain.handle("auth:discord", (_e, url) => new Promise((resolve) => {
  if (typeof url !== "string" || !url.startsWith(SUPABASE_AUTH)) return resolve(null);
  if (authWin) { authWin.focus(); return resolve(null); }
  let done = false;
  const finish = (code) => { if (done) return; done = true; resolve(code || null); if (authWin) { const w = authWin; authWin = null; w.close(); } };
  authWin = new BrowserWindow({
    width: 520, height: 780, parent: win || undefined, modal: false, title: "Sign in with Discord",
    backgroundColor: "#000000", autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, partition: "persist:repline-auth" }
  });
  const check = (ev, target) => {
    if (typeof target === "string" && target.startsWith(DESKTOP_RETURN)) {
      if (ev && ev.preventDefault) ev.preventDefault();
      let code = null; try { code = new URL(target).searchParams.get("code"); } catch (e) {}
      finish(code);
    }
  };
  authWin.webContents.on("will-redirect", check);
  authWin.webContents.on("will-navigate", check);
  authWin.webContents.setWindowOpenHandler(({ url: u }) => { if (/^https?:/.test(u)) shell.openExternal(u); return { action: "deny" }; });
  authWin.on("closed", () => { authWin = null; finish(null); });
  authWin.loadURL(url);
}));

ipcMain.on("overlay:state", (_e, state) => {
  lastState = state && typeof state === "object" ? state : { active: false };
  sendOverlay();
  updateOverlayVisibility();
  updateRpc();
});

/* ---------- Discord status ("Playing Repline") ----------
   Talks to the Discord app on this PC. Shows the running set while a routine is active, nothing otherwise. */
const DISCORD_APP_ID = "1570194691465420870";
let rpc = null, rpcReady = false, rpcConnecting = false, rpcRetry = 0, rpcKey = "", rpcSentAt = 0, rpcTimer = 0;
let rpcSettings = { on: true, name: true };
function rpcConnect() {
  if (rpcReady || rpcConnecting || Date.now() < rpcRetry) return;
  let Client; try { ({ Client } = require("@xhayper/discord-rpc")); } catch (e) { return; }
  rpcConnecting = true;
  rpc = new Client({ clientId: DISCORD_APP_ID, transport: { type: "ipc" } });
  rpc.on("ready", () => { rpcReady = true; rpcConnecting = false; rpcKey = ""; updateRpc(); });
  rpc.on("disconnected", () => { rpcReady = false; rpcRetry = Date.now() + 60000; });
  rpc.login().catch(() => { rpcConnecting = false; rpcReady = false; rpcRetry = Date.now() + 60000; });
}
function rpcActivity(s) {
  if (!rpcSettings.on || !s || !s.active) return null;
  const pos = `Set ${s.idx + 1} of ${s.count}${rpcSettings.name && s.routine ? " · " + s.routine : ""}`;
  const a = { largeImageKey: "https://repline.pages.dev/icons/icon-512.png", largeImageText: "Repline · Daily Pro Routine", buttons: [{ label: "Get Repline", url: "https://repline.pages.dev" }], instance: false };
  if (s.status === "wechsel") return Object.assign(a, { details: `Getting ready · next: ${s.name}`, state: pos, endTimestamp: s.switchEnd ? new Date(s.switchEnd) : undefined });
  if (s.status === "pause") return Object.assign(a, { details: `Paused · ${s.name}`, state: pos });
  if (s.status === "fertig") return Object.assign(a, { details: s.next ? "Set done" : "Routine done", state: pos });
  if (s.status === "laeuft") {
    const now = Date.now(), e = s.elapsed + (now - s.at);
    if (s.kind === "timer" && s.total) return Object.assign(a, { details: s.name, state: pos, endTimestamp: new Date(now + Math.max(0, s.total - e)) });
    return Object.assign(a, { details: s.name, state: pos, startTimestamp: new Date(now - e) });
  }
  return Object.assign(a, { details: s.name, state: `Ready · ${pos}` });
}
function updateRpc() {
  const act = rpcActivity(lastState);
  if (!act && !rpcReady) return;
  if (act) rpcConnect();
  if (!rpcReady) return;
  const key = act ? [act.details, act.state, lastState.status, lastState.idx, lastState.switchEnd || "", Math.round((lastState.elapsed || 0) / 30000)].join("|") : "none";
  if (key === rpcKey) return;
  const wait = 15000 - (Date.now() - rpcSentAt);   // Discord allows about 5 updates per 20 seconds
  clearTimeout(rpcTimer);
  if (wait > 0) { rpcTimer = setTimeout(updateRpc, wait); return; }
  rpcKey = key; rpcSentAt = Date.now();
  const p = act ? rpc.user && rpc.user.setActivity(act) : rpc.user && rpc.user.clearActivity();
  if (p && p.catch) p.catch(() => {});
}
ipcMain.on("rpc:set", (_e, v) => { rpcSettings = { on: !(v && v.on === false), name: !(v && v.name === false) }; rpcKey = ""; updateRpc(); });

/* ---------- Training reminder as a Windows notification (while Repline is open) ---------- */
let remCfg = null, remFile = null, remSent = { day: "", danger: "" };
function remLoad() { remFile = path.join(app.getPath("userData"), "reminder.json"); try { remSent = Object.assign(remSent, JSON.parse(fs.readFileSync(remFile, "utf8"))); } catch (e) {} }
function remSave() { try { fs.writeFileSync(remFile, JSON.stringify(remSent)); } catch (e) {} }
function notify(title, body) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: path.join(__dirname, "app", "icons", "icon-window-256.png"), silent: false });
  n.on("click", () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  n.show();
}
function remTick() {
  const r = remCfg; if (!r || !r.on || r.win === false) return;
  const d = new Date(), p2 = (n) => String(n).padStart(2, "0");
  const day = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`, dow = ((d.getDay() + 6) % 7) + 1, mins = d.getHours() * 60 + d.getMinutes();
  const [hh, mm] = String(r.time || "18:00").split(":").map(Number), at = hh * 60 + (mm || 0);
  if ((r.days || []).indexOf(dow) >= 0 && mins >= at && mins < at + 180 && remSent.day !== day) {
    remSent.day = day; remSave();
    if (!(r.skip && r.trained)) notify("Time for your routine", r.streak > 0 ? `Day ${r.streak + 1} is waiting.${r.usual ? " Your usual: " + r.usual + "." : ""}` : `Day 1 starts with one routine.${r.usual ? " Your usual: " + r.usual + "." : ""}`);
  }
  if (r.danger && mins >= 21 * 60 && mins < 23 * 60 + 30 && remSent.danger !== day) {
    remSent.danger = day; remSave();
    if (!r.trained && r.streak > 0 && !(r.freezes > 0)) notify("Your streak is in danger", `Your ${r.streak}-day streak ends at midnight. One routine keeps it alive.`);
  }
}
ipcMain.on("reminder:set", (_e, v) => { remCfg = v && typeof v === "object" ? v : null; remTick(); });

/* ---------- App ---------- */
app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  loadSettings();
  app.setAppUserModelId("gg.repline.app");
  remLoad(); setInterval(remTick, 30000);
  try { setupUpdates(); } catch (e) { ulog("update setup failed", e); }
  createMain();
  try { if (overlaySettings.enabled) createOverlay(); } catch (e) { ulog("overlay failed", e); }
  try { registerHotkeys(); } catch (e) {}
  screen.on("display-metrics-changed", applyOverlayLook);
});
app.on("will-quit", () => { globalShortcut.unregisterAll(); try { if (rpc && rpcReady) rpc.destroy(); } catch (e) {} });
app.on("window-all-closed", () => app.quit());
