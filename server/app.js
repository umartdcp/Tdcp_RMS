import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  try {
    const { startTdcpServer } = await import("./src/index.js");
    await startTdcpServer();
    fs.writeFileSync(path.join(__dirname, "startup-error.log"), "started\n");
  } catch (err) {
    const text = err && err.stack ? err.stack : String(err);
    try {
      fs.writeFileSync(path.join(__dirname, "startup-error.log"), text);
    } catch {
      /* ignore */
    }
    console.error(text);
    process.exit(1);
  }
}

main();
