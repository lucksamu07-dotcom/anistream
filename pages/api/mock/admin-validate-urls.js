import { readCatalog, writeCatalog, appendAudit, createSnapshot } from "../../../lib/adminStorage";
import { requireAdminAccess } from "../../../lib/adminSecurity";

function isLikelyVideoUrl(url) {
  return /stream|dood|wish|voe|sendvid|mp4upload|filemoon|mixdrop|m3u8|\.mp4|hls|embed/i.test(String(url || ""));
}

function isBlockedSource(url) {
  return /hentaistream\./i.test(String(url || ""));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function checkUrl(url) {
  const safe = String(url || "").trim();
  if (!safe || !isLikelyVideoUrl(safe) || isBlockedSource(safe)) return "down";

  try {
    if (safe.includes(".m3u8") || /\.(mp4|webm)(\?|$)/i.test(safe)) {
      const res = await fetchWithTimeout(safe, { method: "GET", headers: { Range: "bytes=0-1024" } }, 8000);
      return res.ok || res.status === 206 ? "up" : "down";
    }
    const res = await fetchWithTimeout(safe, { method: "GET" }, 8000);
    if (!res.ok) return "down";
    const text = await res.text();
    if (/not found|file not found|removed|dmca|forbidden|access denied/i.test(text)) return "down";
    return "up";
  } catch {
    return "down";
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Metodo no permitido" });
  if (!requireAdminAccess(req, res)) return;

  try {
    const animeId = String(req.body?.animeId || "").trim();
    const catalog = readCatalog();
    const next = [];
    let checked = 0;
    let down = 0;

    for (const anime of catalog) {
      if (animeId && anime.id !== animeId) {
        next.push(anime);
        continue;
      }
      const episodes = [];
      for (const ep of Array.isArray(anime.episodes) ? anime.episodes : []) {
        const sourceList = Array.isArray(ep.sources) ? ep.sources : [];
        const evaluated = [];
        for (const source of sourceList.slice(0, 6)) {
          // eslint-disable-next-line no-await-in-loop
          const status = await checkUrl(source.url);
          checked += 1;
          if (status === "down") down += 1;
          evaluated.push({ ...source, status, checkedAt: new Date().toISOString() });
        }

        const playable = evaluated.find((s) => s.status === "up");
        episodes.push({
          ...ep,
          sources: evaluated,
          sourceUrl: playable?.url || ep.sourceUrl || "",
          updatedAt: new Date().toISOString(),
        });
      }
      next.push({ ...anime, episodes, updatedAt: new Date().toISOString() });
    }

    const snapshot = createSnapshot(catalog, "before-url-validation");
    writeCatalog(next);
    appendAudit({
      action: "catalog.validate-urls",
      detail: `URLs validadas: ${checked}, caidas: ${down}`,
      snapshot: snapshot.fileName,
    });

    return res.status(200).json({ message: "Validacion completada", checked, down });
  } catch {
    return res.status(500).json({ message: "Error validando URLs" });
  }
}

