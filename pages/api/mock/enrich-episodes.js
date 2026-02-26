import { fetchEpisodesDeepByTitle } from "../../../lib/metadataEnricher";
import { requireAdminApi } from "../../../lib/adminAuth";

export default async function handler(req, res) {
  if (!requireAdminApi(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Metodo no permitido" });
  }

  const title = req.body?.title;
  if (!title || !String(title).trim()) {
    return res.status(400).json({ message: "Titulo requerido" });
  }

  try {
    const episodes = await fetchEpisodesDeepByTitle(String(title).trim());
    return res.status(200).json({
      message: "Busqueda profunda completada",
      episodes: Array.isArray(episodes) ? episodes : [],
    });
  } catch {
    return res.status(500).json({ message: "Error buscando episodios" });
  }
}
