const VER_HENTAI_BASE = "https://www4.ver-hentai.online";
const ESHENTAI_BASE = "https://eshentai.tv";
const JIKAN_API = "https://api.jikan.moe/v4/anime";

const MIN_CONFIDENCE = 0.62;
const MIN_STRICT_CONFIDENCE = 0.72;
const GENERIC_GENRES = new Set([
  "hentai",
  "anime hentai",
  "anime xxx",
  "hentai online",
  "online",
  "sin censura",
  "estrenos hentai",
  "audio latino",
  "latino",
  "anime",
]);

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(text) {
  if (!text) return "";
  const named = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&nbsp;": " ",
    "&aacute;": "a",
    "&eacute;": "e",
    "&iacute;": "i",
    "&oacute;": "o",
    "&uacute;": "u",
    "&Aacute;": "A",
    "&Eacute;": "E",
    "&Iacute;": "I",
    "&Oacute;": "O",
    "&Uacute;": "U",
    "&ntilde;": "n",
    "&Ntilde;": "N",
  };

  let out = String(text);
  Object.entries(named).forEach(([k, v]) => {
    out = out.split(k).join(v);
  });

  out = out.replace(/&#(\d+);/g, (_, code) => {
    const n = Number(code);
    return Number.isFinite(n) ? String.fromCharCode(n) : "";
  });

  return out;
}

function stripHtml(value) {
  return decodeEntities(String(value || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function toSlug(text) {
  return normalizeText(text).replace(/\s+/g, "-");
}

function normalizeGenreValue(genre) {
  if (Array.isArray(genre)) return genre.map((g) => String(g).trim()).filter(Boolean);
  if (typeof genre === "string") {
    return genre
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);
  }
  return [];
}

function cleanGenres(rawGenre) {
  return [
    ...new Set(
      normalizeGenreValue(rawGenre)
        .map((g) => normalizeText(g))
        .filter(Boolean)
        .filter((g) => !GENERIC_GENRES.has(g))
    ),
  ];
}

function scoreTitleMatch(targetTitle, candidateTitle) {
  const target = normalizeText(targetTitle);
  const candidate = normalizeText(candidateTitle);
  if (!target || !candidate) return 0;
  if (target === candidate) return 1;
  if (candidate.includes(target) || target.includes(candidate)) return 0.9;

  const targetTokens = target.split(" ").filter(Boolean);
  const candidateTokens = new Set(candidate.split(" ").filter(Boolean));
  if (targetTokens.length === 0) return 0;

  let common = 0;
  for (const token of targetTokens) {
    if (candidateTokens.has(token)) common += 1;
  }

  return common / targetTokens.length;
}

function safeYear(raw) {
  const now = new Date().getFullYear();
  const y = Number(raw);
  if (!Number.isFinite(y)) return "";
  if (y < 1980 || y > now + 1) return "";
  return y;
}

function sanitizeMetadata(meta) {
  if (!meta) return null;
  return {
    title: String(meta.title || "").trim(),
    description: String(meta.description || "").trim(),
    year: safeYear(meta.year),
    genre: cleanGenres(meta.genre),
    cover: String(meta.cover || "").trim(),
    episodes: Array.isArray(meta.episodes) ? meta.episodes : [],
  };
}

function toAbsoluteUrl(url, base) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) return `${base}${value}`;
  return `${base}/${value}`;
}

function extractEpisodeSlugFromUrl(url) {
  const m = String(url || "").match(/\/([^/]+)\.html(?:\?|#|$)/i);
  return m?.[1] || "";
}

function cleanEpisodeTitle(raw) {
  return decodeEntities(String(raw || ""))
    .replace(/\s*(sub.*espa[nñ]ol|videos?\s*hentai.*|eshentai.*)$/i, "")
    .replace(/\s*[-|].*$/g, "")
    .trim();
}

function extractVideoUrlsFromEpisodeHtml(html) {
  const raw = String(html || "");
  const iframeUrls = [...raw.matchAll(/<iframe[^>]+src="([^"]+)"/gi)].map((m) => toAbsoluteUrl(m[1], "https:"));
  const directUrls = [...raw.matchAll(/https?:\/\/[^"'\s<>]+/gi)]
    .map((m) => m[0])
    .filter((u) => /stream|dood|wish|voe|sendvid|mp4upload|filemoon|mixdrop|m3u8|\.mp4/i.test(u));

  return [...new Set([...iframeUrls, ...directUrls])].filter(Boolean);
}

async function parseVerEpisodePage(episodeUrl, fallbackIndex) {
  try {
    const html = await fetchHtml(episodeUrl);
    const pageTitle = html.match(/<title>(.*?)<\/title>/i)?.[1] || "";
    const title = cleanEpisodeTitle(pageTitle) || `Episodio ${fallbackIndex}`;
    const slug = extractEpisodeSlugFromUrl(episodeUrl) || `ep-${fallbackIndex}`;
    const urls = extractVideoUrlsFromEpisodeHtml(html);
    if (urls.length === 0) return null;

    const sources = urls.map((u, idx) => ({
      label: `Servidor ${idx + 1}`,
      url: u,
    }));

    return {
      id: `ep${fallbackIndex}`,
      title,
      slug,
      sourceUrl: urls[0],
      sources,
    };
  } catch {
    return null;
  }
}

function extractVerEpisodeLinksFromInfoHtml(html) {
  const raw = String(html || "");
  const absolute = [...raw.matchAll(/https:\/\/www4\.ver-hentai\.online\/hentaionline\/[^"\s<]+\.html/gi)].map((m) => m[0]);
  const relative = [...raw.matchAll(/\/hentaionline\/[^"\s<]+\.html/gi)].map((m) => `${VER_HENTAI_BASE}${m[0]}`);
  return [...new Set([...absolute, ...relative])];
}

function extractVerInfoLinksFromSearchHtml(html) {
  const raw = String(html || "");
  const absolute = [...raw.matchAll(/https:\/\/www4\.ver-hentai\.online\/infohentai\/[^"\s<]+\.html/gi)].map((m) => m[0]);
  const relative = [...raw.matchAll(/\/infohentai\/[^"\s<]+\.html/gi)].map((m) => `${VER_HENTAI_BASE}${m[0]}`);
  return [...new Set([...absolute, ...relative])];
}

function isLikelyVideoUrl(url) {
  return /stream|dood|wish|voe|sendvid|mp4upload|filemoon|mixdrop|m3u8|\.mp4|hvidserv|yourupload|mega\.nz\/embed|hqq\./i.test(
    String(url || "")
  );
}

function isAdOrBadUrl(url) {
  return /adtng|doubleclick|googlesyndication|analytics|facebook|twitter|x\.com/i.test(
    String(url || "")
  );
}

function extractHentailaMediaLinksFromSearchHtml(html) {
  const raw = String(html || "");
  const relative = [...raw.matchAll(/href="(\/media\/[a-z0-9-]+)"/gi)].map((m) => `${ESHENTAI_BASE}${m[1]}`);
  return [...new Set(relative)];
}

function extractHentailaEpisodeLinksFromMediaHtml(html, mediaSlug) {
  const raw = String(html || "");
  const pattern = new RegExp(`href="(/media/${mediaSlug}/\\\\d+)"`, "gi");
  const relative = [...raw.matchAll(pattern)].map((m) => `${ESHENTAI_BASE}${m[1]}`);
  return [...new Set(relative)];
}

async function parseHentailaEpisodePage(episodeUrl, fallbackIndex) {
  try {
    const html = await fetchHtml(episodeUrl);
    const pageTitleRaw = html.match(/<title>(.*?)<\/title>/i)?.[1] || "";
    const pageTitle = cleanEpisodeTitle(pageTitleRaw) || `Episodio ${fallbackIndex}`;
    const slug = extractEpisodeSlugFromUrl(episodeUrl) || `ep-${fallbackIndex}`;

    const iframeUrls = [...html.matchAll(/<iframe[^>]+src="([^"]+)"/gi)]
      .map((m) => toAbsoluteUrl(m[1], "https:"))
      .filter(Boolean);
    const embedsUrls = [...html.matchAll(/url:"(https?:\/\/[^"]+)"/gi)]
      .map((m) => m[1])
      .filter(Boolean);

    const allUrls = [...new Set([...iframeUrls, ...embedsUrls])]
      .filter((u) => isLikelyVideoUrl(u))
      .filter((u) => !isAdOrBadUrl(u));

    if (allUrls.length === 0) return null;

    return {
      id: `ep${fallbackIndex}`,
      title: pageTitle,
      slug,
      sourceUrl: allUrls[0],
      sources: allUrls.map((u, i) => ({ label: `Servidor ${i + 1}`, url: u })),
    };
  } catch {
    return null;
  }
}

async function fetchEpisodesFromHentailaByTitle(title) {
  const queries = buildQueries(title);
  const searchUrls = queries.map((q) => `${ESHENTAI_BASE}/catalogo?search=${encodeURIComponent(q)}`);

  const mediaCandidates = [];
  for (const searchUrl of [...new Set(searchUrls)]) {
    try {
      const html = await fetchHtml(searchUrl);
      const links = extractHentailaMediaLinksFromSearchHtml(html);
      for (const link of links) {
        const slug = link.match(/\/media\/([a-z0-9-]+)$/i)?.[1] || "";
        const confidence = scoreTitleMatch(title, slug.replace(/-/g, " "));
        if (confidence >= 0.3) mediaCandidates.push({ link, confidence });
      }
    } catch {
      // continue
    }
  }

  const uniqueMedia = [...new Map(
    mediaCandidates
      .sort((a, b) => b.confidence - a.confidence)
      .map((x) => [x.link, x])
  ).values()].slice(0, 4);

  const episodeLinks = [];
  for (const media of uniqueMedia) {
    try {
      const mediaHtml = await fetchHtml(media.link);
      const mediaSlug = media.link.match(/\/media\/([a-z0-9-]+)$/i)?.[1] || "";
      if (!mediaSlug) continue;
      episodeLinks.push(...extractHentailaEpisodeLinksFromMediaHtml(mediaHtml, mediaSlug));
    } catch {
      // continue
    }
  }

  const uniqueEpisodes = [...new Set(episodeLinks)].slice(0, 60);
  const parsed = [];
  for (let i = 0; i < uniqueEpisodes.length; i += 1) {
    const ep = await parseHentailaEpisodePage(uniqueEpisodes[i], i + 1);
    if (ep) parsed.push(ep);
  }

  return parsed;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function buildQueries(title) {
  const raw = String(title || "").trim();
  const normalized = normalizeText(raw);
  const slug = toSlug(raw);
  const compact = normalized.replace(/\s+/g, "");
  const baseCut = raw.split(/[-:|]/)[0]?.trim() || raw;
  const baseNorm = normalizeText(baseCut);
  const short2 = baseNorm.split(" ").filter(Boolean).slice(0, 2).join(" ");

  return [...new Set([raw, normalized, slug, compact, baseCut, baseNorm, short2].filter(Boolean))];
}

function chooseBestByTitle(inputTitle, candidates) {
  const scored = (candidates || [])
    .map((item) => ({ ...item, confidence: scoreTitleMatch(inputTitle, item.title || "") }))
    .sort((a, b) => b.confidence - a.confidence);
  return scored[0] || null;
}

async function fetchFromVerHentaiByTitle(title) {
  const queries = buildQueries(title);
  const urls = [];
  for (const q of queries) {
    urls.push(`${VER_HENTAI_BASE}/buscar/${encodeURIComponent(q)}`);
    urls.push(`${VER_HENTAI_BASE}/hentai.php?m=buscar&t=${encodeURIComponent(q)}`);
  }

  let best = null;

  for (const url of urls) {
    try {
      const html = await fetchHtml(url);
      const links = [
        ...new Set([
          ...[...html.matchAll(/https:\/\/www4\.ver-hentai\.online\/infohentai\/[^"\s<]+\.html/gi)].map((m) => m[0]),
          ...[...html.matchAll(/\/infohentai\/[^"\s<]+\.html/gi)].map((m) => `${VER_HENTAI_BASE}${m[0]}`),
        ]),
      ];

      if (links.length === 0) continue;

      const candidates = links.map((link) => {
        const m = link.match(/\/infohentai\/([^/]+)\.html/i);
        return { link, title: m?.[1]?.replace(/-/g, " ") || "" };
      });

      const pick = chooseBestByTitle(title, candidates);
      if (!pick || pick.confidence < 0.35) continue;

      const detail = await fetchHtml(pick.link);
      const h1Title = detail.match(/<h1>\s*Hentai:\s*([^<]+)<\/h1>/i)?.[1]?.trim() || "";
      const cover =
        detail.match(/<div class="poster">[\s\S]*?data-src="([^"]+)"/i)?.[1] ||
        detail.match(/<div class="poster">[\s\S]*?src="([^"]+)"/i)?.[1] ||
        "";
      const genresRaw = detail.match(/<div class="sgeneros">([\s\S]*?)<\/div>/i)?.[1] || "";
      const descriptionRaw =
        detail.match(/<div id="info"[\s\S]*?<div class="wp-content">([\s\S]*?)<\/div>/i)?.[1] || "";
      const dateText =
        detail.match(/<span class="rating-yours">\s*([0-9]{4}-[0-9]{2}-[0-9]{2})\s*<\/span>/i)?.[1] || "";

      const metadata = sanitizeMetadata({
        title: decodeEntities(h1Title).replace(/^Hentai:\s*/i, "").trim() || pick.title,
        description: stripHtml(descriptionRaw),
        year: dateText ? Number(dateText.slice(0, 4)) : "",
        genre: stripHtml(genresRaw),
        cover,
      });

      const episodeLinks = extractVerEpisodeLinksFromInfoHtml(detail).slice(0, 40);
      if (episodeLinks.length > 0) {
        const parsed = [];
        for (let i = 0; i < episodeLinks.length; i += 1) {
          const ep = await parseVerEpisodePage(episodeLinks[i], i + 1);
          if (ep) parsed.push(ep);
        }
        metadata.episodes = parsed;
      }

      const confidence = Math.max(
        pick.confidence,
        scoreTitleMatch(title, metadata?.title || "")
      );

      if (!best || confidence > best.confidence) {
        best = { source: "ver-hentai", confidence, metadata };
      }
    } catch {
      // continue
    }
  }

  return best;
}

export async function fetchEpisodesDeepByTitle(title) {
  const queries = buildQueries(title);
  const searchUrls = [];
  for (const q of queries) {
    searchUrls.push(`${VER_HENTAI_BASE}/buscar/${encodeURIComponent(q)}`);
    searchUrls.push(`${VER_HENTAI_BASE}/hentai.php?m=buscar&t=${encodeURIComponent(q)}`);
  }

  const infoCandidates = [];
  for (const searchUrl of [...new Set(searchUrls)]) {
    try {
      const html = await fetchHtml(searchUrl);
      const links = extractVerInfoLinksFromSearchHtml(html);
      for (const link of links) {
        const nameFromLink = link.match(/\/infohentai\/([^/]+)\.html/i)?.[1]?.replace(/-/g, " ") || "";
        const confidence = scoreTitleMatch(title, nameFromLink);
        if (confidence >= 0.3) {
          infoCandidates.push({ link, confidence });
        }
      }
    } catch {
      // continue
    }
  }

  const uniqueInfo = [...new Map(
    infoCandidates
      .sort((a, b) => b.confidence - a.confidence)
      .map((x) => [x.link, x])
  ).values()].slice(0, 6);

  const episodeLinks = [];
  for (const info of uniqueInfo) {
    try {
      const detail = await fetchHtml(info.link);
      episodeLinks.push(...extractVerEpisodeLinksFromInfoHtml(detail));
    } catch {
      // continue
    }
  }

  const uniqueEpisodes = [...new Set(episodeLinks)].slice(0, 60);
  const parsed = [];
  for (let i = 0; i < uniqueEpisodes.length; i += 1) {
    const ep = await parseVerEpisodePage(uniqueEpisodes[i], i + 1);
    if (ep) parsed.push(ep);
  }

  const hentailaEpisodes = await fetchEpisodesFromHentailaByTitle(title);
  const combined = [...parsed, ...(Array.isArray(hentailaEpisodes) ? hentailaEpisodes : [])];

  const dedup = [];
  for (const ep of combined) {
    const exists = dedup.find((d) => {
      if (ep.slug && d.slug && ep.slug === d.slug) return true;
      if (ep.sourceUrl && d.sourceUrl && ep.sourceUrl === d.sourceUrl) return true;
      return false;
    });
    if (!exists) dedup.push(ep);
  }

  return dedup;
}

async function fetchFromEsHentaiByTitle(title) {
  const queries = buildQueries(title);
  const urls = queries.map((q) => `${ESHENTAI_BASE}/buscar?q=${encodeURIComponent(q)}`);
  let best = null;

  for (const url of urls) {
    try {
      const html = await fetchHtml(url);
      const links = [
        ...new Set(
          [...html.matchAll(/href="(\/hentai-[^"\s]+\.html|\/[0-9]+\.html)"/gi)].map(
            (m) => `${ESHENTAI_BASE}${m[1]}`
          )
        ),
      ];

      if (links.length === 0) continue;

      const candidates = links.map((link) => {
        let t = "";
        const m = link.match(/\/hentai-([^/]+)\.html/i);
        if (m?.[1]) t = m[1].replace(/-/g, " ");
        return { link, title: t };
      });

      const pick = chooseBestByTitle(title, candidates);
      if (!pick || pick.confidence < 0.35) continue;

      const detail = await fetchHtml(pick.link);
      const pageTitle = detail.match(/<title>(.*?)<\/title>/i)?.[1] || "";
      const cleanTitle = pageTitle.replace(/\s*[-|].*$/g, "").replace(/sub espanol online/gi, "").trim();
      const desc = detail.match(/name="description"\s+content="([^"]+)"/i)?.[1] || "";
      const cover = detail.match(/property="og:image"\s+content="([^"]+)"/i)?.[1] || "";
      const tagsBlock = detail.match(/<p class="tags">([\s\S]*?)<\/p>/i)?.[1] || "";
      const tagGenres = [...tagsBlock.matchAll(/\/genero\/([a-z0-9-]+)/gi)].map((m) => m[1].replace(/-/g, " "));

      const y1 = detail.match(/\b(19|20)\d{2}\b/g) || [];
      const yearCandidate = y1.map(Number).find((y) => y >= 1980 && y <= new Date().getFullYear() + 1) || "";

      const metadata = sanitizeMetadata({
        title: decodeEntities(cleanTitle || pick.title),
        description: decodeEntities(desc),
        year: yearCandidate,
        genre: tagGenres,
        cover,
      });

      metadata.episodes = [];

      const confidence = Math.max(
        pick.confidence,
        scoreTitleMatch(title, metadata?.title || "")
      );

      if (!best || confidence > best.confidence) {
        best = { source: "eshentai", confidence, metadata };
      }
    } catch {
      // continue
    }
  }

  return best;
}

async function fetchFromJikanByTitle(title) {
  const res = await fetch(`${JIKAN_API}?q=${encodeURIComponent(title)}&limit=8`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;

  const json = await res.json();
  const data = Array.isArray(json?.data) ? json.data : [];

  const candidates = data.map((item) => {
    const candidateTitle = item?.title || item?.title_english || item?.title_japanese || "";
    const confidence = Math.max(
      scoreTitleMatch(title, candidateTitle),
      scoreTitleMatch(title, item?.title_english || ""),
      scoreTitleMatch(title, item?.title_japanese || "")
    );

    const metadata = sanitizeMetadata({
      title: candidateTitle,
      description: item?.synopsis || "",
      year: item?.year || item?.aired?.prop?.from?.year || "",
      genre: (item?.genres || []).map((g) => g?.name).filter(Boolean),
      cover: item?.images?.jpg?.large_image_url || item?.images?.jpg?.image_url || "",
    });

    metadata.episodes = [];

    return { source: "jikan", confidence, metadata };
  });

  const best = candidates.sort((a, b) => b.confidence - a.confidence)[0];
  return best || null;
}

async function fetchBestMetadataByTitle(title) {
  const [esh, ver, jikan] = await Promise.all([
    fetchFromEsHentaiByTitle(title),
    fetchFromVerHentaiByTitle(title),
    fetchFromJikanByTitle(title),
  ]);

  const candidates = [esh, ver, jikan].filter(Boolean).filter((x) => x?.metadata);
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0];
  const accepted = best.confidence >= MIN_CONFIDENCE;

  const strict = best.confidence >= MIN_STRICT_CONFIDENCE;
  const out = {
    ...best.metadata,
    genre: cleanGenres(best.metadata.genre),
    description: best.metadata.description || "",
    year: best.metadata.year || "",
    episodes: Array.isArray(best.metadata.episodes) ? best.metadata.episodes : [],
  };

  if (!strict) {
    // In confidence gray-zone, avoid polluting with weak fields.
    if ((out.genre || []).length < 2) out.genre = [];
    if (String(out.description || "").length < 60) out.description = "";
  }

  return {
    metadata: out,
    source: best.source,
    confidence: Number(best.confidence.toFixed(3)),
    accepted,
  };
}

export async function fetchVerHentaiMetadataByTitle(title) {
  if (!title || !String(title).trim()) return null;
  try {
    const result = await fetchBestMetadataByTitle(String(title).trim());
    if (!result?.accepted) return null;
    return result.metadata;
  } catch {
    return null;
  }
}

export async function fetchMetadataDebugByTitle(title) {
  if (!title || !String(title).trim()) return null;
  try {
    return await fetchBestMetadataByTitle(String(title).trim());
  } catch {
    return null;
  }
}

function needsEnrichment(anime) {
  const noDescription = !anime?.description && !anime?.synopsis;
  const noCover = !anime?.cover;
  const noYear = !anime?.year;
  const noGenre = cleanGenres(anime?.genre).length === 0;
  return noDescription || noCover || noYear || noGenre;
}

function mergeUniqueEpisodes(targetEpisodes, sourceEpisodes) {
  const list = Array.isArray(targetEpisodes) ? [...targetEpisodes] : [];
  const incoming = Array.isArray(sourceEpisodes) ? sourceEpisodes : [];

  for (const episode of incoming) {
    const exists = list.find((ep) => {
      if (episode.slug && ep.slug && ep.slug === episode.slug) return true;
      if (episode.sourceUrl && ep.sourceUrl && ep.sourceUrl === episode.sourceUrl) return true;
      return false;
    });
    if (!exists) list.push(episode);
  }

  return list.sort((a, b) => getEpisodeNumber(a) - getEpisodeNumber(b));
}

function mergeAnimeData(base, incoming) {
  const merged = { ...base };

  merged.title = merged.title || incoming.title || "";
  merged.year = merged.year || incoming.year || "";
  merged.cover = merged.cover || incoming.cover || "";
  merged.description =
    merged.description || merged.synopsis || incoming.description || incoming.synopsis || "";

  const baseGenres = cleanGenres(merged.genre);
  const incomingGenres = cleanGenres(incoming.genre);
  merged.genre = baseGenres.length > 0 ? baseGenres : incomingGenres;

  merged.episodes = mergeUniqueEpisodes(merged.episodes, incoming.episodes);
  if (!merged.id) merged.id = incoming.id || toSlug(merged.title);

  return merged;
}

function consolidateCatalog(rawAnimes) {
  const map = new Map();
  const list = Array.isArray(rawAnimes) ? rawAnimes : [];

  for (const anime of list) {
    const rawTitle = anime?.title || anime?.id || "anime";
    const key = normalizeText(rawTitle).replace(/\b(?:temporada|season|s)\s*0*\d+\b/gi, "");
    const current = map.get(key);

    if (!current) map.set(key, mergeAnimeData({ ...anime, episodes: anime?.episodes || [] }, anime));
    else map.set(key, mergeAnimeData(current, anime));
  }

  return Array.from(map.values());
}

async function enrichAnimeIfNeeded(anime) {
  if (!anime?.title || !needsEnrichment(anime)) return { anime, enriched: false };

  const metadata = await fetchBestMetadataByTitle(anime.title);
  if (!metadata) return { anime, enriched: false };

  return {
    anime: {
      ...anime,
      year: anime.year || metadata.year || "",
      cover: anime.cover || metadata.cover || "",
      description: anime.description || anime.synopsis || metadata.description || "",
      genre: cleanGenres(anime.genre).length > 0 ? cleanGenres(anime.genre) : metadata.genre,
      episodes:
        Array.isArray(anime.episodes) && anime.episodes.length > 0
          ? anime.episodes
          : Array.isArray(metadata.episodes)
          ? metadata.episodes
          : [],
    },
    enriched: true,
  };
}

export async function enrichCatalog(rawAnimes) {
  const consolidated = consolidateCatalog(rawAnimes);
  let enrichedCount = 0;

  const finalAnimes = [];
  for (const anime of consolidated) {
    const result = await enrichAnimeIfNeeded(anime);
    if (result.enriched) enrichedCount += 1;

    finalAnimes.push({
      ...result.anime,
      id: result.anime.id || toSlug(result.anime.title || "anime"),
      genre: cleanGenres(result.anime.genre),
      description: result.anime.description || result.anime.synopsis || "",
      episodes: mergeUniqueEpisodes([], result.anime.episodes || []),
    });
  }

  return {
    animes: finalAnimes,
    enrichedCount,
    consolidatedCount: Math.max((Array.isArray(rawAnimes) ? rawAnimes.length : 0) - finalAnimes.length, 0),
  };
}
