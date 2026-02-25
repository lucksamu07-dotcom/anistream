import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function VideoPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [video, setVideo] = useState(null);
  const [anime, setAnime] = useState(null);
  const [views, setViews] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!slug) return;

    const load = async () => {
      const res = await fetch("/api/mock/read");
      const data = await res.json();

      const foundAnime = data.find((a) =>
        a.episodes.some((ep) => ep.slug === slug)
      );
      const foundVideo = foundAnime?.episodes.find((ep) => ep.slug === slug);
      const index = foundAnime?.episodes.findIndex((ep) => ep.slug === slug);

      setAnime(foundAnime);
      setVideo(foundVideo);
      setCurrentIndex(index);

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

  if (!video || !anime) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
        Cargando episodio...
      </div>
    );
  }

  const formatEmbed = (url) => {
    if (url.includes("streamtape.com")) {
      const id = url.split("/e/")[1];
      return `https://streamtape.com/e/${id}`;
    }
    if (url.includes("dood.")) {
      const id = url.split("/e/")[1];
      return `https://dood.wf/e/${id}`;
    }
    return url;
  };

  const previousEpisode = currentIndex > 0 ? anime.episodes[currentIndex - 1] : null;
  const nextEpisode =
    currentIndex < anime.episodes.length - 1
      ? anime.episodes[currentIndex + 1]
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-white md:flex-row">
      <div className="flex-1 p-3 sm:p-4 md:p-8">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h1 className="fluid-enter text-xl font-bold text-pink-500 sm:text-2xl">
            {video.title}
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
          {anime.title} - {anime.year} - {anime.genre}
        </p>
        <p className="mb-4 text-xs text-neutral-500">{views} vistas</p>

        <div className="mb-6 aspect-video overflow-hidden rounded-xl bg-black shadow-lg shadow-pink-500/10">
          <iframe
            src={formatEmbed(video.sourceUrl)}
            frameBorder="0"
            allowFullScreen
            className="h-full w-full"
            title={video.title}
          />
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
