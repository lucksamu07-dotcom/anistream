import AdZones from "../../components/AdZones";
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

    {/* 👇 Aquí mostramos los anuncios */}
    <AdZones />

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

      // 🔹 Contador de vistas
      const savedViews =
        JSON.parse(localStorage.getItem("animeViews") || "{}") || {};
      const currentViews = savedViews[foundAnime?.id] || 0;
      savedViews[foundAnime?.id] = currentViews + 1;
      localStorage.setItem("animeViews", JSON.stringify(savedViews));
      setViews(currentViews + 1);

      // 🔹 Favoritos
      const savedFavs =
        JSON.parse(localStorage.getItem("animeFavorites") || "[]") || [];
      setIsFavorite(savedFavs.includes(foundAnime?.id));
    };

    load();
  }, [slug]);

  const toggleFavorite = () => {
    const savedFavs =
      JSON.parse(localStorage.getItem("animeFavorites") || "[]") || [];

    let updatedFavs;
    if (isFavorite) {
      updatedFavs = savedFavs.filter((id) => id !== anime.id);
    } else {
      updatedFavs = [...savedFavs, anime.id];
    }

    localStorage.setItem("animeFavorites", JSON.stringify(updatedFavs));
    setIsFavorite(!isFavorite);
  };

  if (!video || !anime)
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        Cargando episodio...
      </div>
    );

  // 🎥 Función para convertir enlaces
  const formatEmbed = (url) => {
    if (url.includes("streamtape.com")) {
      const id = url.split("/e/")[1];
      return `https://streamtape.com/e/${id}`;
    } else if (url.includes("dood.")) {
      const id = url.split("/e/")[1];
      return `https://dood.wf/e/${id}`;
    }
    return url;
  };

  // 📺 Episodios anterior / siguiente
  const previousEpisode =
    currentIndex > 0 ? anime.episodes[currentIndex - 1] : null;
  const nextEpisode =
    currentIndex < anime.episodes.length - 1
      ? anime.episodes[currentIndex + 1]
      : null;

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col md:flex-row">
      {/* 🧩 Reproductor principal */}
      <div className="flex-1 p-4 md:p-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-pink-500">{video.title}</h1>

          {/* ❤️ Favorito */}
          <button
            onClick={toggleFavorite}
            className="text-2xl transition-colors"
            title={
              isFavorite ? "Eliminar de favoritos" : "Agregar a favoritos"
            }
          >
            {isFavorite ? "❤️" : "🤍"}
          </button>
        </div>

        <p className="text-neutral-400 text-sm mb-3">
          {anime.title} · {anime.year} · {anime.genre}
        </p>
        <p className="text-neutral-500 text-xs mb-4">👁️ {views} vistas</p>

        <div className="aspect-video bg-black rounded-xl overflow-hidden mb-6 shadow-lg shadow-pink-500/10">
          <iframe
            src={formatEmbed(video.sourceUrl)}
            frameBorder="0"
            allowFullScreen
            className="w-full h-full"
          ></iframe>
        </div>

        {/* 🎮 Controles de navegación */}
        <div className="flex flex-wrap gap-3 justify-center md:justify-start mb-8">
          {previousEpisode && (
            <button
              onClick={() => router.push(`/video/${previousEpisode.slug}`)}
              className="px-4 py-2 bg-neutral-800 rounded-full hover:bg-pink-700 transition-all"
            >
              ⬅ Episodio anterior
            </button>
          )}

          <button
            onClick={() => router.push(`/serie/${anime.id}`)}
            className="px-4 py-2 bg-neutral-800 rounded-full hover:bg-pink-700 transition-all"
          >
            🏠 Volver a la serie
          </button>

          {nextEpisode && (
            <button
              onClick={() => router.push(`/video/${nextEpisode.slug}`)}
              className="px-4 py-2 bg-neutral-800 rounded-full hover:bg-pink-700 transition-all"
            >
              ➡ Siguiente episodio
            </button>
          )}
        </div>

        {/* 📄 Sinopsis */}
        <h2 className="text-lg font-semibold mb-2">Sinopsis</h2>
        <p className="text-neutral-300 text-sm leading-relaxed">
          {anime.description || "Sinopsis no disponible."}
        </p>
      </div>

      {/* 🎬 Recomendaciones */}
      <aside className="w-full md:w-80 border-t md:border-t-0 md:border-l border-white/10 bg-neutral-900/40 p-4 md:p-6">
        <h2 className="text-xl font-semibold mb-4 text-center md:text-left">
          Animes recomendados
        </h2>
        <p className="text-neutral-500 text-sm text-center">
          (Próximamente mejorados por IA 🔮)
        </p>
      </aside>
    </div>
  );
}
