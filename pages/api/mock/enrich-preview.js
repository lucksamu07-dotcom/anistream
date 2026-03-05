import { enrichCatalog } from "../../../lib/metadataEnricher";
import { requireAdminAccess } from "../../../lib/adminSecurity";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Metodo no permitido" });
  }
  if (!requireAdminAccess(req, res)) return;

  try {
    const { animes, enrichedCount, consolidatedCount } = await enrichCatalog(req.body);
    return res.status(200).json({
      message: "Previsualizacion completada",
      animes,
      enrichedCount,
      consolidatedCount,
    });
  } catch {
    return res.status(500).json({ message: "Error al autocompletar metadatos" });
  }
}
