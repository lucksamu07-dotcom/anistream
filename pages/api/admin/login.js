import {
  createAdminSessionToken,
  isAdminEnvConfigured,
  setAdminSessionCookie,
  validateAdminCredentials,
} from "../../../lib/adminAuth";

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Metodo no permitido" });
  }

  if (!isAdminEnvConfigured()) {
    return res.status(500).json({
      message: "Falta configurar ADMIN_USER, ADMIN_PASS y ADMIN_SESSION_SECRET en Vercel",
    });
  }

  const user = String(req.body?.user || "");
  const password = String(req.body?.password || "");

  if (!validateAdminCredentials(user, password)) {
    return res.status(401).json({ message: "Usuario o contrasena incorrectos" });
  }

  const token = createAdminSessionToken(user);
  setAdminSessionCookie(res, token);
  return res.status(200).json({ ok: true });
}
