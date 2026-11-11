// Repline for Windows: a single window that runs the Repline app from disk.
const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");

if (!app.requestSingleInstanceLock()) app.quit();

let win = null;
function create() {
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
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false }
  });
  win.once("ready-to-show", () => win.show());
  win.loadFile(path.join(__dirname, "app", "index.html"));
  // Links to other websites open in the normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (/^https?:/.test(url)) { e.preventDefault(); shell.openExternal(url); } });
}

app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => { Menu.setApplicationMenu(null); create(); });
app.on("window-all-closed", () => app.quit());
