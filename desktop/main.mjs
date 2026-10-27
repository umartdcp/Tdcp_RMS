import { app, BrowserWindow, Menu, dialog, ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_VERSION = "1.0.6";

let mainWindow = null;
let closeDb = async () => {};

function appRoot() {
  if (app.isPackaged) return path.join(process.resourcesPath, "app");
  return path.join(__dirname, "..");
}

function ensureEnvFile(root, userData) {
  const userEnv = path.join(userData, ".env");
  const bundled = path.join(root, "server", ".env");
  const example = path.join(root, "server", ".env.example");
  if (!fs.existsSync(userEnv)) {
    const source = fs.existsSync(bundled) ? bundled : example;
    if (source && fs.existsSync(source)) fs.copyFileSync(source, userEnv);
  }
  if (fs.existsSync(userEnv)) {
    const text = fs.readFileSync(userEnv, "utf8");
    if (/postgres(ql)?:\/\//i.test(text)) {
      fs.writeFileSync(
        userEnv,
        text.replace(/postgres(ql)?:\/\/\S+/i, "mysql://tdcp:tdcp123@127.0.0.1:3306/tdcp_rms")
      );
    }
  }
  return fs.existsSync(userEnv) ? userEnv : bundled;
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
  const userData = app.getPath("userData");
  const clientDist = path.join(root, "client", "dist");
  const iconPng = path.join(root, "client", "public", "tdcp-logo.png");

  process.env.TDCP_DESKTOP = "1";
  process.env.TDCP_DATA_DIR = userData;
  process.env.TDCP_CLIENT_DIST = clientDist;
  process.env.TDCP_UPLOADS_DIR = path.join(userData, "uploads");
  process.env.TDCP_ENV_PATH = ensureEnvFile(root, userData);
  process.env.TDCP_PORT = "17500";
  process.env.PORT = "17500";
  process.env.TDCP_BIND = "127.0.0.1";

  if (!fs.existsSync(path.join(clientDist, "index.html"))) {
    dialog.showErrorBox("TDCP RMS", "App files are missing (client/dist). Rebuild with npm run dist:win.");
    app.quit();
    return;
  }

  const serverEntry = path.join(root, "server", "src", "index.js");
  if (!fs.existsSync(serverEntry)) {
    dialog.showErrorBox("TDCP RMS", "The sign-in service is missing from this build. Rebuild with npm run dist:win.");
    app.quit();
    return;
  }

  const { startTdcpServer } = await import(pathToFileURL(serverEntry).href);
  const started = await startTdcpServer();
  closeDb = started.closeDb || closeDb;
  const url = `http://127.0.0.1:${started.port}/login/tdcp`;

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

  app.on("window-all-closed", async () => {
    try {
      await closeDb();
    } catch {
      /* ignore */
    }
    app.quit();
  });
}
