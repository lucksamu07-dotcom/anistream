import { readAuditLog } from "../../../lib/adminStorage";
import { requireAdminAccess } from "../../../lib/adminSecurity";

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ message: "Metodo no permitido" });
  if (!requireAdminAccess(req, res)) return;

  try {
    const limit = Math.max(1, Math.min(Number(req.query?.limit) || 60, 300));
    const log = readAuditLog().slice(-limit).reverse();
    return res.status(200).json({ items: log });
  } catch {
    return res.status(500).json({ message: "Error leyendo auditoria" });
  }
}

