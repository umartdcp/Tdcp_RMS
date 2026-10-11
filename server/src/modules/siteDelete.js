import { query, withTransaction } from "../db.js";
import { isOrgAdmin, isSuperAdmin } from "./roles.js";

export async function tdcpOrganizationId() {
  const row = (await query(`SELECT id FROM organizations WHERE upper(code)='TDCP'`)).rows[0];
  return row ? Number(row.id) : null;
}

export function canDeleteTdcpSite(user, site, tdcpId) {
  if (!site || !tdcpId || Number(site.organization_id) !== Number(tdcpId)) return false;
  if (isSuperAdmin(user)) return true;
  return isOrgAdmin(user) && Number(user.organization_id) === Number(tdcpId);
}

async function runOptional(run, text, params) {
  try {
    await run(text, params);
  } catch (err) {
    if (err?.errno === 1146 || err?.code === "ER_NO_SUCH_TABLE") return;
    throw err;
  }
}

export async function removeSite(siteId) {
  await withTransaction(async (run) => {
    await run(`UPDATE orders SET table_id=NULL, customer_id=NULL WHERE site_id=$1 OR restaurant_id=$1`, [siteId]);
    await run(`DELETE FROM order_items WHERE site_id=$1`, [siteId]);
    await run(`DELETE FROM payments WHERE site_id=$1`, [siteId]);
    await runOptional(run, `DELETE FROM kitchen_orders WHERE site_id=$1`, [siteId]);
    await run(`DELETE FROM orders WHERE site_id=$1 OR restaurant_id=$1`, [siteId]);
    await runOptional(run, `DELETE FROM purchases WHERE site_id=$1 OR restaurant_id=$1`, [siteId]);
    await run(`DELETE FROM sites WHERE id=$1`, [siteId]);
  });
}
