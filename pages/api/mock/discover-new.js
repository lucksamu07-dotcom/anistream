import { discoverNewHentaiCandidates, fetchMetadataDebugByTitle } from "../../../lib/metadataEnricher";
import { requireAdminAccess } from "../../../lib/adminSecurity";

const CACHE = new Map();

async function enrichCandidate(candidate) {
  const title = String(candidate?.title || "").trim();
  if (!title) return candidate;

  try {
    const meta = await fetchMetadataDebugByTitle(title);
    return {
      ...candidate,
      confidence: meta?.confidence ?? 0,
      cover: meta?.metadata?.cover || "",
      year: meta?.metadata?.year || "",
      genre: Array.isArray(meta?.metadata?.genre) ? meta.metadata.genre : [],
    };
  } catch {
    return candidate;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Metodo no permitido" });
  }
  if (!requireAdminAccess(req, res)) return;

  try {
    const existingTitles = Array.isArray(req.body?.existingTitles) ? req.body.existingTitles : [];
    const limit = Number(req.body?.limit) || 30;
    const cacheKey = JSON.stringify({ existingTitles: existingTitles.slice(0, 120), limit });
    const cached = CACHE.get(cacheKey);
    if (cached && Date.now() - cached.ts < 1000 * 60 * 10) {
      return res.status(200).json(cached.payload);
    }

    const candidates = await discoverNewHentaiCandidates(existingTitles, limit);
    const enriched = await Promise.all(
      (Array.isArray(candidates) ? candidates : [])
        .slice(0, 40)
        .map((candidate) => enrichCandidate(candidate))
    );

    const payload = {
      message: "Busqueda completada",
      candidates: Array.isArray(enriched) ? enriched : [],
    };
    CACHE.set(cacheKey, { ts: Date.now(), payload });

    return res.status(200).json(payload);
  } catch {
    return res.status(500).json({ message: "Error buscando nuevos hentai" });
  }
}
