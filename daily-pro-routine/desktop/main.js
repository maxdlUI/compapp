// Repline for Windows: the main app window plus an optional in-game overlay.
const { app, BrowserWindow, shell, Menu, ipcMain, screen, globalShortcut } = require("electron");
const path = require("path");
const fs = require("fs");

if (!app.requestSingleInstanceLock()) app.quit();

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
  overlay.webContents.on("did-finish-load", () => { applyOverlayLook(); sendOverlay(); updateOverlayVisibility(); });
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
const HOTKEYS = { "CommandOrControl+Shift+Space": "toggle", "CommandOrControl+Shift+N": "next", "CommandOrControl+Shift+R": "restart", "CommandOrControl+Shift+O": "overlay" };
function registerHotkeys() {
  globalShortcut.unregisterAll();
  if (!overlaySettings.hotkeys) return;
  for (const [accel, name] of Object.entries(HOTKEYS)) {
    try {
      globalShortcut.register(accel, () => {
        if (name === "overlay") { overlaySettings.enabled = !overlaySettings.enabled; saveSettings(); updateOverlayVisibility(); if (win) win.webContents.send("overlay:settings", overlaySettings); return; }
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
ipcMain.on("overlay:state", (_e, state) => {
  lastState = state && typeof state === "object" ? state : { active: false };
  sendOverlay();
  updateOverlayVisibility();
});

/* ---------- App ---------- */
app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  loadSettings();
  createMain();
  if (overlaySettings.enabled) createOverlay();
  registerHotkeys();
  screen.on("display-metrics-changed", applyOverlayLook);
});
app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => app.quit());
