const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tdcpDesktop", {
  printHtml: (html) => ipcRenderer.invoke("print-html", html),
  tdcpOnly: true,
  organization: "TDCP",
  apiBase: "https://kitcheniq.cloud/api",
  version: "1.0.8",
});
