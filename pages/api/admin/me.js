import { isAdminRequest } from "../../../lib/adminAuth";

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Metodo no permitido" });
  }

  if (!isAdminRequest(req)) {
    return res.status(401).json({ authenticated: false });
  }

  return res.status(200).json({ authenticated: true });
}
