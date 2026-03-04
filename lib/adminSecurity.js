export function isLocalHost(req) {
  const host = String(req.headers.host || "").split(":")[0].toLowerCase();
  const xfHost = String(req.headers["x-forwarded-host"] || "").split(":")[0].toLowerCase();
  const allowed = new Set(["localhost", "127.0.0.1", "::1"]);
  return allowed.has(host) || allowed.has(xfHost);
}

export function requireAdminAccess(req, res) {
  if (!isLocalHost(req)) {
    res.status(404).json({ message: "Not found" });
    return false;
  }

  const configuredToken = String(process.env.ADMIN_API_TOKEN || "").trim();
  if (!configuredToken) return true;

  const headerToken = String(req.headers["x-admin-token"] || "").trim();
  if (!headerToken || headerToken !== configuredToken) {
    res.status(401).json({ message: "Token admin invalido" });
    return false;
  }

  return true;
}

