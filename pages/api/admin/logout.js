import { clearAdminSessionCookie } from "../../../lib/adminAuth";

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Metodo no permitido" });
  }

  clearAdminSessionCookie(res);
  return res.status(200).json({ ok: true });
}
