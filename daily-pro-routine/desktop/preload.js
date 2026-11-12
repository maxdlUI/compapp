// Gives the Repline page a small, safe bridge to the Windows app: overlay settings, overlay state and hotkeys.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("replineDesktop", {
  overlay: {
    get: () => ipcRenderer.invoke("overlay:get"),
    set: (patch) => ipcRenderer.invoke("overlay:set", patch),
    move: (on) => ipcRenderer.invoke("overlay:move", !!on),
    preview: (p) => ipcRenderer.invoke("overlay:preview", p),
    custom: (dataUrl) => ipcRenderer.send("overlay:custom", typeof dataUrl === "string" ? dataUrl : ""),
    push: (state) => ipcRenderer.send("overlay:state", state),
    onSettings: (cb) => ipcRenderer.on("overlay:settings", (_e, s) => cb(s))
  },
  onHotkey: (cb) => ipcRenderer.on("hotkey", (_e, name) => cb(name)),
  auth: (url) => ipcRenderer.invoke("auth:discord", url),
  updates: {
    get: () => ipcRenderer.invoke("update:get"),
    check: () => ipcRenderer.invoke("update:check"),
    install: () => ipcRenderer.invoke("update:install"),
    onState: (cb) => ipcRenderer.on("update:state", (_e, s) => cb(s))
  }
});
