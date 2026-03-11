import { isLocalHost } from "../../../lib/adminSecurity";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Metodo no permitido" });
  }

  if (!isLocalHost(req)) {
    return res.status(404).json({ message: "Not found" });
  }

  const user = String(req.body?.user || "").trim();
  const password = String(req.body?.password || "").trim();

  const configuredUser = String(process.env.ADMIN_USER || "admin2025").trim();
  const configuredPass = String(process.env.ADMIN_PASS || "anistream959123").trim();

  if (!user || !password) {
    return res.status(400).json({ message: "Credenciales requeridas" });
  }

  if (user !== configuredUser || password !== configuredPass) {
    return res.status(401).json({ message: "Usuario o contrasena incorrectos" });
  }

  return res.status(200).json({ ok: true });
}
