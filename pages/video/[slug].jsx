import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import Player from "../../components/Player";
import PlayerErrorBoundary from "../../components/PlayerErrorBoundary";
import { getEpisodeThumbnail } from "../../lib/videoPreview";

function normalizeGenres(genre) {
  if (Array.isArray(genre)) return genre.filter(Boolean).map((g) => String(g).trim());
  if (typeof genre === "string") {
    return genre
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);
  }
  return [];
}

function getEpisodeNumber(episode) {
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

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function detectLanguageTag(text) {
  const value = normalizeText(text);
  if (!value) return "original";
  if (/(latino|espanol latino|audio latino|castellano|espanol)/i.test(value)) return "latino";
  if (/(english|ingles|dub en)/i.test(value)) return "ingles";
  if (/(sub|subtitulado|sub espanol|japones)/i.test(value)) return "sub";
  return "original";
}

function languageLabel(lang) {
  if (lang === "latino") return "Latino";
  if (lang === "ingles") return "Ingles";
  if (lang === "sub") return "Sub";
  return "Original";
}

function isBlockedSource(url) {
  return /hentaistream\./i.test(String(url || ""));
}

function buildSourceOptions(episode) {
  if (!episode) return [];

  if (Array.isArray(episode.sources) && episode.sources.length > 0) {
    return episode.sources
      .map((source, index) => {
        if (typeof source === "string") {
          const language = detectLanguageTag(`${source} ${episode.title || ""}`);
          return {
            label: `Servidor ${index + 1}`,
            url: source,
            language,
            blocked: isBlockedSource(source),
          };
        }
        if (source && source.url) {
          const language =
            source.language || detectLanguageTag(`${source.label || ""} ${source.url} ${episode.title || ""}`);
          return {
            label: source.label || source.server || `Servidor ${index + 1}`,
            url: source.url,
            language,
            blocked: isBlockedSource(source.url),
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  if (episode.sourceUrl) {
    return [
      {
        label: "Principal",
        url: episode.sourceUrl,
        language: episode.language || detectLanguageTag(`${episode.title || ""} ${episode.sourceUrl}`),
        blocked: isBlockedSource(episode.sourceUrl),
      },
    ];
  }

  return [];
}

async function fetchCatalog() {
  const endpoints = ["/api/getData", "/api/mock/read"];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data)) return data;
    } catch {
      // try next endpoint
    }
  }

  throw new Error("No se pudo cargar el catalogo");
}

export default function VideoPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [video, setVideo] = useState(null);
  const [anime, setAnime] = useState(null);
  const [views, setViews] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeSourceUrl, setActiveSourceUrl] = useState("");
  const [activeLanguage, setActiveLanguage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!slug) return;

    const load = async () => {
      setIsLoading(true);
      setLoadError("");

      try {
        const data = await fetchCatalog();
        const foundAnime = data.find((a) =>
          a.episodes.some((ep) => ep.slug === slug)
        );
        const foundVideo = foundAnime?.episodes.find((ep) => ep.slug === slug);

        if (!foundAnime || !foundVideo) {
          setAnime(null);
          setVideo(null);
          setLoadError("No se encontro este episodio.");
          return;
        }

        const sortedEpisodes = [...(foundAnime?.episodes || [])].sort(
          compareEpisodes
        );
        const index = sortedEpisodes.findIndex((ep) => ep.slug === slug);

        setAnime(foundAnime);
        setVideo(foundVideo);
        setCurrentIndex(index);
        const sources = buildSourceOptions(foundVideo);
        const firstPlayable = sources.find((s) => !s.blocked) || sources[0];
        const initialLanguage = firstPlayable?.language || "original";
        const initialForLanguage = sources.find((s) => (s.language || "original") === initialLanguage && !s.blocked)
          || sources.find((s) => (s.language || "original") === initialLanguage)
          || firstPlayable;
        setActiveSourceUrl(firstPlayable?.url || "");
        setActiveLanguage(initialLanguage);
        if (initialForLanguage?.url) setActiveSourceUrl(initialForLanguage.url);

        const savedViews = JSON.parse(localStorage.getItem("animeViews") || "{}");
        const currentViews = savedViews[foundAnime?.id] || 0;
        savedViews[foundAnime?.id] = currentViews + 1;
        localStorage.setItem("animeViews", JSON.stringify(savedViews));
        setViews(currentViews + 1);

        const savedFavs = JSON.parse(localStorage.getItem("animeFavorites") || "[]");
        setIsFavorite(savedFavs.includes(foundAnime?.id));
      } catch {
        setAnime(null);
        setVideo(null);
        setLoadError("No se pudieron cargar los datos.");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [slug]);

  const toggleFavorite = () => {
    const savedFavs = JSON.parse(localStorage.getItem("animeFavorites") || "[]");
    const updatedFavs = isFavorite
      ? savedFavs.filter((id) => id !== anime.id)
      : [...savedFavs, anime.id];

    localStorage.setItem("animeFavorites", JSON.stringify(updatedFavs));
    setIsFavorite(!isFavorite);
  };

  const orderedEpisodes = useMemo(
    () => [...(anime?.episodes || [])].sort(compareEpisodes),
    [anime]
  );
  const genres = useMemo(() => normalizeGenres(anime?.genre), [anime]);
  const sourceOptions = useMemo(() => buildSourceOptions(video), [video]);
  const languageOptions = useMemo(
    () => [...new Set(sourceOptions.map((s) => s.language || "original"))],
    [sourceOptions]
  );
  const visibleSources = useMemo(() => {
    if (!activeLanguage) return sourceOptions;
    return sourceOptions.filter((s) => (s.language || "original") === activeLanguage);
  }, [sourceOptions, activeLanguage]);
  const episodeNumber = getEpisodeNumber(video);
  const episodeLabel = Number.isFinite(episodeNumber)
    ? `Episodio ${episodeNumber}`
    : video?.title || "Episodio";
  const activeUrl = activeSourceUrl || visibleSources[0]?.url || sourceOptions[0]?.url || "";

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
        Cargando episodio...
      </div>
    );
  }

  if (!video || !anime) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 text-center text-white">
        {loadError || "Episodio no disponible."}
      </div>
    );
  }

  const previousEpisode = currentIndex > 0 ? orderedEpisodes[currentIndex - 1] : null;
  const nextEpisode =
    currentIndex < orderedEpisodes.length - 1
      ? orderedEpisodes[currentIndex + 1]
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-white md:flex-row">
      <div className="flex-1 p-3 sm:p-4 md:p-8">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h1 className="fluid-enter text-xl font-bold text-pink-500 sm:text-2xl">
            {anime.title}
          </h1>

          <button
            onClick={toggleFavorite}
            className="interactive rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xl hover:border-pink-500/50"
            title={isFavorite ? "Eliminar de favoritos" : "Agregar a favoritos"}
          >
            {isFavorite ? "Quitar" : "Favorito"}
          </button>
        </div>

        <p className="mb-1 text-xs text-neutral-400 sm:text-sm">
          {episodeLabel} {video.title && video.title !== episodeLabel ? `- ${video.title}` : ""}
        </p>
        <p className="mb-1 text-xs text-neutral-500">
          {anime.year} {genres.length ? `- ${genres.join(", ")}` : ""}
        </p>
        <p className="mb-4 text-xs text-neutral-500">{views} vistas</p>

        {languageOptions.length > 1 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-400">Idioma:</span>
            {languageOptions.map((lang) => {
              const isActive = activeLanguage === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => {
                    setActiveLanguage(lang);
                    const firstSource =
                      sourceOptions.find((s) => (s.language || "original") === lang && !s.blocked) ||
                      sourceOptions.find((s) => (s.language || "original") === lang);
                    if (firstSource?.url) setActiveSourceUrl(firstSource.url);
                  }}
                  className={`interactive rounded-full border px-3 py-1 text-xs ${
                    isActive
                      ? "border-pink-500 bg-pink-600 text-white"
                      : "border-white/15 bg-neutral-900 text-neutral-300 hover:border-pink-500/50 hover:text-white"
                  }`}
                >
                  {languageLabel(lang)}
                </button>
              );
            })}
          </div>
        )}

        {visibleSources.length > 1 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-400">Servidor:</span>
            {visibleSources.map((source) => {
              const isActive = activeSourceUrl === source.url;
              return (
                <button
                  key={`${source.label}-${source.url}`}
                  type="button"
                  onClick={() => setActiveSourceUrl(source.url)}
                  className={`interactive rounded-full border px-3 py-1 text-xs ${
                    isActive
                      ? "border-pink-500 bg-pink-600 text-white"
                      : "border-white/15 bg-neutral-900 text-neutral-300 hover:border-pink-500/50 hover:text-white"
                  }`}
                >
                  {source.label}{source.blocked ? " (externo)" : ""}
                </button>
              );
            })}
          </div>
        )}

        <div className="mb-6 aspect-video overflow-hidden rounded-xl bg-black shadow-lg shadow-pink-500/10">
          <PlayerErrorBoundary resetKey={activeUrl}>
            <Player
              key={activeUrl}
              url={activeUrl}
              title={video.title}
            />
          </PlayerErrorBoundary>
        </div>

        <div className="mb-8 flex flex-wrap gap-2 sm:gap-3">
          {previousEpisode && (
            <button
              onClick={() => router.push(`/video/${previousEpisode.slug}`)}
              className="interactive rounded-full bg-neutral-800 px-4 py-2 text-sm hover:bg-pink-700"
            >
              Episodio anterior
            </button>
          )}

          <button
            onClick={() => router.push(`/serie/${anime.id}`)}
            className="interactive rounded-full bg-neutral-800 px-4 py-2 text-sm hover:bg-pink-700"
          >
            Volver a la serie
          </button>

          {nextEpisode && (
            <button
              onClick={() => router.push(`/video/${nextEpisode.slug}`)}
              className="interactive rounded-full bg-neutral-800 px-4 py-2 text-sm hover:bg-pink-700"
            >
              Siguiente episodio
            </button>
          )}
        </div>

        <h2 className="mb-2 text-lg font-semibold">Sinopsis</h2>
        <p className="text-sm leading-relaxed text-neutral-300">
          {anime.description || "Sinopsis no disponible."}
        </p>
      </div>

      <aside className="w-full border-t border-white/10 bg-neutral-900/40 p-4 sm:p-6 md:w-80 md:border-l md:border-t-0 lg:w-96">
        <p className="text-xs text-neutral-400">Estas viendo</p>
        <h2 className="mb-4 text-xl font-semibold text-white">{episodeLabel}</h2>

        <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
          {orderedEpisodes.map((ep) => {
            const num = getEpisodeNumber(ep);
            const label = Number.isFinite(num) ? `Episodio ${num}` : ep.title || "Episodio";
            const active = ep.slug === slug;
            const thumb = getEpisodeThumbnail(ep, anime.cover);

            return (
              <button
                key={ep.slug}
                type="button"
                onClick={() => router.push(`/video/${ep.slug}`)}
                className={`w-full rounded-xl border p-2 text-left transition ${
                  active
                    ? "border-pink-400 bg-pink-500/10"
                    : "border-white/10 bg-white/5 hover:border-pink-500/40 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={thumb}
                    alt={ep.title || label}
                    className="h-14 w-20 rounded-md object-cover"
                  />
                  <div className="min-w-0">
                    <p className={`truncate text-base font-semibold ${active ? "text-pink-300" : "text-white"}`}>
                      {label}
                    </p>
                    <p className="truncate text-sm text-neutral-400">{anime.title}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
