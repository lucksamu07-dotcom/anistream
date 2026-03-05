import { listSnapshots, rollbackFromSnapshot, appendAudit, readCatalog, createSnapshot } from "../../../lib/adminStorage";
import { requireAdminAccess } from "../../../lib/adminSecurity";

export default function handler(req, res) {
  if (!requireAdminAccess(req, res)) return;

  if (req.method === "GET") {
    return res.status(200).json({ snapshots: listSnapshots() });
  }

  if (req.method === "POST") {
    const snapshot = String(req.body?.snapshot || "").trim();
    if (!snapshot) return res.status(400).json({ message: "Snapshot requerido" });
    try {
      createSnapshot(readCatalog(), "before-rollback");
      const restored = rollbackFromSnapshot(snapshot);
      appendAudit({
        action: "catalog.rollback",
        detail: `Rollback aplicado desde ${snapshot}`,
        snapshot,
      });
      return res.status(200).json({ message: "Rollback aplicado", items: restored.length });
    } catch (error) {
      return res.status(500).json({ message: error.message || "No se pudo hacer rollback" });
    }
  }

  return res.status(405).json({ message: "Metodo no permitido" });
}

