import { startTdcpServer } from "./src/index.js";

startTdcpServer().catch((err) => {
  console.error("MySQL se connect nahi ho saka.");
  console.error(err.message);
  console.error("Set DATABASE_URL in server/.env (mysql://kitchencloud_tdcp:Tdcp.rms%402027@127.0.0.1:3306/kitchencloud_tdcp_rms) and start MySQL.");
  process.exit(1);
});
