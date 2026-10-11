export function organizationLogoUrl(org) {
  const url = String(org?.logo_url || "").trim();
  if (!url) return null;
  const isTdcp = String(org?.code || "").toUpperCase() === "TDCP";
  if (/tdcp-logo/i.test(url) && !isTdcp) return null;
  return url;
}

export function withSafeLogo(org) {
  if (!org) return org;
  return { ...org, logo_url: organizationLogoUrl(org) };
}
