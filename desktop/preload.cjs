const { contextBridge, ipcRenderer } = require("electron");
const pkg = require("../package.json");

contextBridge.exposeInMainWorld("tdcpDesktop", {
  printHtml: (html) => ipcRenderer.invoke("print-html", html),
  apiBase: "https://kitcheniq.cloud/api",
  tdcpOnly: true,
  version: pkg.version || "1.0.3",
});
