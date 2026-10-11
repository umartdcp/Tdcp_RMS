import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeDb, connectDb } from "../src/db.js";
import { initDb, isSafeDevDatabase, rebuildSchema } from "../src/initDb.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: process.env.TDCP_ENV_PATH || path.join(__dirname, "../.env") });

await connectDb();
if (!isSafeDevDatabase()) {
  console.error("Refusing reset: not the local development database tdcp_rms.");
  process.exit(1);
}
process.env.FORCE_DB_RESET = "1";
await rebuildSchema();
await initDb();
console.log("Development database reset complete.");
await closeDb();
