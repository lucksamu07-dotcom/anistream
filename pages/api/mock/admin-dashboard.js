import { catalogKpis, normalizeGenres } from "../../../lib/adminCatalog";
import { readCatalog, readAuditLog } from "../../../lib/adminStorage";
import { requireAdminAccess } from "../../../lib/adminSecurity";

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ message: "Metodo no permitido" });
  if (!requireAdminAccess(req, res)) return;

  try {
    const catalog = readCatalog();
    const kpis = catalogKpis(catalog);
    const genreCounts = {};
    for (const anime of catalog) {
      for (const genre of normalizeGenres(anime.genre)) {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      }
    }
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([genre, count]) => ({ genre, count }));

    const audit = readAuditLog().slice(-12).reverse();
    return res.status(200).json({ kpis, topGenres, recentAudit: audit });
  } catch {
    return res.status(500).json({ message: "Error generando dashboard" });
  }
}

