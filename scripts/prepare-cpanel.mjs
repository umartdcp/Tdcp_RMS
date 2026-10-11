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

console.log("");
console.log("cPanel package is ready.");
console.log("Upload the `server` folder (with public/, schema.sql, src/, app.js, package.json).");
console.log("On cPanel: Application root = server, startup file = app.js, then npm install.");
console.log("Set DATABASE_URL, JWT_SECRET, NODE_ENV=production in the Node.js app environment.");
