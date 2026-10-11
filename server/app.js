import { startTdcpServer } from "./src/index.js";

startTdcpServer().catch((err) => {
  console.error("MySQL se connect nahi ho saka.");
  console.error(err.message);
  console.error("Set DATABASE_URL in server/.env (mysql://tdcp:tdcp123@127.0.0.1:3306/tdcp_rms) and start MySQL.");
  process.exit(1);
});
