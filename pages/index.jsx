import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import data from "../data/videos.json";

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCard, setActiveCard] = useState(null);

  const handleCardClick = (animeId) => {
    if (activeCard === animeId) {
      window.location.href = `/serie/${animeId}`;
      return;
    }

    setActiveCard(animeId);
    setTimeout(() => setActiveCard(null), 4500);
  };

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

      <main className="mx-auto max-w-6xl px-3 py-6 text-white sm:px-4 sm:py-10">
        <h1 className="fluid-enter mb-6 text-center text-2xl font-bold sm:text-3xl">
          Catalogo de Series
        </h1>

        <div className="mb-7 flex justify-center sm:mb-8">
          <input
            type="text"
            placeholder="Buscar anime, genero o ano..."
            className="interactive w-full rounded-lg border border-white/10 bg-neutral-800/85 px-4 py-2.5 text-white outline-none placeholder:text-neutral-400 focus:border-pink-500 sm:w-3/4 md:w-1/2"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {filteredAnimes.length > 0 ? (
          <section id="categorias" className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5">
            {filteredAnimes.map((anime) => {
              const isActive = activeCard === anime.id;
              return (
                <article
                  key={anime.id}
                  onClick={() => handleCardClick(anime.id)}
                  className={`interactive group relative cursor-pointer overflow-hidden rounded-xl border border-white/5 bg-neutral-900 shadow-md hover:-translate-y-1 hover:shadow-pink-600/25 ${
                    isActive ? "ring-2 ring-pink-500" : ""
                  }`}
                >
                  <img
                    src={anime.cover}
                    alt={anime.title}
                    className={`h-[250px] w-full object-cover sm:h-[300px] md:h-[330px] ${
                      isActive ? "scale-105" : "group-hover:scale-105"
                    } interactive`}
                  />

                  <div
                    className={`absolute inset-0 flex flex-col justify-end bg-black/80 p-3 sm:p-4 ${
                      isActive
                        ? "translate-y-0 opacity-100"
                        : "translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
                    } interactive`}
                  >
                    <h2 className="mb-1 text-sm font-semibold text-white sm:text-base">
                      {anime.title}
                    </h2>
                    <p className="mb-2 text-[11px] text-neutral-300 sm:text-xs">
                      {anime.year} -{" "}
                      {Array.isArray(anime.genre)
                        ? anime.genre.join(", ")
                        : anime.genre || "Desconocido"}
                    </p>
                    <p className="mb-3 line-clamp-3 text-[11px] text-neutral-300 sm:text-xs">
                      {anime.description}
                    </p>

                    <Link
                      href={`/serie/${anime.id}`}
                      className="interactive rounded-lg bg-pink-600 px-3 py-1.5 text-center text-xs font-medium text-white hover:bg-pink-700"
                    >
                      Ver serie
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <p className="mt-10 text-center text-neutral-400">
            No se encontro ningun anime con ese nombre.
          </p>
        )}
      </main>
    </>
  );
}
