const KEY = "tdcp_offline_login";

async function digest(text) {
  const bytes = new TextEncoder().encode(String(text || ""));
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

export async function saveOfflineLogin(email, password, session) {
  if (!session?.token || !session?.user?.email) return;
  try {
    const record = {
      email: String(email || "").trim().toLowerCase(),
      hash: await digest(password),
      session: {
        token: session.token,
        user: session.user,
        organization: session.organization ?? null,
        site: session.site ?? null,
        permissions: session.permissions || [],
      },
    };
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    /* this device can still work online */
  }
}

export async function readOfflineLogin(email, password) {
  try {
    const record = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!record?.session?.token || !record.email) return null;
    if (record.email !== String(email || "").trim().toLowerCase()) return null;
    if (record.hash !== (await digest(password))) return null;
    return { ...record.session, offline: true };
  } catch {
    return null;
  }
}
