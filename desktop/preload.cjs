const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tdcpDesktop", {
  printHtml: (html) => ipcRenderer.invoke("print-html", html),
  apiBase: "https://kitcheniq.cloud/api",
  tdcpOnly: true,
  organization: "TDCP",
  version: "1.0.3",
});
