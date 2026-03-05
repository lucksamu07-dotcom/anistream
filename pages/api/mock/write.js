import { appendAudit, createSnapshot, readCatalog, writeCatalog } from "../../../lib/adminStorage";
import { requireAdminAccess } from "../../../lib/adminSecurity";
import { dedupeCatalog } from "../../../lib/adminCatalog";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Metodo no permitido" });
  }
  if (!requireAdminAccess(req, res)) return;

  try {
    const previous = readCatalog();
    const incoming = dedupeCatalog(req.body);
    const saved = writeCatalog(incoming);
    const snapshot = createSnapshot(previous, "before-write");
    appendAudit({
      action: "catalog.write",
      detail: `Catalogo guardado (${saved.length} series)`,
      snapshot: snapshot.fileName,
    });

    return res.status(200).json({
      message: "Cambios guardados correctamente",
      enrichedCount: 0,
      consolidatedCount: Math.max(previous.length - saved.length, 0),
    });
  } catch {
    return res.status(500).json({ message: "Error al guardar los datos" });
  }
}

