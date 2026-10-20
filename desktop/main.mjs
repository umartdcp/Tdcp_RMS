import { app, BrowserWindow, Menu, dialog, ipcMain, session } from "electron";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const APP_VERSION = "1.0.3";
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

let mainWindow = null;
let staticServer = null;

function appRoot() {
  return app.getAppPath();
}

function resolveInside(root, pathname) {
  const base = path.resolve(root);
  const rel = decodeURIComponent(pathname || "/").replace(/^[/\\]+/, "");
  const file = path.resolve(base, rel);
  if (file !== base && !file.startsWith(base + path.sep)) return null;
  return file;
}

function startStatic(root) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      let file = resolveInside(root, url.pathname);
      if (!file) {
        res.writeHead(403);
        res.end();
        return;
      }
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) {
        file = path.join(root, "index.html");
      }
      if (!fs.existsSync(file)) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(fs.readFileSync(file));
    });
    server.listen(17500, "127.0.0.1", () => resolve(server));
    server.on("error", reject);
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
  const iconPng = path.join(clientDist, "tdcp-logo.png");

  if (!fs.existsSync(path.join(clientDist, "index.html"))) {
    dialog.showErrorBox(
      "TDCP RMS",
      "App files are missing (client/dist). Rebuild with npm run dist:win."
    );
    app.quit();
    return;
  }

  staticServer = await startStatic(clientDist);
  const url = "http://127.0.0.1:17500/login/tdcp";

  await session.defaultSession.clearStorageData({ storages: ["serviceworkers", "cachestorage"] });
  await session.defaultSession.clearCache();

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
