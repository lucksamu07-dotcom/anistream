import { fetchEpisodesDeepByTitle } from "../../../lib/metadataEnricher";
import { requireAdminAccess } from "../../../lib/adminSecurity";

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getEpisodeNumber(episode) {
  const text = `${episode?.title || ""} ${episode?.slug || ""} ${episode?.id || ""}`.toLowerCase();
  const strong =
    text.match(/(?:episodio|episode|ep|capitulo|cap)\s*[-#:.\s]*0*(\d{1,4})\b/i)?.[1] ||
    text.match(/(?:^|[^a-z])e\s*0*(\d{1,4})(?:[^a-z]|$)/i)?.[1];
  if (strong) return Number(strong);
  const numbers = [...text.matchAll(/\b(\d{1,4})\b/g)].map((m) => Number(m[1]));
  if (numbers.length === 0) return Number.POSITIVE_INFINITY;
  const last = numbers[numbers.length - 1];
  if (last >= 1900 && last <= 2100) return Number.POSITIVE_INFINITY;
  return last;
}

function titleSimilarity(a, b) {
  const ta = new Set(normalizeText(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;

  let common = 0;
  for (const token of ta) {
    if (tb.has(token)) common += 1;
  }
  return common / Math.max(ta.size, tb.size);
}

function findBestMatch(targetEpisode, freshEpisodes) {
  const targetNum = getEpisodeNumber(targetEpisode);

  if (Number.isFinite(targetNum)) {
    const byNumber = freshEpisodes.find((ep) => getEpisodeNumber(ep) === targetNum);
    if (byNumber) return byNumber;
  }

  let best = null;
  let bestScore = 0;
  for (const ep of freshEpisodes) {
    const score = titleSimilarity(targetEpisode?.title, ep?.title);
    if (score > bestScore) {
      best = ep;
      bestScore = score;
    }
  }

  return bestScore >= 0.5 ? best : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Metodo no permitido" });
  }
  if (!requireAdminAccess(req, res)) return;

  const title = String(req.body?.title || "").trim();
  const episodes = Array.isArray(req.body?.episodes) ? req.body.episodes : [];
  if (!title) return res.status(400).json({ message: "Titulo requerido" });

  try {
    const freshEpisodes = await fetchEpisodesDeepByTitle(title);
    if (!Array.isArray(freshEpisodes) || freshEpisodes.length === 0) {
      return res.status(404).json({ message: "No se encontraron URLs nuevas para esta serie" });
    }

    let replacedCount = 0;
    const updatedEpisodes = episodes.map((episode) => {
      const match = findBestMatch(episode, freshEpisodes);
      if (!match || !match.sourceUrl) return episode;

      replacedCount += 1;
      return {
        ...episode,
        sourceUrl: match.sourceUrl,
        sources: Array.isArray(match.sources) ? match.sources : [],
        updatedAt: new Date().toISOString(),
      };
    });

    return res.status(200).json({
      message: "Reparacion de URLs completada",
      replacedCount,
      updatedEpisodes,
      foundFreshEpisodes: freshEpisodes.length,
    });
  } catch {
    return res.status(500).json({ message: "Error reparando URLs" });
  }
}
