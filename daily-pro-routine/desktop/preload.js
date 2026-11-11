// Gives the Repline page a small, safe bridge to the Windows app: overlay settings, overlay state and hotkeys.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("replineDesktop", {
  overlay: {
    get: () => ipcRenderer.invoke("overlay:get"),
    set: (patch) => ipcRenderer.invoke("overlay:set", patch),
    move: (on) => ipcRenderer.invoke("overlay:move", !!on),
    preview: (p) => ipcRenderer.invoke("overlay:preview", p),
    push: (state) => ipcRenderer.send("overlay:state", state),
    onSettings: (cb) => ipcRenderer.on("overlay:settings", (_e, s) => cb(s))
  },
  onHotkey: (cb) => ipcRenderer.on("hotkey", (_e, name) => cb(name))
});
