export const CANONICAL_GENRES = [
  "vanilla",
  "romance",
  "comedia",
  "drama",
  "fantasia",
  "historico",
  "escolar",
  "horror",
  "erotico",
  "isekai",
  "bdsm",
  "dominacion",
  "sumision",
  "femdom",
  "bondage",
  "shibari",
  "tentaculos",
  "monster girls",
  "futanari",
  "yuri",
  "yaoi",
  "ntr",
  "harem",
  "reverse harem",
  "ahegao",
  "hypnosis",
  "mind control",
  "mind break",
  "voyeurismo",
  "exhibicionismo",
  "humiliation",
  "corruption",
  "esclavitud",
  "gender bender",
  "body swap",
  "transformation",
  "omegaverse",
  "gangbang",
  "threesome",
  "crossdressing",
  "giantess",
  "inflation",
];

const GENRE_SYNONYMS = new Map([
  ["romantico", "romance"],
  ["romantica", "romance"],
  ["fantasia", "fantasia"],
  ["fantasy", "fantasia"],
  ["historico", "historico"],
  ["historia", "historico"],
  ["ecchi", "erotico"],
  ["horror erotico", "horror"],
  ["tentacles", "tentaculos"],
  ["tentaculo", "tentaculos"],
  ["femdom", "femdom"],
  ["domination", "dominacion"],
  ["submission", "sumision"],
  ["mind-control", "mind control"],
  ["mindbreak", "mind break"],
  ["gender-bender", "gender bender"],
]);

export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function toId(text) {
  return normalizeText(text).replace(/\s+/g, "-");
}

export function splitGenres(value) {
  if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function canonicalizeGenre(genre) {
  const normalized = normalizeText(genre);
  if (!normalized) return "";
  if (GENRE_SYNONYMS.has(normalized)) return GENRE_SYNONYMS.get(normalized);
  if (CANONICAL_GENRES.includes(normalized)) return normalized;
  return normalized;
}

export function normalizeGenres(genres) {
  const mapped = splitGenres(genres).map(canonicalizeGenre).filter(Boolean);
  return [...new Set(mapped)];
}

export function getEpisodeNumber(episode) {
  const text = `${episode?.title || ""} ${episode?.slug || ""} ${episode?.id || ""}`.toLowerCase();
  const strong =
    text.match(/(?:episodio|episode|ep|capitulo|cap)\s*[-#:.\s]*0*(\d{1,4})\b/i)?.[1] ||
    text.match(/(?:^|[^a-z])e\s*0*(\d{1,4})(?:[^a-z]|$)/i)?.[1];
  if (strong) return Number(strong);

  const numbers = [...text.matchAll(/\b(\d{1,4})\b/g)].map((m) => Number(m[1]));
  if (numbers.length === 0) return Number.POSITIVE_INFINITY;
  const last = numbers[numbers.length - 1];
  if (last >= 1900 && last <= 2100) return Number.POSITIVE_INFINITY;
  return last;
}

export function compareEpisodes(a, b) {
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

export function similarityScore(a, b) {
  const ta = new Set(normalizeText(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const token of ta) {
    if (tb.has(token)) common += 1;
  }
  return common / Math.max(ta.size, tb.size);
}

export function computeConfidence({ queryTitle, metadataTitle, year, genre, cover, episodes }) {
  const titleScore = similarityScore(queryTitle, metadataTitle);
  const yearScore = year ? 0.15 : 0;
  const genreScore = normalizeGenres(genre).length > 0 ? 0.15 : 0;
  const coverScore = String(cover || "").trim() ? 0.15 : 0;
  const eps = Array.isArray(episodes) ? episodes.length : 0;
  const episodeScore = eps > 0 ? Math.min(0.25, eps * 0.04) : 0;
  return Math.max(0, Math.min(1, titleScore * 0.3 + yearScore + genreScore + coverScore + episodeScore));
}

export function normalizeEpisode(ep, animeId, index) {
  const title = String(ep?.title || `Episodio ${index + 1}`).trim();
  const slug = String(ep?.slug || `${animeId}-ep${index + 1}`).trim();
  const sourceUrl = String(ep?.sourceUrl || "").trim();
  const sources = Array.isArray(ep?.sources)
    ? ep.sources
        .filter((s) => s && s.url)
        .map((s, i) => ({
          label: String(s.label || `Servidor ${i + 1}`),
          url: String(s.url).trim(),
          language: String(s.language || "original").trim(),
          status: String(s.status || "unknown").trim(),
        }))
    : sourceUrl
    ? [{ label: "Principal", url: sourceUrl, language: "original", status: "unknown" }]
    : [];

  return {
    id: String(ep?.id || `ep${index + 1}`),
    title,
    slug,
    sourceUrl,
    sources,
    updatedAt: ep?.updatedAt || new Date().toISOString(),
  };
}

export function mergeEpisodes(baseEpisodes, incomingEpisodes, animeId) {
  function mergeSourceLists(currentSources, incomingSources) {
    const base = Array.isArray(currentSources) ? [...currentSources] : [];
    const add = Array.isArray(incomingSources) ? incomingSources : [];

    for (const source of add) {
      const url = String(source?.url || "").trim();
      if (!url) continue;
      const language = String(source?.language || "original").trim().toLowerCase();

      const exists = base.find(
        (s) =>
          String(s?.url || "").trim() === url &&
          String(s?.language || "original").trim().toLowerCase() === language
      );

      if (!exists) {
        base.push({
          label: String(source?.label || `Servidor ${base.length + 1}`),
          url,
          language: language || "original",
          status: String(source?.status || "unknown").trim(),
        });
      }
    }

    return base;
  }

  const out = (Array.isArray(baseEpisodes) ? baseEpisodes : []).map((ep, idx) =>
    normalizeEpisode(ep, animeId, idx)
  );
  const incoming = Array.isArray(incomingEpisodes) ? incomingEpisodes : [];
  for (const item of incoming) {
    const normalized = normalizeEpisode(item, animeId, out.length);
    const match = out.find(
      (ep) =>
        (normalized.slug && ep.slug === normalized.slug) ||
        (normalized.sourceUrl && ep.sourceUrl === normalized.sourceUrl) ||
        similarityScore(normalized.title, ep.title) >= 0.93
    );
    if (!match) {
      out.push(normalized);
      continue;
    }

    if (!match.sourceUrl && normalized.sourceUrl) match.sourceUrl = normalized.sourceUrl;
    match.sources = mergeSourceLists(match.sources, normalized.sources);
    if (!match.sourceUrl && Array.isArray(match.sources) && match.sources[0]?.url) {
      match.sourceUrl = match.sources[0].url;
    }
    match.title = match.title || normalized.title;
    match.updatedAt = new Date().toISOString();
  }

  return out.sort(compareEpisodes);
}

export function dedupeCatalog(input) {
  const map = new Map();
  for (const raw of Array.isArray(input) ? input : []) {
    const title = String(raw?.title || "").trim();
    const id = String(raw?.id || toId(title || "anime"));
    const key = normalizeText(title || id);
    const current = map.get(key);
    const nextAnime = {
      id,
      title,
      year: raw?.year || "",
      genre: normalizeGenres(raw?.genre),
      description: String(raw?.description || raw?.synopsis || "").trim(),
      cover: String(raw?.cover || "").trim(),
      episodes: mergeEpisodes(raw?.episodes, [], id),
      updatedAt: raw?.updatedAt || new Date().toISOString(),
      createdAt: raw?.createdAt || new Date().toISOString(),
    };
    if (!current) {
      map.set(key, nextAnime);
      continue;
    }

    const merged = {
      ...current,
      title: current.title || nextAnime.title,
      year: current.year || nextAnime.year,
      cover: current.cover || nextAnime.cover,
      description: current.description || nextAnime.description,
      genre: [...new Set([...(current.genre || []), ...(nextAnime.genre || [])])],
      episodes: mergeEpisodes(current.episodes, nextAnime.episodes, current.id),
      updatedAt: new Date().toISOString(),
      createdAt: current.createdAt || nextAnime.createdAt,
    };
    map.set(key, merged);
  }
  return Array.from(map.values());
}

export function catalogKpis(animes) {
  const list = Array.isArray(animes) ? animes : [];
  let episodesTotal = 0;
  let episodesWithoutUrl = 0;
  let brokenSources = 0;
  let metadataIncomplete = 0;
  const genres = new Set();

  for (const anime of list) {
    if (!anime.description || !anime.cover || !anime.year || normalizeGenres(anime.genre).length === 0) {
      metadataIncomplete += 1;
    }
    for (const genre of normalizeGenres(anime.genre)) genres.add(genre);

    const episodes = Array.isArray(anime.episodes) ? anime.episodes : [];
    episodesTotal += episodes.length;
    for (const ep of episodes) {
      const src = String(ep?.sourceUrl || "").trim();
      if (!src) episodesWithoutUrl += 1;
      const sources = Array.isArray(ep?.sources) ? ep.sources : [];
      if (sources.some((s) => String(s.status || "").toLowerCase() === "down")) {
        brokenSources += 1;
      }
    }
  }

  return {
    animesTotal: list.length,
    episodesTotal,
    episodesWithoutUrl,
    brokenSources,
    metadataIncomplete,
    genresTotal: genres.size,
  };
}
