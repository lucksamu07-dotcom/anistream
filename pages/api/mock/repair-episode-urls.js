import { fetchEpisodesDeepByTitle } from "../../../lib/metadataEnricher";

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
  const text = `${episode?.id || ""} ${episode?.slug || ""} ${episode?.title || ""}`;
  const match = text.match(/(?:ep|episodio)?\s*0*(\d{1,4})/i);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
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

