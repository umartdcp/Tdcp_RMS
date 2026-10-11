import { connectDb, query, closeDb } from "../src/db.js";

await connectDb();
const users = (await query("SELECT email, role, organization_id, site_id FROM users ORDER BY id")).rows;
console.log(users);
const sites = (
  await query(
    "SELECT o.code AS org, s.code AS site FROM sites s JOIN organizations o ON o.id=s.organization_id ORDER BY o.id, s.id"
  )
).rows;
console.log(sites);
const orgs = (await query("SELECT code, name, primary_color FROM organizations ORDER BY id")).rows;
console.log(orgs);
await closeDb();
