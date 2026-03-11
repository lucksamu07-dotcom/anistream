import {
  fetchMetadataCandidatesByTitle,
  fetchMetadataDebugByTitle,
  fetchEpisodesDeepByTitle,
} from "../../../lib/metadataEnricher";
import { requireAdminAccess } from "../../../lib/adminSecurity";

const CACHE = new Map();
const ENRICH_CONCURRENCY = 3;

function hasRequiredMetadata(metadata) {
  const cover = String(metadata?.cover || "").trim();
  const description = String(metadata?.description || "").trim();
  const year = String(metadata?.year || "").trim();
  const genre = Array.isArray(metadata?.genre) ? metadata.genre.filter(Boolean) : [];
  const episodes = Array.isArray(metadata?.episodes) ? metadata.episodes.filter(Boolean) : [];
  return Boolean(cover && description && year && genre.length > 0 && episodes.length > 0);
}

function describeMissing(metadata) {
  const missing = [];
  if (!String(metadata?.cover || "").trim()) missing.push("portada");
  if (!String(metadata?.description || "").trim()) missing.push("sinopsis");
  if (!String(metadata?.year || "").trim()) missing.push("ano");
  const genre = Array.isArray(metadata?.genre) ? metadata.genre.filter(Boolean) : [];
  if (genre.length === 0) missing.push("genero");
  const episodes = Array.isArray(metadata?.episodes) ? metadata.episodes.filter(Boolean) : [];
  if (episodes.length === 0) missing.push("episodios");
  return missing;
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

async function enrichCandidateWithEpisodes(candidate, fallbackTitle, allowDeep = true) {
  if (!candidate?.metadata) return null;
  const baseTitle = String(candidate.metadata.title || fallbackTitle || "").trim();
  let episodes = Array.isArray(candidate.metadata.episodes) ? candidate.metadata.episodes : [];
  if (episodes.length === 0 && baseTitle && allowDeep) {
    episodes = await fetchEpisodesDeepByTitle(baseTitle);
  }
  const metadata = {
    ...candidate.metadata,
    episodes,
  };
  if (!hasRequiredMetadata(metadata)) return null;

  return {
    ...candidate,
    metadata,
    episodesCount: episodes.length,
    cover: metadata.cover || "",
    description: metadata.description || "",
    year: metadata.year || "",
    genre: Array.isArray(metadata.genre) ? metadata.genre : [],
    link: candidate.link || "",
  };
}

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
  const mode = String(req.body?.mode || "full").toLowerCase();
  const fastMode = mode === "fast";

  const key = `${safeTitle.toLowerCase()}|${fastMode ? "fast" : "full"}`;
  const cached = CACHE.get(key);
  if (cached && Date.now() - cached.ts < 1000 * 60 * 15) {
    return res.status(200).json(cached.payload);
  }

  const [best, candidates] = await Promise.all([
    fetchMetadataDebugByTitle(safeTitle),
    fetchMetadataCandidatesByTitle(safeTitle),
  ]);

  if (!best && (!Array.isArray(candidates) || candidates.length === 0)) {
    return res.status(404).json({ message: "No se encontro en las fuentes" });
  }

  const enrichedCandidates = await mapWithConcurrency(
    Array.isArray(candidates) ? candidates : [],
    ENRICH_CONCURRENCY,
    (candidate) => enrichCandidateWithEpisodes(candidate, safeTitle, !fastMode)
  );
  const onlyCompleteCandidates = Array.isArray(enrichedCandidates) ? enrichedCandidates.filter(Boolean) : [];

  const enrichedBest = best ? await enrichCandidateWithEpisodes(best, safeTitle, true) : null;
  const top = enrichedBest || onlyCompleteCandidates[0] || null;
  if (!top) {
    return res
      .status(404)
      .json({ message: "No se encontraron resultados completos (portada, sinopsis, genero, ano y episodios)." });
  }

  const diagnostics = (Array.isArray(candidates) ? candidates : [])
    .filter((item) => item?.metadata)
    .map((item) => ({
      source: item.source || "desconocida",
      link: item.link || "",
      title: item.metadata?.title || "",
      missing: describeMissing(item.metadata),
      episodesCount: Array.isArray(item.metadata?.episodes) ? item.metadata.episodes.length : 0,
    }));

  const payload = {
    message: best?.accepted === false ? "Coincidencia debil. Revisa antes de aplicar." : "Encontrado",
    metadata: top?.metadata || { title: safeTitle },
    source: top?.source || "desconocida",
    link: top?.link || "",
    confidence: Number(top?.confidence || 0),
    accepted: best?.accepted !== false,
    candidates: onlyCompleteCandidates,
    diagnostics,
    mode,
  };

  CACHE.set(key, { ts: Date.now(), payload });
  return res.status(200).json(payload);
}
