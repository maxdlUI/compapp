// Feeds routine progress and look settings into the overlay window.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlayBridge", {
  onState: (cb) => ipcRenderer.on("overlay:state", (_e, s) => cb(s)),
  onLook: (cb) => ipcRenderer.on("overlay:look", (_e, l) => cb(l))
});
