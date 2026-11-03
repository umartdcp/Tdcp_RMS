import { app, BrowserWindow, Menu, dialog, ipcMain } from "electron";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_VERSION = "1.0.8";

let mainWindow = null;
let staticServer = null;

function appRoot() {
  if (app.isPackaged) return path.join(process.resourcesPath, "app");
  return path.join(__dirname, "..");
}

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".svg")) return "image/svg+xml";
  if (file.endsWith(".json")) return "application/json";
  if (file.endsWith(".webp")) return "image/webp";
  if (file.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

function resolveInside(root, urlPath) {
  const clean = decodeURIComponent(String(urlPath || "/").split("?")[0]).replace(/^[/\\]+/, "");
  const full = path.resolve(root, clean);
  const base = path.resolve(root);
  if (full !== base && !full.startsWith(base + path.sep)) return null;
  return full;
}

function startStaticServer(dist, port) {
  const server = http.createServer((req, res) => {
    const requested = resolveInside(dist, req.url || "/");
    const file = requested && fs.existsSync(requested) && fs.statSync(requested).isFile()
      ? requested
      : path.join(dist, "index.html");
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": contentType(file),
        "Cache-Control": file.endsWith(".html") ? "no-store" : "public, max-age=31536000",
      });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

ipcMain.handle("print-html", async (_event, html) => {
  const file = path.join(app.getPath("temp"), `tdcp-receipt-${Date.now()}.html`);
  fs.writeFileSync(file, String(html || ""), "utf8");

  const printWin = new BrowserWindow({
    width: 420,
    height: 720,
    show: true,
    autoHideMenuBar: true,
    title: "Print receipt",
    parent: mainWindow || undefined,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
    },
  });

  try {
    await printWin.loadFile(file);
    await printWin.webContents.executeJavaScript(
      `Promise.all([...document.images].map((img) => (img.decode ? img.decode() : Promise.resolve()).catch(() => null)))`
    );
    await new Promise((resolve) => {
      printWin.webContents.print(
        {
          silent: false,
          printBackground: true,
          color: true,
          margins: { marginType: "none" },
        },
        () => resolve()
      );
    });
  } finally {
    if (!printWin.isDestroyed()) printWin.close();
    fs.unlink(file, () => {});
  }
});

async function createWindow() {
  const root = appRoot();
  const clientDist = path.join(root, "client", "dist");
  const iconPng = path.join(root, "client", "public", "tdcp-logo.png");

  if (!fs.existsSync(path.join(clientDist, "index.html"))) {
    dialog.showErrorBox("TDCP RMS", "App files are missing (client/dist). Rebuild with npm run dist:win.");
    app.quit();
    return;
  }

  staticServer = await startStaticServer(clientDist, 17500);
  const url = "http://127.0.0.1:17500/login/tdcp";

  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    title: `TDCP RMS ${APP_VERSION}`,
    icon: fs.existsSync(iconPng) ? iconPng : undefined,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.on("page-title-updated", (event) => {
    event.preventDefault();
    mainWindow.setTitle(`TDCP RMS ${APP_VERSION}`);
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  await mainWindow.loadURL(url);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow).catch((err) => {
    dialog.showErrorBox("TDCP RMS failed to start", err.stack || err.message || String(err));
    app.quit();
  });

  app.on("window-all-closed", () => {
    if (staticServer) staticServer.close();
    app.quit();
  });
}
