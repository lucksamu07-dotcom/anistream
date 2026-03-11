import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { getEpisodePreviewUrl, getEpisodeThumbnail } from "../../lib/videoPreview";
import { fetchCatalog } from "../../lib/catalogClient";

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

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
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
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [hoveredEpisodeSlug, setHoveredEpisodeSlug] = useState("");
  const [lastEpisodeSlug, setLastEpisodeSlug] = useState("");
  const [episodeQuery, setEpisodeQuery] = useState("");
  const [episodeOrder, setEpisodeOrder] = useState("asc");

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setIsLoading(true);
      setLoadError("");

      try {
        const data = await fetchCatalog();
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error("No se pudo cargar el catalogo");
        }
        const found = data.find((a) => a.id === id);
        setAnime(found || null);
        if (!found) setLoadError("No se encontro esta serie.");
      } catch {
        setAnime(null);
        setLoadError("No se pudieron cargar los datos.");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [id]);

  const genres = useMemo(() => normalizeGenres(anime?.genre), [anime]);
  const orderedEpisodes = useMemo(
    () => [...(anime?.episodes || [])].sort(compareEpisodes),
    [anime]
  );
  const visibleEpisodes = useMemo(() => {
    const base = episodeOrder === "desc" ? [...orderedEpisodes].reverse() : orderedEpisodes;
    const term = normalizeText(episodeQuery);
    if (!term) return base;
    return base.filter((ep) => {
      const titleText = normalizeText(ep.title || "");
      const slugText = normalizeText(ep.slug || "");
      const numberText = String(getEpisodeNumber(ep) || "");
      return titleText.includes(term) || slugText.includes(term) || numberText.includes(term);
    });
  }, [orderedEpisodes, episodeOrder, episodeQuery]);
  const resumeEpisode = useMemo(
    () => orderedEpisodes.find((ep) => ep.slug === lastEpisodeSlug) || null,
    [orderedEpisodes, lastEpisodeSlug]
  );

  useEffect(() => {
    if (!anime?.id || typeof window === "undefined") return;
    const raw = JSON.parse(localStorage.getItem("animeLastEpisode") || "{}");
    setLastEpisodeSlug(String(raw?.[anime.id] || ""));
  }, [anime?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        Cargando serie...
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4 text-center">
        {loadError || "Serie no disponible."}
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <Head>
        <title>{`${anime.title} | AniStream+`}</title>
        <meta
          name="description"
          content={String(anime.description || anime.synopsis || "Serie disponible en AniStream+").slice(0, 160)}
        />
        <meta property="og:title" content={`${anime.title} | AniStream+`} />
      </Head>

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
              {anime.year || "Ano n/d"}
            </p>
            {genres.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {genres.map((genre) => (
                  <Link
                    key={genre}
                    href={`/categoria/${encodeURIComponent(genre)}`}
                    className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-neutral-200 hover:border-rose-400/60 hover:bg-white/10"
                  >
                    {genre}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-sm text-neutral-400">Genero no definido</p>
            )}
            {anime.updatedAt ? (
              <p className="mb-3 text-xs text-neutral-400">
                Actualizado: {new Date(anime.updatedAt).toLocaleDateString("es-ES")}
              </p>
            ) : null}

            <p className="mb-5 text-sm leading-relaxed text-neutral-200 md:text-base">
              {anime.description || anime.synopsis || "Sinopsis no disponible."}
            </p>

            {orderedEpisodes.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => router.push(`/video/${orderedEpisodes[0].slug}`)}
                  className="relative mx-auto flex items-center gap-2 overflow-hidden rounded-full bg-pink-600 px-6 py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:bg-pink-700 hover:shadow-[0_0_15px_rgba(255,0,128,0.4)] md:mx-0"
                >
                  <span className="animate-pulsePlay text-lg">Play</span>
                  Reproducir primer episodio
                  <span className="pointer-events-none absolute inset-0 animate-shine bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 hover:opacity-100" />
                </button>
                {resumeEpisode && (
                  <button
                    onClick={() => router.push(`/video/${resumeEpisode.slug}`)}
                    className="rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold hover:bg-white/20"
                  >
                    Continuar donde quedaste
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-pink-400">Episodios</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-300">
            <span>Total: {orderedEpisodes.length}</span>
            <span>Mostrando: {visibleEpisodes.length}</span>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <input
            className="w-full max-w-sm rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-400"
            placeholder="Buscar episodio..."
            value={episodeQuery}
            onChange={(e) => setEpisodeQuery(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs text-neutral-100 hover:bg-white/20"
            onClick={() => setEpisodeOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
          >
            Orden: {episodeOrder === "asc" ? "Ascendente" : "Descendente"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs text-neutral-100 hover:bg-white/20"
            onClick={() => router.push("/#catalogo")}
          >
            Ir al catalogo
          </button>
        </div>

        {visibleEpisodes.length === 0 ? (
          <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-300">
            No hay episodios con ese filtro.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {visibleEpisodes.map((ep) => {
              const number = getEpisodeNumber(ep);
              const label = Number.isFinite(number) ? `Episodio ${number}` : ep.title;
              const thumb = getEpisodeThumbnail(ep, anime.cover);
              const previewUrl = getEpisodePreviewUrl(ep);
              const showPreview = hoveredEpisodeSlug === ep.slug && !!previewUrl;

              return (
                <div
                  key={ep.slug}
                  className="group cursor-pointer rounded-lg border border-transparent bg-neutral-900/70 p-3 transition-all hover:border-pink-500/40 hover:bg-neutral-800/80"
                  onClick={() => router.push(`/video/${ep.slug}`)}
                  onMouseEnter={() => setHoveredEpisodeSlug(ep.slug)}
                  onMouseLeave={() => setHoveredEpisodeSlug("")}
                >
                  <div className="relative mb-2 aspect-video overflow-hidden rounded-md bg-black shadow-md">
                    <img
                      src={thumb}
                      alt={ep.title}
                      className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                        showPreview ? "opacity-0" : "opacity-100"
                      }`}
                    />
                    {showPreview && (
                      <video
                        src={previewUrl}
                        muted
                        autoPlay
                        loop
                        playsInline
                        preload="metadata"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                  </div>

                  <h3 className="truncate text-sm font-semibold text-neutral-100">{label}</h3>
                  {ep.title && ep.title !== label && (
                    <p className="mt-1 truncate text-xs text-neutral-400">{ep.title}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
