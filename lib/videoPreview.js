function normalizeUrl(value) {
  return String(value || "").trim();
}

function extractEpisodeSources(episode) {
  if (!episode) return [];

  const urls = [];
  if (episode.sourceUrl) urls.push(episode.sourceUrl);
  if (Array.isArray(episode.sources)) {
    episode.sources.forEach((source) => {
      if (!source) return;
      if (typeof source === "string") urls.push(source);
      else if (source.url) urls.push(source.url);
    });
  }

  return urls.map(normalizeUrl).filter(Boolean);
}

function extractIdByPattern(url, pattern) {
  const match = url.match(pattern);
  return match?.[1] || "";
}

function getProviderThumbnailFromUrl(rawUrl) {
  const url = normalizeUrl(rawUrl).toLowerCase();
  if (!url) return "";

  if (url.includes("streamtape")) {
    const id = extractIdByPattern(url, /\/e\/([a-z0-9]+)/i);
    if (id) return `https://img.streamtape.to/i/${id}.jpg`;
  }

  if (url.includes("dood")) {
    const id = extractIdByPattern(url, /\/e\/([a-z0-9]+)/i);
    if (id) return `https://img.doodcdn.co/splash/${id}.jpg`;
  }

  if (url.includes("filemoon")) {
    const id = extractIdByPattern(url, /\/e\/([a-z0-9]+)/i);
    if (id) return `https://filemoon.sx/asset/userdata/${id}.jpg`;
  }

  if (url.includes("mixdrop")) {
    const id = extractIdByPattern(url, /\/f\/([a-z0-9]+)/i);
    if (id) return `https://i.mixdrop.to/${id}.jpg`;
  }

  return "";
}

function isDirectVideoUrl(url) {
  return /\.(mp4|webm|m3u8)(\?|#|$)/i.test(String(url || ""));
}

export function getEpisodeThumbnail(episode, fallbackCover = "") {
  if (episode?.thumbnail) return episode.thumbnail;

  const sources = extractEpisodeSources(episode);
  for (const sourceUrl of sources) {
    const generated = getProviderThumbnailFromUrl(sourceUrl);
    if (generated) return generated;
  }

  return fallbackCover;
}

export function getEpisodePreviewUrl(episode) {
  const sources = extractEpisodeSources(episode);
  for (const sourceUrl of sources) {
    if (isDirectVideoUrl(sourceUrl) && !/\.m3u8(\?|#|$)/i.test(sourceUrl)) {
      return sourceUrl;
    }
  }
  return "";
}
