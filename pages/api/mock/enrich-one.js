import { fetchMetadataDebugByTitle } from "../../../lib/metadataEnricher";
import { requireAdminApi } from "../../../lib/adminAuth";

export default async function handler(req, res) {
  if (!requireAdminApi(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Metodo no permitido" });
  }

  const title = req.body?.title;
  if (!title || !String(title).trim()) {
    return res.status(400).json({ message: "Titulo requerido" });
  }

  const result = await fetchMetadataDebugByTitle(title);
  if (!result) {
    return res.status(404).json({ message: "No se encontro en las fuentes" });
  }

  if (!result.accepted) {
    return res.status(200).json({
      message: "Coincidencia debil. Revisa antes de aplicar.",
      metadata: result.metadata,
      source: result.source,
      confidence: result.confidence,
      accepted: false,
    });
  }

  return res.status(200).json({
    message: "Encontrado",
    metadata: result.metadata,
    source: result.source,
    confidence: result.confidence,
    accepted: true,
  });
}
