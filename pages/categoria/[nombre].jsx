import { useRouter } from "next/router";
import Link from "next/link";
import data from "../../data/videos.json";

function toGenreKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function extractAnimeGenres(anime) {
  const raw = Array.isArray(anime?.genre) ? anime.genre : [anime?.genre || ""];
  return raw
    .flatMap((entry) => String(entry || "").split(","))
    .map((g) => g.trim())
    .filter(Boolean);
}

export default function CategoriaPage() {
  const router = useRouter();
  const { nombre } = router.query;
  const target = toGenreKey(nombre);

  const animes = data.filter((anime) =>
    extractAnimeGenres(anime).some((genre) => toGenreKey(genre) === target)
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-white">
      <section className="mb-8 rounded-2xl border border-white/10 bg-gradient-to-r from-[#2b1016]/90 via-[#1d0e13]/95 to-[#140f10]/95 p-5">
        <p className="title-display text-2xl text-rose-300">Genero</p>
        <h1 className="text-3xl font-bold tracking-tight text-white">{nombre}</h1>
        <p className="mt-1 text-sm text-rose-100/80">{animes.length} resultados encontrados</p>
      </section>

      {animes.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {animes.map((anime) => (
            <Link
              key={anime.id}
              href={`/serie/${anime.id}`}
              className="group overflow-hidden rounded-xl border border-white/10 bg-black/35 hover:-translate-y-1 hover:border-rose-400/60"
            >
              <img
                src={anime.cover}
                alt={anime.title}
                className="h-52 w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="p-2.5">
                <p className="line-clamp-2 text-sm font-semibold text-white">{anime.title}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-neutral-400">No hay videos en este genero.</p>
      )}
    </main>
  );
}

