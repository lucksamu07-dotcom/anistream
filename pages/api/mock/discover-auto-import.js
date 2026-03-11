import {
  discoverNewHentaiCandidates,
  fetchMetadataDebugByTitle,
  fetchEpisodesDeepByTitle,
} from "../../../lib/metadataEnricher";
import { requireAdminAccess } from "../../../lib/adminSecurity";
import { appendAudit, createSnapshot, readCatalog, writeCatalog } from "../../../lib/adminStorage";
import {
  compareEpisodes,
  mergeEpisodes,
  normalizeGenres,
  normalizeText,
  splitGenres,
  toId,
} from "../../../lib/adminCatalog";

const CANDIDATE_CONCURRENCY = 3;
const EPISODE_CONCURRENCY = 4;
const SOURCE_CHECK_LIMIT = 4;
const CANDIDATE_SCAN_FACTOR = 3;

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

function likelyVideoUrl(url) {
  return /stream|dood|wish|voe|sendvid|mp4upload|filemoon|mixdrop|m3u8|\.mp4|hls|embed|streamtape/i.test(
    String(url || "")
  );
}

function adOrBadHost(url) {
  return /doubleclick|googlesyndication|analytics|facebook|twitter|x\.com|t\.co|bitly|adservice/i.test(
    String(url || "")
  );
}

function brokenContent(text) {
  return /file not found|video not found|not found|removed|content unavailable|forbidden|access denied|dmca/i.test(
    String(text || "")
  );
}

async function fetchWithTimeout(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function validateSource(source) {
  const rawUrl = String(source?.url || "").trim();
  if (!rawUrl || adOrBadHost(rawUrl)) return null;

  try {
    const res = await fetchWithTimeout(rawUrl, 9000);
    const finalUrl = String(res.url || rawUrl);
    if (!res.ok) return null;
    if (adOrBadHost(finalUrl)) return null;

    const contentType = String(res.headers.get("content-type") || "").toLowerCase();
    const redirectedToPage = finalUrl !== rawUrl && !likelyVideoUrl(finalUrl);
    if (redirectedToPage && !contentType.includes("video") && !contentType.includes("mpegurl")) {
      return null;
    }

    if (contentType.includes("text/html")) {
      const html = await res.text();
      if (brokenContent(html)) return null;
      if (!likelyVideoUrl(finalUrl) && !likelyVideoUrl(html)) return null;
    }

    return {
      label: String(source?.label || "Servidor"),
      url: finalUrl,
      language: String(source?.language || "original").trim().toLowerCase(),
      status: "up",
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function validateEpisodes(episodes) {
  const normalized = await mapWithConcurrency(
    Array.isArray(episodes) ? episodes : [],
    EPISODE_CONCURRENCY,
    async (episode) => {
    const baseSources = Array.isArray(episode?.sources) && episode.sources.length > 0
      ? episode.sources
      : episode?.sourceUrl
      ? [{ label: "Principal", url: episode.sourceUrl, language: episode.language || "original" }]
      : [];

      const checks = await Promise.all(
        baseSources.slice(0, SOURCE_CHECK_LIMIT).map((source) => validateSource(source))
      );
      const validSources = checks.filter(Boolean);
      const fallbackSource = baseSources.find((source) => likelyVideoUrl(source?.url));
      if (validSources.length === 0 && !fallbackSource) return null;
      const finalSources =
        validSources.length > 0
          ? validSources
          : [
              {
                label: String(fallbackSource?.label || "Principal"),
                url: String(fallbackSource?.url || "").trim(),
                language: String(fallbackSource?.language || "original").trim().toLowerCase(),
                status: "unknown",
                checkedAt: new Date().toISOString(),
              },
            ];

      return {
      id: String(episode?.id || ""),
      title: String(episode?.title || "").trim(),
      slug: String(episode?.slug || "").trim(),
      sourceUrl: finalSources[0].url,
      language: finalSources[0].language || "original",
      sources: finalSources,
      updatedAt: new Date().toISOString(),
      };
    }
  );

  return normalized.filter(Boolean).sort(compareEpisodes);
}

function mergeAnime(catalog, incomingAnime) {
  const normTitle = normalizeText(incomingAnime?.title || "");
  const idx = catalog.findIndex((a) => normalizeText(a.title) === normTitle);
  if (idx < 0) return { next: [...catalog, incomingAnime], added: true, updated: false };

  const current = catalog[idx];
  const merged = {
    ...current,
    year: current.year || incomingAnime.year || "",
    cover: current.cover || incomingAnime.cover || "",
    description: current.description || incomingAnime.description || "",
    genre: [...new Set([...(splitGenres(current.genre) || []), ...(splitGenres(incomingAnime.genre) || [])])],
    episodes: mergeEpisodes(current.episodes, incomingAnime.episodes, current.id),
    updatedAt: new Date().toISOString(),
  };

  const next = [...catalog];
  next[idx] = merged;
  return { next, added: false, updated: true };
}

async function processCandidateTitle(title) {
  const safeTitle = String(title || "").trim();
  if (!safeTitle) return { skipped: true, title: safeTitle };

  try {
    const metaResult = await fetchMetadataDebugByTitle(safeTitle);
    const metadata = metaResult?.metadata || { title: safeTitle };

    let episodes = Array.isArray(metadata.episodes) ? metadata.episodes : [];
    if (episodes.length === 0) {
      episodes = await fetchEpisodesDeepByTitle(safeTitle);
    }

    const validatedEpisodes = await validateEpisodes(episodes);
    if (validatedEpisodes.length === 0) {
      return { skipped: true, title: safeTitle };
    }

    const anime = {
      id: toId(metadata.title || safeTitle),
      title: String(metadata.title || safeTitle).trim(),
      year: metadata.year || "",
      genre: normalizeGenres(metadata.genre),
      description: String(metadata.description || "").trim(),
      cover: String(metadata.cover || "").trim(),
      episodes: validatedEpisodes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return { skipped: false, anime, title: safeTitle };
  } catch {
    return { skipped: true, title: safeTitle };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Metodo no permitido" });
  if (!requireAdminAccess(req, res)) return;

  const targetCount = Math.max(1, Math.min(Number(req.body?.count) || 20, 20));

  try {
    const beforeCatalog = readCatalog();
    const existingTitles = beforeCatalog.map((a) => a.title);
    const candidates = await discoverNewHentaiCandidates(existingTitles, targetCount * 6);

    const processed = new Set(beforeCatalog.map((a) => normalizeText(a.title)));
    const scanLimit = Math.max(targetCount * CANDIDATE_SCAN_FACTOR, targetCount + 8);
    const uniqueTitles = [];
    for (const candidate of candidates) {
      const title = String(candidate?.title || "").trim();
      if (!title) continue;
      const normTitle = normalizeText(title);
      if (processed.has(normTitle)) continue;
      processed.add(normTitle);
      uniqueTitles.push(title);
      if (uniqueTitles.length >= scanLimit) break;
    }

    const processedCandidates = await mapWithConcurrency(
      uniqueTitles,
      CANDIDATE_CONCURRENCY,
      (title) => processCandidateTitle(title)
    );

    let workingCatalog = [...beforeCatalog];
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const addedTitles = [];
    const skippedTitles = [];

    for (const result of processedCandidates) {
      if (added >= targetCount) break;
      if (!result || result.skipped || !result.anime) {
        skipped += 1;
        if (result?.title) skippedTitles.push(result.title);
        continue;
      }

      const merged = mergeAnime(workingCatalog, result.anime);
      workingCatalog = merged.next;
      if (merged.added) {
        added += 1;
        addedTitles.push(result.anime.title);
      } else if (merged.updated) {
        updated += 1;
      } else {
        skipped += 1;
        skippedTitles.push(result.title || result.anime.title);
      }
    }

    if (added === 0 && updated === 0) {
      return res.status(200).json({
        message: "No se agregaron nuevos hentai validos",
        added,
        updated,
        skipped,
        addedTitles,
        skippedTitles: skippedTitles.slice(0, 20),
      });
    }

    const snapshot = createSnapshot(beforeCatalog, "before-auto-import-20");
    const saved = writeCatalog(workingCatalog);
    appendAudit({
      action: "catalog.auto-import",
      detail: `Auto import: +${added} nuevos, ${updated} actualizados, ${skipped} omitidos`,
      snapshot: snapshot.fileName,
    });

    return res.status(200).json({
      message: `Auto import completado: +${added} nuevos, ${updated} actualizados`,
      added,
      updated,
      skipped,
      total: saved.length,
      addedTitles,
      skippedTitles: skippedTitles.slice(0, 20),
    });
  } catch {
    return res.status(500).json({ message: "Error en auto import de hentai" });
  }
}
