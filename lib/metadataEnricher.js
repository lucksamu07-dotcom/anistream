const VER_HENTAI_BASE = "https://www.ver-hentai.online";
const VER_HENTAI_BASES = [VER_HENTAI_BASE];
const HENTAILA_BASE = "https://hentaila.com";
const HENTAILA_HUB = `${HENTAILA_BASE}/hub`;
const VEOHENTAI_BASE = "https://veohentai.com";
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

function normalizeDiscoveryTitle(text) {
  return normalizeText(text)
    .replace(/\b(?:temporada|season|s)\s*0*\d+\b/g, " ")
    .replace(/\b(?:ova|oav|special|uncensored|sin censura)\b/g, " ")
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
  const target = normalizeDiscoveryTitle(targetTitle);
  const candidate = normalizeDiscoveryTitle(candidateTitle);
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

function detectLanguage(text) {
  const value = normalizeText(text);
  if (!value) return "original";
  if (/(latino|espanol latino|audio latino|castellano|espanol|español)/i.test(value)) return "latino";
  if (/(english|ingles|inglés|dub en)/i.test(value)) return "ingles";
  if (/(sub|subtitulado|sub espanol|sub español|japones|japones|vose)/i.test(value)) return "sub";
  return "original";
}

function languageLabel(lang) {
  if (lang === "latino") return "Latino";
  if (lang === "ingles") return "Ingles";
  if (lang === "sub") return "Sub";
  return "Original";
}

function buildSourcesWithLanguage(urls, contextText = "") {
  return urls.map((u, idx) => {
    const lang = detectLanguage(`${contextText} ${u}`);
    return {
      label: `Servidor ${idx + 1} (${languageLabel(lang)})`,
      url: u,
      language: lang,
    };
  });
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

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getVerHostPattern(base) {
  return escapeRegex(String(base || "").replace(/^https?:\/\//, ""));
}

function isCloudflareBlockedHtml(html) {
  const raw = String(html || "");
  return /just a moment|enable javascript and cookies to continue|__cf_chl_opt/i.test(raw);
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

function getEpisodeNumber(episode) {
  const text = `${episode?.title || ""} ${episode?.slug || ""} ${episode?.id || ""}`.toLowerCase();
  const strong =
    text.match(/(?:episodio|episode|ep|capitulo|cap)\s*[-#:.\s]*0*(\d{1,4})\b/i)?.[1] ||
    text.match(/(?:^|[^a-z])e\s*0*(\d{1,4})(?:[^a-z]|$)/i)?.[1];
  if (strong) return Number(strong);

  const allNumbers = [...text.matchAll(/\b(\d{1,4})\b/g)].map((m) => Number(m[1]));
  if (allNumbers.length === 0) return Number.POSITIVE_INFINITY;

  const last = allNumbers[allNumbers.length - 1];
  if (last >= 1900 && last <= 2100) return Number.POSITIVE_INFINITY;
  return last;
}

function compareEpisodes(a, b) {
  const na = getEpisodeNumber(a);
  const nb = getEpisodeNumber(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  if (Number.isFinite(na) && !Number.isFinite(nb)) return -1;
  if (!Number.isFinite(na) && Number.isFinite(nb)) return 1;
  return String(a?.title || a?.slug || a?.id || "").localeCompare(
    String(b?.title || b?.slug || b?.id || ""),
    "es",
    { numeric: true, sensitivity: "base" }
  );
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
    const resolved = await resolveVideoCandidates(extractVideoUrlsFromEpisodeHtml(html));
    const filtered = resolved.filter((u) => isLikelyVideoUrl(u));
    const urls = await selectWorkingVideoUrls(filtered, 8);
    if (urls.length === 0) return null;

    const sources = buildSourcesWithLanguage(urls, `${title} ${episodeUrl}`);
    const language = detectLanguage(`${title} ${episodeUrl}`);

    return {
      id: `ep${fallbackIndex}`,
      title,
      slug,
      sourceUrl: urls[0],
      language,
      sources,
    };
  } catch {
    return null;
  }
}

function extractVerEpisodeLinksFromInfoHtml(html, base) {
  const raw = String(html || "");
  const host = getVerHostPattern(base);
  const absolute = [
    ...raw.matchAll(new RegExp(`https?:\\/\\/${host}\\/hentaionline\\/[^"\\s<]+\\.html`, "gi")),
  ].map((m) => m[0]);
  const relative = [...raw.matchAll(/\/hentaionline\/[^"\s<]+\.html/gi)].map((m) => `${base}${m[0]}`);
  return [...new Set([...absolute, ...relative])];
}

function extractVerInfoLinksFromSearchHtml(html, base) {
  const raw = String(html || "");
  const host = getVerHostPattern(base);
  const absolute = [
    ...raw.matchAll(new RegExp(`https?:\\/\\/${host}\\/infohentai\\/[^"\\s<]+\\.html`, "gi")),
  ].map((m) => m[0]);
  const relative = [...raw.matchAll(/\/infohentai\/[^"\s<]+\.html/gi)].map((m) => `${base}${m[0]}`);
  return [...new Set([...absolute, ...relative])];
}

function extractEsHentaiDetailLinksFromHtml(html) {
  const raw = String(html || "");
  const direct = [...raw.matchAll(/https:\/\/eshentai\.tv\/(?:hentai-[^"\s<]+|[0-9]+)\.html/gi)].map((m) => m[0]);
  const relative = [...raw.matchAll(/href="(\/(?:hentai-[^"\s<]+|[0-9]+)\.html)"/gi)].map(
    (m) => `${HENTAILA_BASE}${m[1]}`
  );
  return [...new Set([...direct, ...relative])];
}

function titleFromVerInfoLink(link) {
  return decodeEntities(
    String(link || "")
      .match(/\/infohentai\/([^/]+)\.html/i)?.[1]
      ?.replace(/-/g, " ") || ""
  ).trim();
}

function titleFromEsDetailLink(link) {
  const bySlug = String(link || "")
    .match(/\/hentai-([^/]+)\.html/i)?.[1]
    ?.replace(/-/g, " ");
  return decodeEntities(String(bySlug || "")).trim();
}

function cleanEpisodeSuffix(text) {
  return decodeEntities(String(text || ""))
    .replace(/^ver\s+/i, "")
    .replace(/\s*[-|]\s*ver hentai.*$/i, "")
    .replace(/\s*episodio\s*\d+.*$/i, "")
    .replace(/\s*episode\s*\d+.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractVeoSearchEntries(html) {
  const raw = String(html || "");
  const direct = [...raw.matchAll(/<a[^>]+href="(https:\/\/veohentai\.com\/ver\/[^"]+\/?)"[^>]*>[\s\S]*?<h2[^>]*>([^<]+)<\/h2>/gi)]
    .map((m) => ({ link: m[1], title: stripHtml(m[2]) }));

  // fallback when html structure changes
  const linksOnly = [...raw.matchAll(/https:\/\/veohentai\.com\/ver\/[a-z0-9-]+\/?/gi)].map((m) => m[0]);
  const merged = [...direct];
  for (const link of linksOnly) {
    if (!merged.find((x) => x.link === link)) {
      merged.push({ link, title: cleanEpisodeSuffix(link.split("/ver/")[1]?.replace(/\/$/, "").replace(/-/g, " ")) });
    }
  }

  return merged.filter((x) => x.link && x.title);
}

async function parseVeoEpisodePage(episodeUrl, fallbackIndex) {
  try {
    const html = await fetchHtml(episodeUrl);
    const pageTitle = stripHtml(html.match(/<h1[^>]*>(.*?)<\/h1>/i)?.[1] || "");
    const episodeTitle = pageTitle || `Episodio ${fallbackIndex}`;
    const slug = extractEpisodeSlugFromUrl(episodeUrl) || `ep-${fallbackIndex}`;

    const iframeUrls = [...html.matchAll(/<iframe[^>]+src="([^"]+)"/gi)]
      .map((m) => toAbsoluteUrl(m[1], VEOHENTAI_BASE))
      .filter(Boolean);
    const directUrls = [...html.matchAll(/https?:\/\/[^"'\s<>]+/gi)]
      .map((m) => m[0])
      .filter((u) => isLikelyVideoUrl(u))
      .filter((u) => !isAdOrBadUrl(u));

    const resolved = await resolveVideoCandidates([...new Set([...iframeUrls, ...directUrls])]);
    const filtered = resolved.filter((u) => isLikelyVideoUrl(u));
    const urls = await selectWorkingVideoUrls(filtered, 8);

    if (urls.length === 0) return null;
    const language = detectLanguage(`${pageTitle} ${episodeUrl}`);

    return {
      id: `ep${fallbackIndex}`,
      title: episodeTitle,
      slug,
      sourceUrl: urls[0],
      language,
      sources: buildSourcesWithLanguage(urls, `${pageTitle} ${episodeUrl}`),
    };
  } catch {
    return null;
  }
}

async function fetchVeoEpisodesByTitle(title, maxEpisodes = 20) {
  const baseTitle = cleanEpisodeSuffix(title) || title;
  const queries = buildQueries(baseTitle).slice(0, 4);
  const candidateLinks = [];

  for (const q of queries) {
    const urls = [
      `${VEOHENTAI_BASE}/?s=${encodeURIComponent(q)}`,
      `${VEOHENTAI_BASE}/search/${encodeURIComponent(q)}/`,
    ];

    for (const url of urls) {
      try {
        const html = await fetchHtml(url);
        const entries = extractVeoSearchEntries(html);
        for (const entry of entries) {
          const confidence = scoreTitleMatch(baseTitle, cleanEpisodeSuffix(entry.title));
          if (confidence >= 0.4) candidateLinks.push({ ...entry, confidence });
        }
      } catch {
        // continue
      }
    }
  }

  const dedupLinks = [...new Map(
    candidateLinks
      .sort((a, b) => b.confidence - a.confidence)
      .map((x) => [x.link, x])
  ).values()].slice(0, maxEpisodes);

  const episodes = [];
  for (let i = 0; i < dedupLinks.length; i += 1) {
    const ep = await parseVeoEpisodePage(dedupLinks[i].link, i + 1);
    if (ep) episodes.push(ep);
  }

  return episodes;
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

function isBlockedEmbedHost(url) {
  const value = String(url || "").toLowerCase();
  return /hentaistream\./i.test(value);
}

function isWeakRootUrl(url) {
  const value = String(url || "").trim();
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.pathname === "/" || parsed.pathname === "";
  } catch {
    return false;
  }
}

function decodeBase64Loose(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  try {
    const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(normalized, "base64").toString("utf8");
  } catch {
    return "";
  }
}

async function resolveHentaiPlayerUrl(url) {
  const safe = String(url || "").trim();
  if (!/hentaiplayer\.com\/v\//i.test(safe)) return [safe];

  try {
    const html = await fetchHtml(safe);
    const dataId = html.match(/data-id="([^"]+)"/i)?.[1] || "";
    if (!dataId) return [safe];

    const qs = dataId.split("?")[1] || "";
    const params = new URLSearchParams(qs);
    const decodedVid = decodeBase64Loose(params.get("vid"));
    const decodedSub = decodeBase64Loose(params.get("s"));
    const videoUrl = decodedVid.split("|")[0] || "";
    const items = [videoUrl, decodedSub, safe].filter(Boolean);
    return [...new Set(items)];
  } catch {
    return [safe];
  }
}

async function resolveVideoCandidates(urls) {
  const out = [];
  for (const raw of urls) {
    const url = String(raw || "").trim();
    if (!url) continue;
    if (/hentaiplayer\.com\/v\//i.test(url)) {
      const resolved = await resolveHentaiPlayerUrl(url);
      out.push(...resolved);
    } else {
      out.push(url);
    }
  }
  return [...new Set(out)];
}

const URL_HEALTH_CACHE = new Map();
const BROKEN_PATTERNS = [
  /file not found/i,
  /video not found/i,
  /not found/i,
  /this video has been removed/i,
  /content unavailable/i,
  /404\s*not\s*found/i,
  /410\s*gone/i,
  /forbidden/i,
  /access denied/i,
  /dmca/i,
];

async function fetchWithTimeout(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function sourcePriority(url) {
  const value = String(url || "").toLowerCase();
  if (value.includes(".m3u8")) return 120;
  if (/\.(mp4|webm)(\?|$)/i.test(value)) return 115;
  if (/streamwish|do7go|sendvid|sharedvid|mp4upload|filemoon|mixdrop|voe|dood|streamtape/i.test(value)) return 100;
  if (/hentaiplayer/i.test(value)) return 60;
  return 20;
}

function looksBrokenText(text) {
  const raw = String(text || "");
  return BROKEN_PATTERNS.some((rx) => rx.test(raw));
}

async function isWorkingVideoUrl(url) {
  const safe = String(url || "").trim();
  if (!safe || isAdOrBadUrl(safe) || isWeakRootUrl(safe) || isBlockedEmbedHost(safe)) return false;

  const cached = URL_HEALTH_CACHE.get(safe);
  if (typeof cached === "boolean") return cached;

  try {
    if (safe.includes(".m3u8") || /\.(mp4|webm)(\?|$)/i.test(safe)) {
      const direct = await fetchWithTimeout(safe, { method: "GET", headers: { Range: "bytes=0-1024" } }, 9000);
      const ok = direct.ok || direct.status === 206;
      URL_HEALTH_CACHE.set(safe, ok);
      return ok;
    }

    const res = await fetchWithTimeout(safe, { method: "GET" }, 9000);
    if (!res.ok) {
      URL_HEALTH_CACHE.set(safe, false);
      return false;
    }

    const text = await res.text();
    const ok = !looksBrokenText(text);
    URL_HEALTH_CACHE.set(safe, ok);
    return ok;
  } catch {
    URL_HEALTH_CACHE.set(safe, false);
    return false;
  }
}

async function selectWorkingVideoUrls(urls, maxChecks = 8) {
  const candidates = [...new Set((Array.isArray(urls) ? urls : []).filter(Boolean))]
    .filter((u) => !isAdOrBadUrl(u))
    .filter((u) => !isWeakRootUrl(u))
    .filter((u) => !isBlockedEmbedHost(u))
    .sort((a, b) => sourcePriority(b) - sourcePriority(a));

  const checked = [];
  for (const candidate of candidates.slice(0, maxChecks)) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await isWorkingVideoUrl(candidate);
    if (ok) checked.push(candidate);
  }

  return checked;
}

function extractHentailaMediaLinksFromSearchHtml(html) {
  const raw = String(html || "");
  const relative = [...raw.matchAll(/href="(\/media\/[a-z0-9-]+)"/gi)].map((m) => `${HENTAILA_BASE}${m[1]}`);
  return [...new Set(relative)];
}

function extractHentailaEpisodeLinksFromMediaHtml(html, mediaSlug) {
  const raw = String(html || "");
  const pattern = new RegExp(`href="(/media/${mediaSlug}/\\\\d+)"`, "gi");
  const relative = [...raw.matchAll(pattern)].map((m) => `${HENTAILA_BASE}${m[1]}`);
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

    const resolved = await resolveVideoCandidates([...new Set([...iframeUrls, ...embedsUrls])]);
    const filtered = resolved.filter((u) => isLikelyVideoUrl(u));
    const allUrls = await selectWorkingVideoUrls(filtered, 8);

    if (allUrls.length === 0) return null;

    const language = detectLanguage(`${pageTitle} ${episodeUrl}`);

    return {
      id: `ep${fallbackIndex}`,
      title: pageTitle,
      slug,
      sourceUrl: allUrls[0],
      language,
      sources: buildSourcesWithLanguage(allUrls, `${pageTitle} ${episodeUrl}`),
    };
  } catch {
    return null;
  }
}

async function fetchEpisodesFromHentailaByTitle(title) {
  const queries = buildQueries(title);
  const searchUrls = [];
  for (const q of queries) {
    searchUrls.push(`${HENTAILA_HUB}?s=${encodeURIComponent(q)}`);
    searchUrls.push(`${HENTAILA_BASE}/?s=${encodeURIComponent(q)}`);
    searchUrls.push(`${HENTAILA_BASE}/search/${encodeURIComponent(q)}/`);
  }

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
  let best = null;
  for (const base of VER_HENTAI_BASES) {
    const queries = buildQueries(title);
    const urls = [];
    for (const q of queries) {
      urls.push(`${base}/buscar/${encodeURIComponent(q)}`);
      urls.push(`${base}/hentai.php?m=buscar&t=${encodeURIComponent(q)}`);
    }

    for (const url of urls) {
      try {
        const html = await fetchHtml(url);
        if (isCloudflareBlockedHtml(html)) continue;

        const links = extractVerInfoLinksFromSearchHtml(html, base);
        if (links.length === 0) continue;

        const candidates = links.map((link) => {
          const m = link.match(/\/infohentai\/([^/]+)\.html/i);
          return { link, title: m?.[1]?.replace(/-/g, " ") || "" };
        });

        const pick = chooseBestByTitle(title, candidates);
        if (!pick || pick.confidence < 0.35) continue;

        const detail = await fetchHtml(pick.link);
        if (isCloudflareBlockedHtml(detail)) continue;

        const h1Title = detail.match(/<h1>\s*Hentai:\s*([^<]+)<\/h1>/i)?.[1]?.trim() || "";
        const coverRaw =
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
          cover: toAbsoluteUrl(coverRaw, base),
        });

        const episodeLinks = extractVerEpisodeLinksFromInfoHtml(detail, base).slice(0, 40);
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
          best = { source: "ver-hentai.online", confidence, metadata };
        }
      } catch {
        // continue
      }
    }
  }

  return best;
}

export async function fetchEpisodesDeepByTitle(title) {
  const infoCandidates = [];
  for (const base of VER_HENTAI_BASES) {
    const queries = buildQueries(title);
    const searchUrls = [];
    for (const q of queries) {
      searchUrls.push(`${base}/buscar/${encodeURIComponent(q)}`);
      searchUrls.push(`${base}/hentai.php?m=buscar&t=${encodeURIComponent(q)}`);
    }

    for (const searchUrl of [...new Set(searchUrls)]) {
      try {
        const html = await fetchHtml(searchUrl);
        if (isCloudflareBlockedHtml(html)) continue;
        const links = extractVerInfoLinksFromSearchHtml(html, base);
        for (const link of links) {
          const nameFromLink = link.match(/\/infohentai\/([^/]+)\.html/i)?.[1]?.replace(/-/g, " ") || "";
          const confidence = scoreTitleMatch(title, nameFromLink);
          if (confidence >= 0.3) {
            infoCandidates.push({ link, confidence, base });
          }
        }
      } catch {
        // continue
      }
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
      if (isCloudflareBlockedHtml(detail)) continue;
      episodeLinks.push(...extractVerEpisodeLinksFromInfoHtml(detail, info.base || VER_HENTAI_BASE));
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
  const combined = [
    ...parsed,
    ...(Array.isArray(hentailaEpisodes) ? hentailaEpisodes : []),
  ];

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

async function discoverFromVerHentai(limit) {
  const found = [];

  for (const base of VER_HENTAI_BASES) {
    const seedUrls = [
      base,
      `${base}/`,
      `${base}/hentai.php?m=estrenos`,
      `${base}/hentai.php?m=estrenos&p=2`,
    ];

    for (const url of seedUrls) {
      try {
        const html = await fetchHtml(url);
        if (isCloudflareBlockedHtml(html)) continue;
        const links = extractVerInfoLinksFromSearchHtml(html, base).slice(0, 80);
        for (const link of links) {
          const title = titleFromVerInfoLink(link);
          if (!title) continue;
          found.push({ title, source: "ver-hentai.online", link });
        }
      } catch {
        // continue
      }
    }
  }

  const unique = new Map();
  for (const item of found) {
    const key = normalizeText(item.title);
    if (!key || unique.has(key)) continue;
    unique.set(key, item);
    if (unique.size >= limit * 4) break;
  }

  return Array.from(unique.values());
}

async function discoverFromEsHentai(limit) {
  const seedUrls = [HENTAILA_HUB, `${HENTAILA_BASE}/`, `${HENTAILA_BASE}/hub/page/2/`];
  const found = [];

  for (const url of seedUrls) {
    try {
      const html = await fetchHtml(url);
      const links = extractHentailaMediaLinksFromSearchHtml(html).slice(0, 80);
      for (const link of links) {
        const title = (link.match(/\/media\/([a-z0-9-]+)$/i)?.[1] || "").replace(/-/g, " ").trim();
        if (!title) continue;
        found.push({ title, source: "hentaila", link });
      }
    } catch {
      // continue
    }
  }

  const unique = new Map();
  for (const item of found) {
    const key = normalizeText(item.title);
    if (!key || unique.has(key)) continue;
    unique.set(key, item);
    if (unique.size >= limit * 3) break;
  }

  return Array.from(unique.values());
}

async function discoverFromVeoHentai(limit) {
  void limit;
  return [];
}

export async function discoverNewHentaiCandidates(existingTitles = [], limit = 30) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 30, 80));
  const existingList = (Array.isArray(existingTitles) ? existingTitles : [])
    .map((x) => normalizeDiscoveryTitle(x))
    .filter(Boolean);

  const [fromVer, fromHentaila] = await Promise.all([
    discoverFromVerHentai(safeLimit),
    discoverFromEsHentai(safeLimit),
  ]);

  const merged = [...fromVer, ...fromHentaila];
  const dedup = new Map();
  for (const item of merged) {
    const key = normalizeDiscoveryTitle(item.title);
    if (!key || dedup.has(key)) continue;

    const duplicatedWithExisting = existingList.some((existingTitle) => {
      if (existingTitle === key) return true;
      const score = scoreTitleMatch(existingTitle, key);
      return score >= 0.86;
    });
    if (duplicatedWithExisting) continue;

    dedup.set(key, item);
    if (dedup.size >= safeLimit) break;
  }

  return Array.from(dedup.values());
}

async function fetchFromVeoHentaiByTitle(title) {
  void title;
  return null;
}

async function fetchFromEsHentaiByTitle(title) {
  const queries = buildQueries(title);
  const urls = queries.map((q) => `${HENTAILA_BASE}/buscar?q=${encodeURIComponent(q)}`);
  let best = null;

  for (const url of urls) {
    try {
      const html = await fetchHtml(url);
      const links = [
        ...new Set(
          [...html.matchAll(/href="(\/hentai-[^"\s]+\.html|\/[0-9]+\.html)"/gi)].map(
            (m) => `${HENTAILA_BASE}${m[1]}`
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
        best = { source: "hentaila", confidence, metadata };
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
  const [ver, jikan] = await Promise.all([
    fetchFromVerHentaiByTitle(title),
    fetchFromJikanByTitle(title),
  ]);

  const candidates = [ver, jikan].filter(Boolean).filter((x) => x?.metadata);
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
      if (episode.title && ep.title && normalizeText(episode.title) === normalizeText(ep.title)) return true;
      if (episode.sourceUrl && ep.sourceUrl && ep.sourceUrl === episode.sourceUrl) return true;
      return false;
    });
    if (!exists) list.push(episode);
  }

  return list.sort(compareEpisodes);
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







