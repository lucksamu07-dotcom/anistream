import { fetchMetadataDebugByTitle, fetchEpisodesDeepByTitle } from "../../../lib/metadataEnricher";
import { requireAdminAccess } from "../../../lib/adminSecurity";
import { normalizeGenres, toId } from "../../../lib/adminCatalog";

function normalizeEpisodeList(episodes, animeId) {
  const list = Array.isArray(episodes) ? episodes : [];
  const map = new Map();

  for (let i = 0; i < list.length; i += 1) {
    const ep = list[i] || {};
    const sourceUrl = String(ep.sourceUrl || "").trim();
    const sourcesFromField = Array.isArray(ep.sources) ? ep.sources.filter((s) => s?.url) : [];
    const fallbackSource = sourceUrl ? [{ label: "Principal", url: sourceUrl, language: "original" }] : [];
    const sources = [...sourcesFromField, ...fallbackSource];
    const safeSourceUrl = sourceUrl || String(sources[0]?.url || "").trim();
    if (!safeSourceUrl) continue;

    const title = String(ep.title || `Episodio ${i + 1}`).trim();
    const slug = String(ep.slug || `${animeId}-ep${i + 1}`).trim();
    const key = String(slug || safeSourceUrl).toLowerCase();
    if (map.has(key)) continue;

    map.set(key, {
      id: String(ep.id || `ep${map.size + 1}`),
      title,
      slug,
      sourceUrl: safeSourceUrl,
      language: String(ep.language || "original").trim(),
      sources: sources.length > 0 ? sources : [{ label: "Principal", url: safeSourceUrl, language: "original" }],
      updatedAt: new Date().toISOString(),
    });
  }

  return Array.from(map.values());
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Metodo no permitido" });
  }
  if (!requireAdminAccess(req, res)) return;

  const title = String(req.body?.title || "").trim();
  if (!title) {
    return res.status(400).json({ message: "Titulo requerido" });
  }

  try {
    const metaResult = await fetchMetadataDebugByTitle(title);
    const metadata = metaResult?.metadata || { title };
    const source = String(req.body?.source || metaResult?.source || "desconocida").trim();
    const sourceLink = String(req.body?.link || metaResult?.link || "").trim();
    const finalTitle = String(metadata.title || title).trim();

    const titleAttempts = [...new Set([title, finalTitle].map((t) => String(t || "").trim()).filter(Boolean))];
    let episodes = [];

    for (const candidateTitle of titleAttempts) {
      // eslint-disable-next-line no-await-in-loop
      const found = await fetchEpisodesDeepByTitle(candidateTitle);
      if (Array.isArray(found) && found.length > 0) {
        episodes = found;
        break;
      }
    }

    if (episodes.length === 0) {
      episodes = Array.isArray(metadata.episodes) ? metadata.episodes : [];
    }

    const animeId = toId(finalTitle);
    const normalizedEpisodes = normalizeEpisodeList(episodes, animeId);
    const anime = {
      id: animeId,
      title: finalTitle,
      year: metadata.year || "",
      genre: normalizeGenres(metadata.genre),
      description: String(metadata.description || "").trim(),
      cover: String(metadata.cover || "").trim(),
      episodes: normalizedEpisodes,
      source,
      sourceLink,
    };

    return res.status(200).json({
      message: "Serie preparada para agregar",
      anime,
      source,
      link: sourceLink,
      confidence: metaResult?.confidence ?? 0,
      episodesFound: normalizedEpisodes.length,
    });
  } catch {
    return res.status(500).json({ message: "Error agregando hentai descubierto" });
  }
}
