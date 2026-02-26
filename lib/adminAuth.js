import crypto from "crypto";

export const ADMIN_SESSION_COOKIE = "admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function parseCookieHeader(cookieHeader = "") {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const eqIndex = part.indexOf("=");
      if (eqIndex === -1) return acc;
      const key = part.slice(0, eqIndex).trim();
      const value = part.slice(eqIndex + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

function getAdminEnv() {
  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASS;
  const secret = process.env.ADMIN_SESSION_SECRET;
  const configured = Boolean(user && password && secret);
  return { user, password, secret, configured };
}

function signPayload(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function isAdminEnvConfigured() {
  return getAdminEnv().configured;
}

export function validateAdminCredentials(user, password) {
  const env = getAdminEnv();
  if (!env.configured) return false;
  return safeEqual(user, env.user) && safeEqual(password, env.password);
}

export function createAdminSessionToken(user) {
  const env = getAdminEnv();
  if (!env.configured) return null;

  const payload = JSON.stringify({
    user: String(user || ""),
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
  });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const signature = signPayload(payloadB64, env.secret);
  return `${payloadB64}.${signature}`;
}

export function verifyAdminSessionToken(token) {
  const env = getAdminEnv();
  if (!env.configured || !token || !String(token).includes(".")) return false;

  const [payloadB64, signature] = String(token).split(".");
  if (!payloadB64 || !signature) return false;

  const expected = signPayload(payloadB64, env.secret);
  if (!safeEqual(signature, expected)) return false;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (!payload?.exp || Number(payload.exp) < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

export function setAdminSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS};${secure}`
  );
}

export function clearAdminSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0;${secure}`
  );
}

export function isAdminRequest(req) {
  const cookies = parseCookieHeader(req?.headers?.cookie || "");
  const token = cookies[ADMIN_SESSION_COOKIE];
  return verifyAdminSessionToken(token);
}

export function requireAdminApi(req, res) {
  if (!isAdminRequest(req)) {
    res.status(401).json({ message: "No autorizado" });
    return false;
  }
  return true;
}
