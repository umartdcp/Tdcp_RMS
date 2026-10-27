import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(root, "client");
const distDir = path.join(clientDir, "dist");
const publicDir = path.join(root, "server", "public");
const schemaSrc = path.join(root, "database_reset.sql");
const schemaDest = path.join(root, "server", "schema.sql");

function run(cmd, args, cwd, env) {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: true, env: { ...process.env, ...env } });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log("Installing client dependencies…");
run("npm", ["install"], clientDir);
console.log("Building frontend…");
run("npm", ["run", "build"], clientDir);
if (!existsSync(path.join(distDir, "index.html"))) {
  console.error("client/dist/index.html was not created");
  process.exit(1);
}

rmSync(publicDir, { recursive: true, force: true });
mkdirSync(publicDir, { recursive: true });
cpSync(distDir, publicDir, { recursive: true });
cpSync(schemaSrc, schemaDest);
mkdirSync(path.join(root, "server", "uploads"), { recursive: true });

const releaseDir = path.join(root, "release");
const stage = path.join(releaseDir, "cpanel-stage");
const stagedServer = path.join(stage, "server");
rmSync(stage, { recursive: true, force: true });
mkdirSync(stagedServer, { recursive: true });
for (const name of ["app.js", "package.json", "package-lock.json", ".env.example", "schema.sql"]) {
  const from = path.join(root, "server", name);
  if (existsSync(from)) cpSync(from, path.join(stagedServer, name));
}
cpSync(path.join(root, "server", "src"), path.join(stagedServer, "src"), { recursive: true });
cpSync(publicDir, path.join(stagedServer, "public"), { recursive: true });
mkdirSync(path.join(stagedServer, "uploads"), { recursive: true });

const zipPath = path.join(releaseDir, "tdcp-rms-cpanel.zip");
rmSync(zipPath, { force: true });
const zip = spawnSync(
  "powershell",
  [
    "-NoProfile",
    "-Command",
    `Compress-Archive -LiteralPath '${stagedServer}' -DestinationPath '${zipPath}' -Force`,
  ],
  { stdio: "inherit" }
);
if (zip.status !== 0) process.exit(zip.status || 1);
rmSync(stage, { recursive: true, force: true });

console.log("");
console.log("cPanel package is ready.");
console.log(zipPath);
console.log("Upload and extract it. Application root = server, startup file = app.js, then NPM Install.");
console.log("Set DATABASE_URL, JWT_SECRET, and NODE_ENV=production. Do not upload server/.env or node_modules.");
