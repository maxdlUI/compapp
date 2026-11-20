// Repline for Windows: the main app window plus an optional in-game overlay.
const { app, BrowserWindow, shell, Menu, ipcMain, screen, globalShortcut, Notification, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");

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
/* Breathing guide in the overlay (Ctrl+Shift+B): box breathing, 4 rounds, works between games without a routine running */
let breathUntil = 0, breathT = null;
function toggleBreath() {
  if (!overlay) createOverlay();
  const on = Date.now() >= breathUntil;
  breathUntil = on ? Date.now() + 64000 : 0;
  clearTimeout(breathT);
  if (on) breathT = setTimeout(() => { breathUntil = 0; if (overlay) overlay.webContents.send("overlay:breath", { on: false }); updateOverlayVisibility(); }, 64500);
  overlay.webContents.send("overlay:breath", { on, at: Date.now(), seconds: 64 });
  updateOverlayVisibility();
}
/* Focus Tunnel + Look Around edge light: a full-screen, click-through window over the game. It only draws, it reads nothing. */
let tunnel = null, tunnelCfg = { on: false }, edgeUntil = 0, edgeT = null;
function tunnelJS(code) {
  if (!tunnel) return;
  const run = () => tunnel && tunnel.webContents.executeJavaScript(code).catch(() => {});
  if (tunnel.webContents.isLoading()) tunnel.webContents.once("did-finish-load", run); else run();
}
function createTunnel() {
  if (tunnel) return;
  const b = screen.getPrimaryDisplay().bounds;
  tunnel = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height, frame: false, transparent: true, backgroundColor: "#00000000",
    resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false, skipTaskbar: true,
    focusable: false, hasShadow: false, alwaysOnTop: true, show: false, title: "Repline focus tunnel", enableLargerThanScreen: true, thickFrame: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false }
  });
  tunnel.setAlwaysOnTop(true, "screen-saver");
  tunnel.setVisibleOnAllWorkspaces(true);
  tunnel.setIgnoreMouseEvents(true);
  tunnel.loadFile(path.join(__dirname, "tunnel.html"));
  tunnel.on("closed", () => { tunnel = null; });
}
/* Pump Mode: the tunnel only shows while the pump slot is out. Repline listens for the pump key and the "off" keys
   the way push-to-talk does (uiohook, never blocks a key, nothing is stored or sent). The hook only runs while Pump Mode is on. */
let hook = null, pumpCfg = { on: false, pump: "", edit: "", keep: [], hold: 8 }, pumpActive = false, pumpT = null, capture = null;
let KEYNAME = null;
function keyName(id) {
  if (id.startsWith("m")) return "Mouse " + id.slice(1);
  if (!KEYNAME) { try { const { UiohookKey } = require("uiohook-napi"); KEYNAME = {}; for (const [n, c] of Object.entries(UiohookKey)) if (KEYNAME[c] == null) KEYNAME[c] = n; } catch (e) { KEYNAME = {}; } }
  return KEYNAME[+id.slice(1)] || "Key " + id.slice(1);
}
function hookStart() {
  if (hook) return true;
  try {
    const { uIOhook } = require("uiohook-napi");
    uIOhook.on("keydown", (e) => onInput("k" + e.keycode));
    uIOhook.on("mousedown", (e) => { if (+e.button >= 3) onInput("m" + e.button); });
    uIOhook.start(); hook = uIOhook; return true;
  } catch (e) { ulog("key hook failed", e); hook = null; return false; }
}
function hookStop() { if (!hook) return; try { hook.removeAllListeners(); hook.stop(); } catch (e) {} hook = null; }
const needHook = () => !!capture || (pumpCfg.on && !!pumpCfg.pump && !!pumpCfg.edit && tunnelCfg.pump && tunnelCfg.on);
function hookSync() { if (needHook()) hookStart(); else hookStop(); }
function onInput(id) {
  if (capture) { const cb = capture; capture = null; cb(id); hookSync(); return; }
  if (!pumpCfg.on) return;
  // pump key: tunnel on. Edit key and movement keys: keep it. Every other key or side mouse button: pump is away.
  if (id === pumpCfg.pump) setPump(true);
  else if (id === pumpCfg.edit || pumpCfg.keep.includes(id)) return;
  else if (pumpActive) setPump(false);
}
function setPump(on) {
  clearTimeout(pumpT);
  pumpActive = on;
  if (on) createTunnel();
  applyTunnel();
}
ipcMain.on("pump:set", (_e, c) => {
  c = c && typeof c === "object" ? c : {};
  const ok = (x) => typeof x === "string" && /^[km]\d{1,6}$/.test(x);
  pumpCfg = { on: !!c.on, pump: ok(c.pump) ? c.pump : "", edit: ok(c.edit) ? c.edit : "", keep: Array.isArray(c.keep) ? c.keep.filter(ok).slice(0, 30) : [], hold: Math.max(0, Math.min(30, +c.hold || 0)) };
  if (!pumpCfg.on) { pumpActive = false; clearTimeout(pumpT); }
  hookSync(); applyTunnel();
});
ipcMain.handle("pump:capture", () => new Promise((resolve) => {
  if (capture) { resolve(null); return; }
  const t = setTimeout(() => { if (capture) { capture = null; hookSync(); } resolve(null); }, 10000);
  capture = (id) => { clearTimeout(t); resolve({ id, name: keyName(id) }); };
  if (!hookStart()) { capture = null; clearTimeout(t); resolve({ error: "hook" }); }
}));
// Movement keys that keep the tunnel on (walking, jumping, sprinting, crouching with the pump out)
ipcMain.handle("pump:defaults", () => { try { const { UiohookKey } = require("uiohook-napi"); return ["W", "A", "S", "D", "Space", "Shift", "Ctrl"].map((k) => ({ id: "k" + UiohookKey[k], name: k })); } catch (e) { return []; } });
function applyTunnel() {
  if (!tunnel) return;
  const eff = { ...tunnelCfg, on: tunnelCfg.on && (!tunnelCfg.pump || pumpActive) };
  tunnelJS(`window.apply(${JSON.stringify(eff)})`);
  const show = eff.on || Date.now() < edgeUntil || (tunnelCfg.on && tunnelCfg.pump);
  if (show && !tunnel.isVisible()) {
    // cover the whole screen, taskbar area included (Windows may shrink a new window to the work area)
    tunnel.setBounds(screen.getPrimaryDisplay().bounds);
    tunnel.showInactive();
    tunnel.setBounds(screen.getPrimaryDisplay().bounds);
    if (overlay && overlay.isVisible()) overlay.moveTop();
  }
  if (!show && tunnel.isVisible()) tunnel.hide();
}
ipcMain.on("tunnel:set", (_e, c) => {
  c = c && typeof c === "object" ? c : {};
  const n = (v, lo, hi, d) => { v = +v; return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
  tunnelCfg = { on: !!c.on, size: n(c.size, 3, 70, 34), dark: n(c.dark, 10, 90, 55), soft: n(c.soft, 0, 100, 60), shape: c.shape === "square" ? "square" : "circle", pump: !!c.pump };
  if (tunnelCfg.on) createTunnel();
  hookSync(); applyTunnel();
});
function edgeFlash(dir) {
  if (!["l", "r", "u", "b"].includes(dir)) return;
  createTunnel();
  edgeUntil = Date.now() + 1800;
  applyTunnel();
  tunnelJS(`window.flash(${JSON.stringify(dir)})`);
  clearTimeout(edgeT); edgeT = setTimeout(() => { edgeUntil = 0; applyTunnel(); }, 1900);
}
/* Focus Cue: the page decides when to call out; the overlay shows the cue word and speaks it */
let cueUntil = 0, cueT = null;
ipcMain.on("cue:show", (_e, c) => {
  if (!c || typeof c !== "object") return;
  if (c.kind === "look" && c.edge) edgeFlash(String(c.dir || ""));
  if (!overlay) createOverlay();
  const ms = Math.max(1200, Math.min(6000, +c.ms || 3500)), show = c.show !== false;
  if (show) { cueUntil = Date.now() + ms; clearTimeout(cueT); cueT = setTimeout(() => { cueUntil = 0; updateOverlayVisibility(); }, ms + 200); }
  overlay.webContents.send("overlay:cue", {
    kind: c.kind === "ack" ? "ack" : c.kind === "lock" ? "lock" : c.kind === "look" ? "look" : "cue",
    word: String(c.word || "").slice(0, 24), plan: String(c.plan || "").slice(0, 140), note: String(c.note || "").slice(0, 60),
    ok: !!c.ok, voice: !!c.voice, tone: !!c.tone, say: String(c.say || "").slice(0, 200), ms, show
  });
  updateOverlayVisibility();
});
function updateOverlayVisibility() {
  if (!overlay) return;
  const show = (overlaySettings.enabled && (lastState.active || moving)) || Date.now() < previewUntil || Date.now() < breathUntil || Date.now() < cueUntil;
  if (show && !overlay.isVisible()) { overlay.showInactive(); overlay.moveTop(); }
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
const HOTKEYS = { "CommandOrControl+Shift+B": "breath", "CommandOrControl+Shift+Space": "toggle", "CommandOrControl+Shift+N": "next", "CommandOrControl+Shift+R": "restart", "CommandOrControl+Shift+O": "overlay", "CommandOrControl+Shift+E": "end", "CommandOrControl+Shift+1": "cueYes", "CommandOrControl+Shift+2": "cueNo" };
function registerHotkeys() {
  globalShortcut.unregisterAll();
  if (!overlaySettings.hotkeys) return;
  for (const [accel, name] of Object.entries(HOTKEYS)) {
    try {
      globalShortcut.register(accel, () => {
        if (name === "breath") { toggleBreath(); return; }
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


/* ---------- Game detection (anti-cheat safe) ----------
   Only reads the Windows process list (the same list Task Manager and Discord show), every 10 seconds while a
   routine runs. Never opens the game, its memory, files or network. */
const GAMES = { fortnite: /^"fortniteclient-win64-shipping/m, kovaaks: /^"fpsaimtrainer/m };
let gameOn = false, gameTimer = 0, gameState = { fortnite: false, kovaaks: false, at: 0, ok: process.platform === "win32" };
function pollGames() {
  if (process.platform !== "win32") return;
  execFile("tasklist", ["/FO", "CSV", "/NH"], { windowsHide: true, timeout: 8000, maxBuffer: 8 * 1024 * 1024 }, (err, out) => {
    if (err) { gameState = { ...gameState, at: Date.now(), ok: false }; }
    else {
      const t = String(out).toLowerCase();
      gameState = { fortnite: GAMES.fortnite.test(t), kovaaks: GAMES.kovaaks.test(t), at: Date.now(), ok: true };
    }
    if (win) win.webContents.send("game:state", gameState);
  });
}
ipcMain.handle("game:watch", (_e, on) => {
  gameOn = !!on;
  clearInterval(gameTimer);
  if (gameOn) { pollGames(); gameTimer = setInterval(pollGames, 10000); }
  return gameState;
});
ipcMain.handle("game:get", () => gameState);

/* ---------- KovaaK's results ----------
   KovaaK's saves one small CSV per played scenario in its "stats" folder. We only read those files (never the game),
   and only when the player has KovaaK's tracking on in Repline. Parsed results are cached in kovaaks.json. */
let kvFile = null, kv = { folder: "", files: {} };
function kvLoad() { kvFile = path.join(app.getPath("userData"), "kovaaks.json"); try { kv = Object.assign({ folder: "", files: {} }, JSON.parse(fs.readFileSync(kvFile, "utf8"))); } catch (e) {} }
function kvSave() { try { fs.writeFileSync(kvFile, JSON.stringify(kv)); } catch (e) {} }
function steamLibraries() {
  const roots = new Set();
  const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", pf = process.env.ProgramFiles || "C:\\Program Files";
  [path.join(pf86, "Steam"), path.join(pf, "Steam")].forEach((r) => roots.add(r));
  for (const r of Array.from(roots)) {
    try {
      const vdf = fs.readFileSync(path.join(r, "steamapps", "libraryfolders.vdf"), "utf8");
      for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) roots.add(m[1].replace(/\\\\/g, "\\"));
    } catch (e) {}
  }
  for (const d of "CDEFGH") { roots.add(`${d}:\\SteamLibrary`); roots.add(`${d}:\\Steam`); }
  return Array.from(roots);
}
function kvFind() {
  if (kv.folder && fs.existsSync(kv.folder)) return kv.folder;
  for (const r of steamLibraries()) {
    const p = path.join(r, "steamapps", "common", "FPSAimTrainer", "FPSAimTrainer", "stats");
    try { if (fs.statSync(p).isDirectory()) return p; } catch (e) {}
  }
  return "";
}
const KV_DATE = /(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})\s*Stats\.csv$/i;
// One file → { s: scenario, t: ISO time, sc: score, acc: accuracy %, sens: "30 cm/360" } or null
function kvParse(name, text) {
  const m = KV_DATE.exec(name); if (!m) return null;
  let s = name.slice(0, m.index).replace(/\s*-\s*$/, "").replace(/\s+-\s+(Challenge|Challenge Start|Free Play|Freeplay|Practice)$/i, "").trim();
  const t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  if (isNaN(t)) return null;
  const lines = String(text).split(/\r?\n/), kvv = {};
  let shots = 0, hits = 0, inW = false;
  for (const ln of lines) {
    const c = ln.split(",");
    if (/^Weapon,Shots,Hits/i.test(ln)) { inW = true; continue; }
    if (inW) { if (!ln.trim() || /:$/.test(c[0])) inW = false; else { shots += +c[1] || 0; hits += +c[2] || 0; continue; } }
    if (c.length >= 2 && /:$/.test(c[0])) kvv[c[0].slice(0, -1).trim().toLowerCase()] = c.slice(1).join(",").trim();
  }
  const sc = parseFloat(kvv.score);
  if (!isFinite(sc)) return null;
  if (kvv.scenario) s = kvv.scenario;
  if (!s) return null;
  const hs = parseFloat(kvv["horiz sens"]);
  const sens = isFinite(hs) ? `${+hs.toFixed(3)}${kvv["sens scale"] ? " " + kvv["sens scale"] : ""}`.slice(0, 40) : "";
  return { s: s.slice(0, 120), t: t.toISOString(), sc: Math.round(sc * 100) / 100, acc: shots > 0 ? Math.round(hits / shots * 1000) / 10 : null, sens };
}
function kvScan() {
  const folder = kvFind();
  if (!folder) return { found: false, folder: "", rows: [] };
  let names = [];
  try { names = fs.readdirSync(folder).filter((n) => /\.csv$/i.test(n)); } catch (e) { return { found: false, folder, rows: [] }; }
  if (kv.folder !== folder) { kv = { folder, files: {} }; }
  let changed = false;
  for (const n of names.slice(-30000)) {
    if (n in kv.files) continue;
    let rec = null;
    try { const st = fs.statSync(path.join(folder, n)); if (st.size < 2000000) rec = kvParse(n, fs.readFileSync(path.join(folder, n), "utf8")); } catch (e) {}
    kv.files[n] = rec; changed = true;
  }
  if (changed) kvSave();
  const rows = Object.values(kv.files).filter(Boolean).sort((a, b) => (a.t < b.t ? -1 : 1));
  return { found: true, folder, rows };
}
ipcMain.handle("kovaaks:scan", () => { try { return kvScan(); } catch (e) { ulog("kovaaks scan failed", e); return { found: false, folder: "", rows: [] }; } });
ipcMain.handle("kovaaks:pick", async () => {
  const r = await dialog.showOpenDialog(win, { title: "Choose KovaaK's stats folder", properties: ["openDirectory"], message: "Pick the folder FPSAimTrainer\\stats inside your KovaaK's install." });
  if (r.canceled || !r.filePaths[0]) return null;
  let p = r.filePaths[0];
  const inner = path.join(p, "FPSAimTrainer", "stats"), inner2 = path.join(p, "stats");
  if (fs.existsSync(inner)) p = inner; else if (fs.existsSync(inner2)) p = inner2;
  kv = { folder: p, files: {} }; kvSave();
  return kvScan();
});
ipcMain.handle("kovaaks:forget", () => { kv = { folder: "", files: {} }; try { fs.unlinkSync(kvFile); } catch (e) {} return true; });

/* ---------- App ---------- */
app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  loadSettings();
  app.setAppUserModelId("gg.repline.app");
  remLoad(); setInterval(remTick, 30000);
  kvLoad();
  try { setupUpdates(); } catch (e) { ulog("update setup failed", e); }
  createMain();
  try { if (overlaySettings.enabled) createOverlay(); } catch (e) { ulog("overlay failed", e); }
  try { registerHotkeys(); } catch (e) {}
  screen.on("display-metrics-changed", applyOverlayLook);
});
app.on("will-quit", () => { hookStop(); clearInterval(gameTimer); globalShortcut.unregisterAll(); try { if (rpc && rpcReady) rpc.destroy(); } catch (e) {} });
app.on("window-all-closed", () => app.quit());
