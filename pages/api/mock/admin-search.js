import { normalizeGenres, normalizeText, similarityScore } from "../../../lib/adminCatalog";
import { readCatalog } from "../../../lib/adminStorage";
import { requireAdminAccess } from "../../../lib/adminSecurity";

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ message: "Metodo no permitido" });
  if (!requireAdminAccess(req, res)) return;

  try {
    const q = String(req.query?.q || "").trim();
    const year = String(req.query?.year || "").trim();
    const state = String(req.query?.state || "").trim().toLowerCase();
    const genresRaw = String(req.query?.genres || "").trim();
    const genres = genresRaw
      ? genresRaw
          .split(",")
          .map((x) => normalizeText(x))
          .filter(Boolean)
      : [];

    const catalog = readCatalog();
    const filtered = catalog.filter((anime) => {
      if (year && String(anime?.year || "") !== year) return false;
      const animeGenres = normalizeGenres(anime.genre);
      if (genres.length > 0 && !genres.every((g) => animeGenres.includes(g))) return false;

      if (state === "incomplete") {
        if (anime.description && anime.cover && anime.year && animeGenres.length > 0) return false;
      }
      if (state === "complete") {
        if (!anime.description || !anime.cover || !anime.year || animeGenres.length === 0) return false;
      }
      return true;
    });

    const scored = filtered
      .map((anime) => ({
        ...anime,
        _score: q
          ? Math.max(
              similarityScore(q, anime.title),
              similarityScore(q, anime.id),
              similarityScore(q, `${anime.title} ${(anime.genre || []).join(" ")}`)
            )
          : 1,
      }))
      .filter((anime) => (q ? anime._score >= 0.2 : true))
      .sort((a, b) => b._score - a._score)
      .slice(0, 120);

    return res.status(200).json({
      count: scored.length,
      items: scored.map(({ _score, ...anime }) => anime),
    });
  } catch {
    return res.status(500).json({ message: "Error buscando en catalogo" });
  }
}

