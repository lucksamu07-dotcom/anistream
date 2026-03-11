import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { fetchCatalog } from "../lib/catalogClient";

export default function FavoritosPage() {
  const [favorites, setFavorites] = useState([]);
  const [allAnimes, setAllAnimes] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const favs = JSON.parse(localStorage.getItem("animeFavorites") || "[]");
    setFavorites(favs);

    const load = async () => {
      const data = await fetchCatalog();
      setAllAnimes(data);
    };
    load();
  }, []);

  const favAnimes = allAnimes.filter((a) => favorites.includes(a.id));

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-4 md:p-8">
      <h1 className="mb-6 text-center text-3xl font-bold text-pink-500 md:text-left">Mis Favoritos</h1>

      {favAnimes.length === 0 ? (
        <p className="mt-12 text-center text-neutral-400">Aun no tienes animes en tu lista de favoritos.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {favAnimes.map((anime) => (
            <div
              key={anime.id}
              className="cursor-pointer rounded-lg border border-transparent bg-neutral-900/70 p-3 transition-all hover:border-pink-500/40 hover:bg-neutral-800"
              onClick={() => router.push(`/serie/${anime.id}`)}
            >
              <div className="mb-2 aspect-[2/3] overflow-hidden rounded-md bg-black shadow-md">
                <img
                  src={anime.cover}
                  alt={anime.title}
                  className="h-full w-full object-cover transition-transform hover:scale-105"
                />
              </div>
              <h3 className="truncate text-sm font-semibold text-neutral-100">{anime.title}</h3>
              <p className="text-xs text-neutral-400">{anime.genre}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
