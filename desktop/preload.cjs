const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tdcpDesktop", {
  printHtml: (html) => ipcRenderer.invoke("print-html", html),
  tdcpOnly: true,
  organization: "TDCP",
  version: "1.0.4",
});
