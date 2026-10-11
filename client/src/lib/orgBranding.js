export function isTdcpOrg(org) {
  return String(org?.code || "").toUpperCase() === "TDCP";
}

function looksLikeTdcpLogo(url) {
  return /tdcp-logo/i.test(String(url || ""));
}

/** Only TDCP uses /tdcp-logo.png. Other orgs use their own logo_url or none. */
export function organizationLogoUrl(org) {
  const url = String(org?.logo_url || org?.favicon_url || "").trim();
  if (!url) return "";
  if (looksLikeTdcpLogo(url) && !isTdcpOrg(org)) return "";
  return url;
}

export function organizationDisplayName(org) {
  return org?.name || org?.app_name || "Restaurant";
}
