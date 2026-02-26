import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

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

export default function SeriePage() {
  const router = useRouter();
  const { id } = router.query;
  const [anime, setAnime] = useState(null);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      const res = await fetch("/api/mock/read");
      const data = await res.json();
      const found = data.find((a) => a.id === id);
      setAnime(found);
    };

    load();
  }, [id]);

  const genres = useMemo(() => normalizeGenres(anime?.genre), [anime]);
  const orderedEpisodes = useMemo(
    () => [...(anime?.episodes || [])].sort(compareEpisodes),
    [anime]
  );

  if (!anime) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        Cargando serie...
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div
        className="absolute inset-0 bg-cover bg-center blur-3xl opacity-40"
        style={{
          backgroundImage: `url(${anime.cover})`,
          transform: "scale(1.2)",
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-neutral-900/90 to-neutral-950/95" />

      <div className="relative z-10 p-4 md:p-8">
        <div className="mb-8 flex flex-col items-center gap-6 md:flex-row md:items-start">
          <img
            src={anime.cover}
            alt={anime.title}
            className="h-80 w-60 rounded-xl object-cover shadow-[0_0_25px_rgba(255,0,128,0.3)] md:h-96 md:w-72"
          />

          <div className="max-w-2xl text-center md:text-left">
            <h1 className="mb-2 text-3xl font-bold text-pink-500 drop-shadow-[0_2px_6px_rgba(255,0,128,0.5)] md:text-5xl">
              {anime.title}
            </h1>

            <p className="mb-3 text-sm text-neutral-300 md:text-base">
              {anime.year} - {genres.length ? genres.join(", ") : "Genero no definido"}
            </p>

            <p className="mb-5 text-sm leading-relaxed text-neutral-200 md:text-base">
              {anime.description || anime.synopsis || "Sinopsis no disponible."}
            </p>

            {orderedEpisodes.length > 0 && (
              <button
                onClick={() => router.push(`/video/${orderedEpisodes[0].slug}`)}
                className="relative mx-auto flex items-center gap-2 overflow-hidden rounded-full bg-pink-600 px-6 py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:bg-pink-700 hover:shadow-[0_0_15px_rgba(255,0,128,0.4)] md:mx-0"
              >
                <span className="animate-pulsePlay text-lg">Play</span>
                Reproducir primer episodio
                <span className="pointer-events-none absolute inset-0 animate-shine bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 hover:opacity-100" />
              </button>
            )}
          </div>
        </div>

        <h2 className="mb-4 text-2xl font-semibold text-pink-400">Episodios</h2>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {orderedEpisodes.map((ep) => {
            const number = getEpisodeNumber(ep);
            const label = Number.isFinite(number) ? `Episodio ${number}` : ep.title;

            return (
              <div
                key={ep.slug}
                className="cursor-pointer rounded-lg border border-transparent bg-neutral-900/70 p-3 transition-all hover:border-pink-500/40 hover:bg-neutral-800/80"
                onClick={() => router.push(`/video/${ep.slug}`)}
              >
                <div className="mb-2 aspect-video overflow-hidden rounded-md bg-black shadow-md">
                  <img
                    src={ep.thumbnail || anime.cover}
                    alt={ep.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                <h3 className="truncate text-sm font-semibold text-neutral-100">{label}</h3>
                {ep.title && ep.title !== label && (
                  <p className="mt-1 truncate text-xs text-neutral-400">{ep.title}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulsePlay {
          0%,
          100% {
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
