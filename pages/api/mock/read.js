import { requireAdminAccess } from "../../../lib/adminSecurity";
import { readCatalog } from "../../../lib/adminStorage";

export default function handler(req, res) {
  if (!requireAdminAccess(req, res)) return;

  try {
    return res.status(200).json(readCatalog());
  } catch {
    return res.status(500).json({ message: "Error al leer los datos" });
  }
}

