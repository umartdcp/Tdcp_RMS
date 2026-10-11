const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tdcpDesktop", {
  printHtml: (html) => ipcRenderer.invoke("print-html", html),
});
