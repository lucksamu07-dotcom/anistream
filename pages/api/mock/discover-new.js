import {
  discoverNewHentaiCandidates,
  fetchMetadataDebugByTitle,
  fetchEpisodesDeepByTitle,
} from "../../../lib/metadataEnricher";
import { requireAdminAccess } from "../../../lib/adminSecurity";

const CACHE = new Map();
const ENRICH_CONCURRENCY = 4;

function hasRequiredMetadata(metadata, episodes) {
  const cover = String(metadata?.cover || "").trim();
  const description = String(metadata?.description || "").trim();
  const year = String(metadata?.year || "").trim();
  const genre = Array.isArray(metadata?.genre) ? metadata.genre.filter(Boolean) : [];
  const eps = Array.isArray(episodes) ? episodes.filter(Boolean) : [];
  return Boolean(cover && description && year && genre.length > 0 && eps.length > 0);
}

async function mapWithConcurrency(items, concurrency, worker) {
  const list = Array.isArray(items) ? items : [];
  const out = new Array(list.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, list.length || 1)) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= list.length) return;
      out[index] = await worker(list[index], index);
    }
  });

  await Promise.all(runners);
  return out;
}

async function enrichCandidate(candidate) {
  const title = String(candidate?.title || "").trim();
  if (!title) return null;

  try {
    const meta = await fetchMetadataDebugByTitle(title);
    let episodes = Array.isArray(meta?.metadata?.episodes) ? meta.metadata.episodes : [];
    if (episodes.length === 0) {
      episodes = await fetchEpisodesDeepByTitle(title);
    }
    if (!Array.isArray(episodes) || episodes.length === 0) return null;
    if (!hasRequiredMetadata(meta?.metadata, episodes)) return null;

    return {
      ...candidate,
      confidence: meta?.confidence ?? 0,
      cover: meta?.metadata?.cover || "",
      description: meta?.metadata?.description || "",
      year: meta?.metadata?.year || "",
      genre: Array.isArray(meta?.metadata?.genre) ? meta.metadata.genre : [],
      episodesCount: episodes.length,
    };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Metodo no permitido" });
  }
  if (!requireAdminAccess(req, res)) return;

  try {
    const existingTitles = Array.isArray(req.body?.existingTitles) ? req.body.existingTitles : [];
    const limit = Number(req.body?.limit) || 80;
    const cacheKey = JSON.stringify({ existingTitles: existingTitles.slice(0, 120), limit });
    const cached = CACHE.get(cacheKey);
    if (cached && Date.now() - cached.ts < 1000 * 60 * 10 && (cached.payload?.candidates || []).length > 0) {
      return res.status(200).json(cached.payload);
    }

    const candidates = await discoverNewHentaiCandidates(existingTitles, limit);
    const enriched = await mapWithConcurrency(
      (Array.isArray(candidates) ? candidates : []).slice(0, Math.max(60, limit)),
      ENRICH_CONCURRENCY,
      (candidate) => enrichCandidate(candidate)
    );

    const payload = {
      message: "Busqueda completada",
      candidates: Array.isArray(enriched) ? enriched.filter(Boolean) : [],
    };
    CACHE.set(cacheKey, { ts: Date.now(), payload });

    return res.status(200).json(payload);
  } catch {
    return res.status(500).json({ message: "Error buscando nuevos hentai" });
  }
}
