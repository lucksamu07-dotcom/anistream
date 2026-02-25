import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function SeriePage() {
  const router = useRouter();
  const { id } = router.query;
  const [anime, setAnime] = useState(null);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      const res = await fetch("/api/mock/read");
      const data = await res.json();

      // Buscar la serie actual
      const found = data.find((a) => a.id === id);
      setAnime(found);
    };

    load();
  }, [id]);

  if (!anime)
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        Cargando serie...
      </div>
    );

  return (
    <div className="relative min-h-screen text-white overflow-hidden">
      {/* 🌌 Fondo borroso dinámico */}
      <div
        className="absolute inset-0 bg-cover bg-center blur-3xl opacity-40"
        style={{
          backgroundImage: `url(${anime.cover})`,
          transform: "scale(1.2)",
        }}
      ></div>

      {/* Capa de oscurecimiento */}
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-900/90 to-neutral-950/95"></div>

      {/* Contenido principal */}
      <div className="relative z-10 p-4 md:p-8">
        {/* Portada y detalles */}
        <div className="flex flex-col md:flex-row gap-6 mb-8 items-center md:items-start">
          <img
            src={anime.cover}
            alt={anime.title}
            className="w-60 h-80 md:w-72 md:h-96 object-cover rounded-xl shadow-[0_0_25px_rgba(255,0,128,0.3)]"
          />
          <div className="text-center md:text-left max-w-2xl">
            <h1 className="text-3xl md:text-5xl font-bold text-pink-500 drop-shadow-[0_2px_6px_rgba(255,0,128,0.5)] mb-2">
              {anime.title}
            </h1>
            <p className="text-neutral-300 text-sm md:text-base mb-3">
              {anime.year} · {anime.genre}
            </p>
            <p className="text-neutral-200 leading-relaxed text-sm md:text-base mb-5">
              {anime.description || "Sinopsis no disponible."}
            </p>

            {/* ▶️ Botón de Reproducir primer episodio con animación */}
            {anime.episodes?.length > 0 && (
              <button
                onClick={() =>
                  router.push(`/video/${anime.episodes[0].slug}`)
                }
                className="relative bg-pink-600 hover:bg-pink-700 text-white font-semibold px-6 py-3 rounded-full shadow-lg hover:shadow-[0_0_15px_rgba(255,0,128,0.4)] transition-all duration-200 flex items-center gap-2 mx-auto md:mx-0 overflow-hidden"
              >
                {/* Icono con animación de latido */}
                <span className="text-lg animate-pulsePlay">▶</span>
                Reproducir primer episodio

                {/* Brillo animado sutil al pasar el mouse */}
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 hover:opacity-100 animate-shine pointer-events-none"></span>
              </button>
            )}
          </div>
        </div>

        {/* Lista de episodios */}
        <h2 className="text-2xl font-semibold mb-4 text-pink-400">
          Episodios
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {anime.episodes.map((ep) => (
            <div
              key={ep.slug}
              className="bg-neutral-900/70 p-3 rounded-lg cursor-pointer hover:bg-neutral-800/80 transition-all border border-transparent hover:border-pink-500/40"
              onClick={() => router.push(`/video/${ep.slug}`)}
            >
              <div className="aspect-video bg-black rounded-md overflow-hidden mb-2 shadow-md">
                <img
                  src={ep.thumbnail || anime.cover}
                  alt={ep.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <h3 className="text-sm font-semibold truncate text-neutral-100">
                {ep.title}
              </h3>
            </div>
          ))}
        </div>
      </div>

      {/* Estilos de animación personalizados */}
      <style jsx global>{`
        @keyframes pulsePlay {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.25);
            opacity: 0.8;
          }
        }

        .animate-pulsePlay {
          animation: pulsePlay 1.8s infinite ease-in-out;
        }

        @keyframes shine {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        .animate-shine:hover {
          animation: shine 1.5s linear infinite;
        }
      `}</style>
    </div>
  );
}
