import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import Player from "../../components/Player";

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
  const text = `${episode?.id || ""} ${episode?.slug || ""} ${episode?.title || ""}`;
  const match = text.match(/(?:ep|episodio)?\s*0*(\d{1,4})/i);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function buildSourceOptions(episode) {
  if (!episode) return [];

  if (Array.isArray(episode.sources) && episode.sources.length > 0) {
    return episode.sources
      .map((source, index) => {
        if (typeof source === "string") {
          return { label: `Servidor ${index + 1}`, url: source };
        }
        if (source && source.url) {
          return {
            label: source.label || source.server || `Servidor ${index + 1}`,
            url: source.url,
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  if (episode.sourceUrl) {
    return [{ label: "Principal", url: episode.sourceUrl }];
  }

  return [];
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

  useEffect(() => {
    if (!slug) return;

    const load = async () => {
      const res = await fetch("/api/mock/read");
      const data = await res.json();

      const foundAnime = data.find((a) =>
        a.episodes.some((ep) => ep.slug === slug)
      );
      const foundVideo = foundAnime?.episodes.find((ep) => ep.slug === slug);
      const sortedEpisodes = [...(foundAnime?.episodes || [])].sort(
        (a, b) => getEpisodeNumber(a) - getEpisodeNumber(b)
      );
      const index = sortedEpisodes.findIndex((ep) => ep.slug === slug);

      setAnime(foundAnime);
      setVideo(foundVideo);
      setCurrentIndex(index);
      const sources = buildSourceOptions(foundVideo);
      setActiveSourceUrl(sources[0]?.url || "");

      const savedViews = JSON.parse(localStorage.getItem("animeViews") || "{}");
      const currentViews = savedViews[foundAnime?.id] || 0;
      savedViews[foundAnime?.id] = currentViews + 1;
      localStorage.setItem("animeViews", JSON.stringify(savedViews));
      setViews(currentViews + 1);

      const savedFavs = JSON.parse(localStorage.getItem("animeFavorites") || "[]");
      setIsFavorite(savedFavs.includes(foundAnime?.id));
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
    () => [...(anime?.episodes || [])].sort((a, b) => getEpisodeNumber(a) - getEpisodeNumber(b)),
    [anime]
  );
  const genres = useMemo(() => normalizeGenres(anime?.genre), [anime]);
  const sourceOptions = useMemo(() => buildSourceOptions(video), [video]);
  const episodeNumber = getEpisodeNumber(video);
  const episodeLabel = Number.isFinite(episodeNumber)
    ? `Episodio ${episodeNumber}`
    : video?.title || "Episodio";

  if (!video || !anime) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
        Cargando episodio...
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

        {sourceOptions.length > 1 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-400">Servidor:</span>
            {sourceOptions.map((source) => {
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
                  {source.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="mb-6 aspect-video overflow-hidden rounded-xl bg-black shadow-lg shadow-pink-500/10">
          <Player url={activeSourceUrl || sourceOptions[0]?.url || ""} title={video.title} />
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

      <aside className="w-full border-t border-white/10 bg-neutral-900/40 p-4 sm:p-6 md:w-80 md:border-l md:border-t-0">
        <h2 className="mb-2 text-center text-lg font-semibold md:text-left">
          Animes recomendados
        </h2>
        <p className="text-center text-sm text-neutral-500 md:text-left">
          Proximamente.
        </p>
      </aside>
    </div>
  );
}
