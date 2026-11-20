// Gives the Repline page a small, safe bridge to the Windows app: overlay settings, overlay state, hotkeys,
// game detection (process list only) and KovaaK's results (KovaaK's own stats files).
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
  cue: (c) => ipcRenderer.send("cue:show", JSON.parse(JSON.stringify(c || {}))),
  auth: (url) => ipcRenderer.invoke("auth:discord", url),
  rpc: { set: (v) => ipcRenderer.send("rpc:set", { on: !!(v && v.on), name: !!(v && v.name) }) },
  reminder: { set: (v) => ipcRenderer.send("reminder:set", JSON.parse(JSON.stringify(v || {}))) },
  game: {
    watch: (on) => ipcRenderer.invoke("game:watch", !!on),
    get: () => ipcRenderer.invoke("game:get"),
    onState: (cb) => ipcRenderer.on("game:state", (_e, s) => cb(s))
  },
  kovaaks: {
    scan: () => ipcRenderer.invoke("kovaaks:scan"),
    pick: () => ipcRenderer.invoke("kovaaks:pick"),
    forget: () => ipcRenderer.invoke("kovaaks:forget")
  },
  updates: {
    get: () => ipcRenderer.invoke("update:get"),
    check: () => ipcRenderer.invoke("update:check"),
    install: () => ipcRenderer.invoke("update:install"),
    onState: (cb) => ipcRenderer.on("update:state", (_e, s) => cb(s))
  }
});
