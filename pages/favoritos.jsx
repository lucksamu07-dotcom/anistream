import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function FavoritosPage() {
  const [favorites, setFavorites] = useState([]);
  const [allAnimes, setAllAnimes] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const favs = JSON.parse(localStorage.getItem("animeFavorites") || "[]");
    setFavorites(favs);

    const load = async () => {
      const res = await fetch("/api/mock/read");
      const data = await res.json();
      setAllAnimes(data);
    };
    load();
  }, []);

  const favAnimes = allAnimes.filter((a) => favorites.includes(a.id));

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-4 md:p-8">
      <h1 className="text-3xl font-bold text-pink-500 mb-6 text-center md:text-left">
        ❤️ Mis Favoritos
      </h1>

      {favAnimes.length === 0 ? (
        <p className="text-neutral-400 text-center mt-12">
          Aún no tienes animes en tu lista de favoritos.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {favAnimes.map((anime) => (
            <div
              key={anime.id}
              className="bg-neutral-900/70 p-3 rounded-lg cursor-pointer hover:bg-neutral-800 transition-all border border-transparent hover:border-pink-500/40"
              onClick={() => router.push(`/serie/${anime.id}`)}
            >
              <div className="aspect-[2/3] bg-black rounded-md overflow-hidden mb-2 shadow-md">
                <img
                  src={anime.cover}
                  alt={anime.title}
                  className="w-full h-full object-cover transition-transform hover:scale-105"
                />
              </div>
              <h3 className="text-sm font-semibold truncate text-neutral-100">
                {anime.title}
              </h3>
              <p className="text-xs text-neutral-400">{anime.genre}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
