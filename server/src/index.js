import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { closeDb, ensureDb } from "./db.js";
import { initDb } from "./initDb.js";
import authRoutes from "./routes/auth.js";
import dashboardRoutes from "./routes/dashboard.js";
import organizationRoutes from "./routes/organizations.js";
import userRoutes from "./modules/users.js";
import auditLogRoutes from "./modules/auditLogs.js";
import apiRoutes from "./routes/api.js";
import { startHqSyncLoop, syncRouter } from "./hqSync.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function envPath() {
  return process.env.TDCP_ENV_PATH || path.join(__dirname, "../.env");
}

function clientDistPath() {
  if (process.env.TDCP_CLIENT_DIST) return process.env.TDCP_CLIENT_DIST;
  const bundled = path.join(__dirname, "../public");
  if (fs.existsSync(path.join(bundled, "index.html"))) return bundled;
  return path.join(__dirname, "../../client/dist");
}

function uploadsPath() {
  return process.env.TDCP_UPLOADS_DIR || path.join(__dirname, "../uploads");
}

function listenPort(preferred) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => {
      const fallback = net.createServer();
      fallback.once("error", reject);
      fallback.listen(0, "127.0.0.1", () => {
        const { port } = fallback.address();
        fallback.close(() => resolve(port));
      });
    });
    probe.listen(preferred, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

export async function startTdcpServer() {
  dotenv.config({ path: envPath() });
  const production = process.env.NODE_ENV === "production";
  if (production && (!process.env.JWT_SECRET || /dev-secret|change-this/i.test(process.env.JWT_SECRET))) {
    throw new Error("Set a strong JWT_SECRET in the cPanel Node.js environment (or server/.env) before going live.");
  }
  process.env.JWT_SECRET ||= "tdcp-rms-dev-secret-change-me";

  if (process.env.TDCP_DESKTOP === "1") {
    process.env.PORT = process.env.TDCP_PORT || "17500";
  }

  const uploadsDir = uploadsPath();
  fs.mkdirSync(uploadsDir, { recursive: true });

  const app = express();
  app.set("trust proxy", 1);
  const origin = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  app.use(origin.length ? cors({ origin, credentials: true }) : cors());
  app.use(express.json({ limit: "15mb" }));
  app.use("/uploads", express.static(uploadsDir));

  app.get("/api/health", async (_req, res) => {
    const db = await ensureDb();
    res.json({ ok: true, service: "RMS API", db: db ? "up" : "down" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api", organizationRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api", userRoutes);
  app.use("/api", auditLogRoutes);
  app.use("/api/sync", syncRouter);
  app.use("/api", apiRoutes);

  app.use((err, _req, res, _next) => {
    if (err?.code === "DB_OFFLINE") {
      return res.status(503).json({
        code: "DB_OFFLINE",
        message: "Database is offline. This change is saved on the device and will sync when MySQL is back.",
      });
    }
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  });

  const clientDist = clientDistPath();
  if (fs.existsSync(clientDist)) {
    app.use(
      express.static(clientDist, {
        index: false,
        setHeaders(res, filePath) {
          if (filePath.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-store, max-age=0");
            return;
          }
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        },
      })
    );
    app.get(/^(?!\/api(?:\/|$)|\/uploads(?:\/|$)).*/, (_req, res) => {
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  let schemaReady = false;
  async function connectAndPrepare() {
    const up = await ensureDb();
    if (!up) return false;
    if (!schemaReady) {
      await initDb();
      schemaReady = true;
    }
    return true;
  }

  const connected = await connectAndPrepare();
  if (!connected) {
    console.log("MySQL is offline. The app will keep running and sync when the database is back.");
  }
  setInterval(() => {
    connectAndPrepare().catch((err) => console.error(err.message));
  }, 8000);

  let port = Number(process.env.PORT || 5000);
  const host = process.env.TDCP_BIND || "0.0.0.0";
  if (process.env.TDCP_DESKTOP === "1") {
    port = await listenPort(port);
    process.env.PORT = String(port);
  }

  await new Promise((resolve, reject) => {
    const passenger = globalThis.PhusionPassenger;
    if (typeof passenger !== "undefined") {
      passenger.configure({ autoInstall: false });
      app.listen("passenger");
      console.log("TDCP RMS running under cPanel / Passenger");
      resolve();
      return;
    }
    const server = app.listen(port, host, () => {
      console.log(`TDCP RMS running on http://${host}:${port}`);
      resolve();
    });
    server.on("error", reject);
  });

  startHqSyncLoop();
  return { app, port, closeDb };
}

function isDirectCli() {
  const entry = process.argv[1] ? path.normalize(process.argv[1]) : "";
  return /[\\/](index\.js|app\.js)$/i.test(entry);
}

if (isDirectCli()) {
  startTdcpServer().catch((err) => {
    console.error("MySQL se connect nahi ho saka.");
    console.error(err.message);
    console.error("Set DATABASE_URL in server/.env (mysql://tdcp:tdcp123@127.0.0.1:3306/tdcp_rms) and start MySQL.");
    process.exit(1);
  });
}
