import { fetchMetadataDebugByTitle, fetchEpisodesDeepByTitle } from "../../../lib/metadataEnricher";
import { requireAdminAccess } from "../../../lib/adminSecurity";
import { normalizeGenres, toId } from "../../../lib/adminCatalog";

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
    let episodes = Array.isArray(metadata.episodes) ? metadata.episodes : [];

    if (episodes.length === 0) {
      episodes = await fetchEpisodesDeepByTitle(title);
    }

    const finalTitle = String(metadata.title || title).trim();
    const anime = {
      id: toId(finalTitle),
      title: finalTitle,
      year: metadata.year || "",
      genre: normalizeGenres(metadata.genre),
      description: String(metadata.description || "").trim(),
      cover: String(metadata.cover || "").trim(),
      episodes: Array.isArray(episodes) ? episodes : [],
    };

    return res.status(200).json({
      message: "Serie preparada para agregar",
      anime,
      source: metaResult?.source || "desconocida",
      confidence: metaResult?.confidence ?? 0,
    });
  } catch {
    return res.status(500).json({ message: "Error agregando hentai descubierto" });
  }
}
