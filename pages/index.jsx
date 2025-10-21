import { useState } from "react";
import AdZones from "../components/AdZones";
import Head from "next/head";
import Link from "next/link";
import data from "../data/videos.json";

export default function Home() {
  const [searchTerm, setSearchTerm] = useState(""); // texto del buscador
  const [activeCard, setActiveCard] = useState(null); // para móviles

  // Función que maneja el toque en celular
  const handleCardClick = (animeId) => {
    if (activeCard === animeId) {
      window.location.href = `/serie/${animeId}`;
    } else {
      setActiveCard(animeId);
      setTimeout(() => setActiveCard(null), 6000);
    }
  };

  // Filtrado de animes según búsqueda
  const filteredAnimes = data.filter((anime) => {
    const term = searchTerm.toLowerCase();
    return (
      anime.title.toLowerCase().includes(term) ||
      (Array.isArray(anime.genre) &&
        anime.genre.join(", ").toLowerCase().includes(term)) ||
      anime.year.toString().includes(term)
    );
  });

  return (
    <>
      <Head>
        <title>AniStream+</title>
      </Head>

      <main className="max-w-6xl mx-auto px-4 py-10 text-white">
        {/* Título */}
        <h1 className="text-3xl font-bold mb-6 text-center">
          Catálogo de Series
        </h1>

        <AdZones
         imageUrl="/ads/banner1.jpg"
        link="https://tuenlace.com"
        />

        {/* 🔍 Barra de búsqueda */}
        <div className="flex justify-center mb-8">
          <input
            type="text"
            placeholder="Buscar anime, género o año..."
            className="w-full sm:w-1/2 px-4 py-2 rounded-lg bg-neutral-800 text-white placeholder-neutral-400 outline-none focus:ring-2 focus:ring-pink-500 transition"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Grid de portadas */}
        {filteredAnimes.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {filteredAnimes.map((anime) => {
              const isActive = activeCard === anime.id;
              return (
                <div
                  key={anime.id}
                  onClick={() => handleCardClick(anime.id)}
                  className={`relative rounded-xl overflow-hidden bg-neutral-900 shadow-md hover:shadow-pink-600/30 group transition-all duration-300 cursor-pointer ${
                    isActive ? "ring-2 ring-pink-500" : ""
                  }`}
                >
                  {/* Imagen del anime */}
                  <img
                    src={anime.cover}
                    alt={anime.title}
                    className={`w-full h-[340px] object-cover transform transition duration-500 ${
                      isActive ? "scale-105" : "group-hover:scale-105"
                    }`}
                  />

                  {/* Capa con detalles */}
                  <div
                    className={`absolute inset-0 bg-black/80 p-4 flex flex-col justify-end transition-all duration-500 ${
                      isActive
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-5 group-hover:opacity-100 group-hover:translate-y-0"
                    }`}
                  >
                    <h2 className="text-base font-semibold mb-1 group-hover:text-pink-400 transition">
                      {anime.title}
                    </h2>
                    <p className="text-xs text-neutral-400 mb-1">
                      {anime.year} •{" "}
                      {Array.isArray(anime.genre)
                        ? anime.genre.join(", ")
                        : anime.genre || "Desconocido"}
                    </p>
                    <p className="text-xs text-neutral-300 mb-3 line-clamp-3">
                      {anime.description}
                    </p>

                    <Link
                      href={`/serie/${anime.id}`}
                      className="bg-pink-600 hover:bg-pink-700 text-xs font-medium text-white py-1.5 px-3 rounded-lg text-center transition"
                    >
                      ▶ Ver serie
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-neutral-400 mt-10">
            ⚠️ No se encontró ningún anime con ese nombre.
          </p>
        )}
      </main>
    </>
  );
}
