import fs from "fs";
import path from "path";
import { requireAdminApi } from "../../../lib/adminAuth";

function normalizeCatalog(input) {
  if (!Array.isArray(input)) return [];

  return input.map((anime) => ({
    id: String(anime?.id || "").trim(),
    title: String(anime?.title || "").trim(),
    year: anime?.year || "",
    genre: Array.isArray(anime?.genre)
      ? anime.genre.filter(Boolean)
      : typeof anime?.genre === "string"
      ? anime.genre.split(",").map((g) => g.trim()).filter(Boolean)
      : [],
    description: String(anime?.description || anime?.synopsis || "").trim(),
    cover: String(anime?.cover || "").trim(),
    episodes: Array.isArray(anime?.episodes)
      ? anime.episodes.map((ep, idx) => ({
          id: String(ep?.id || `ep${idx + 1}`),
          title: String(ep?.title || `Episodio ${idx + 1}`),
          slug: String(ep?.slug || "").trim(),
          sourceUrl: String(ep?.sourceUrl || "").trim(),
          sources: Array.isArray(ep?.sources)
            ? ep.sources
                .filter((s) => s && s.url)
                .map((s, i) => ({
                  label: String(s.label || `Servidor ${i + 1}`),
                  url: String(s.url),
                }))
            : [],
        }))
      : [],
  }));
}

export default async function handler(req, res) {
  if (!requireAdminApi(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Metodo no permitido" });
  }

  const filePath = path.join(process.cwd(), "data", "videos.json");

  try {
    const normalized = normalizeCatalog(req.body);
    fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), "utf-8");

    return res.status(200).json({
      message: "Cambios guardados correctamente",
      enrichedCount: 0,
      consolidatedCount: 0,
    });
  } catch {
    return res.status(500).json({ message: "Error al guardar los datos" });
  }
}
