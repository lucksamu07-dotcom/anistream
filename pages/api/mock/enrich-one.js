import { fetchMetadataDebugByTitle } from "../../../lib/metadataEnricher";
import { requireAdminAccess } from "../../../lib/adminSecurity";

const CACHE = new Map();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Metodo no permitido" });
  }
  if (!requireAdminAccess(req, res)) return;

  const title = req.body?.title;
  const safeTitle = String(title || "").trim();
  if (!safeTitle) {
    return res.status(400).json({ message: "Titulo requerido" });
  }

  const key = safeTitle.toLowerCase();
  const cached = CACHE.get(key);
  if (cached && Date.now() - cached.ts < 1000 * 60 * 15) {
    return res.status(200).json(cached.payload);
  }

  const result = await fetchMetadataDebugByTitle(safeTitle);
  if (!result) {
    return res.status(404).json({ message: "No se encontro en las fuentes" });
  }

  const payload = !result.accepted
    ? {
        message: "Coincidencia debil. Revisa antes de aplicar.",
        metadata: result.metadata,
        source: result.source,
        confidence: result.confidence,
        accepted: false,
      }
    : {
        message: "Encontrado",
        metadata: result.metadata,
        source: result.source,
        confidence: result.confidence,
        accepted: true,
      };

  CACHE.set(key, { ts: Date.now(), payload });
  return res.status(200).json(payload);
}
