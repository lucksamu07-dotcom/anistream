import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import data from "../data/videos.json";
import { trackEvent } from "../lib/analytics";

const LETTER_FILTERS = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];
const HERO_LIMIT = 10;
const HERO_INTERVAL_MS = 5000;
const ITEMS_PER_PAGE = 20;

function normalizeText(value) {
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

function getInitialLetter(title) {
  const first = normalizeText(title).charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : "#";
}

function shortText(text, max = 140) {
  const value = String(text || "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

export default function Home() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCard, setActiveCard] = useState(null);
  const [genrePickerOpen, setGenrePickerOpen] = useState(false);
  const [genreSearch, setGenreSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [draftInitial, setDraftInitial] = useState("");
  const [draftYear, setDraftYear] = useState("");
  const [draftGenres, setDraftGenres] = useState([]);

  const [activeInitial, setActiveInitial] = useState("");
  const [activeYear, setActiveYear] = useState("");
  const [activeGenres, setActiveGenres] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);

  const [heroIndex, setHeroIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);

  const orderedAnimes = useMemo(() => [...data].reverse(), []);
  const heroAnimes = useMemo(() => orderedAnimes.slice(0, HERO_LIMIT), [orderedAnimes]);
  const activeHero = heroAnimes[heroIndex] || heroAnimes[0] || null;

  useEffect(() => {
    if (heroAnimes.length <= 1) return undefined;
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroAnimes.length);
    }, HERO_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [heroAnimes]);

  useEffect(() => {
    const onSetSearch = (event) => {
      const term = String(event?.detail?.term || "");
      setSearchTerm(term);
    };

    const scrollToCatalog = () => {
      const catalog = document.getElementById("catalogo");
      if (!catalog) return;
      const top = catalog.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top, behavior: "smooth" });
    };

    const onToggleFilters = (event) => {
      window.dispatchEvent(new CustomEvent("anistream:search-suppress"));
      const forced = event?.detail?.open;
      if (typeof forced === "boolean") setShowFilters(forced);
      else setShowFilters((prev) => !prev);
      scrollToCatalog();
    };

    const onForceCatalog = () => {
      window.dispatchEvent(new CustomEvent("anistream:search-suppress"));
      setShowFilters(true);
      scrollToCatalog();
    };

    const onHashChange = () => {
      if (window.location.hash === "#catalogo") {
        window.dispatchEvent(new CustomEvent("anistream:search-suppress"));
        setShowFilters(true);
        scrollToCatalog();
      }
    };

    window.addEventListener("anistream:set-search", onSetSearch);
    window.addEventListener("anistream:toggle-filters", onToggleFilters);
    window.addEventListener("anistream:force-catalog-open", onForceCatalog);
    window.addEventListener("hashchange", onHashChange);
    const shouldOpen = sessionStorage.getItem("anistream:open-filters");
    if (shouldOpen) {
      setShowFilters(true);
      window.dispatchEvent(new CustomEvent("anistream:search-suppress"));
      setTimeout(scrollToCatalog, 0);
      sessionStorage.removeItem("anistream:open-filters");
    }

    return () => {
      window.removeEventListener("anistream:set-search", onSetSearch);
      window.removeEventListener("anistream:toggle-filters", onToggleFilters);
      window.removeEventListener("anistream:force-catalog-open", onForceCatalog);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("anistream:sync-search", {
        detail: { term: searchTerm },
      })
    );
  }, [searchTerm]);

  useEffect(() => {
    if (searchTerm.trim() && !showFilters) {
      window.dispatchEvent(new CustomEvent("anistream:search-release"));
    }
  }, [searchTerm, showFilters]);

  useEffect(() => {
    if (showFilters) {
      window.dispatchEvent(new CustomEvent("anistream:filters-opened"));
    }
  }, [showFilters]);

  useEffect(() => {
    const hideSearch = () => window.dispatchEvent(new CustomEvent("anistream:search-suppress"));
    window.addEventListener("anistream:filters-opened", hideSearch);
    return () => window.removeEventListener("anistream:filters-opened", hideSearch);
  }, []);

  const availableGenres = useMemo(() => {
    const map = new Map();
    for (const anime of orderedAnimes) {
      for (const genre of extractAnimeGenres(anime)) {
        const key = normalizeText(genre);
        if (key && !map.has(key)) map.set(key, genre);
      }
    }
    return [...map.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));
  }, [orderedAnimes]);

  const availableYears = useMemo(() => {
    const unique = new Set(
      orderedAnimes
        .map((anime) => String(anime?.year || "").trim())
        .filter(Boolean)
    );
    return [...unique].sort((a, b) => Number(a) - Number(b));
  }, [orderedAnimes]);

  const visibleGenreOptions = useMemo(() => {
    const term = normalizeText(genreSearch);
    if (!term) return availableGenres;
    return availableGenres.filter((genre) => normalizeText(genre.label).includes(term));
  }, [availableGenres, genreSearch]);

  const filteredAnimes = useMemo(() => {
    const term = normalizeText(searchTerm);

    return orderedAnimes.filter((anime) => {
      const genres = extractAnimeGenres(anime);
      const genreKeys = new Set(genres.map((g) => normalizeText(g)));
      const genreText = genres.join(", ").toLowerCase();
      const descriptionText = String(anime.description || anime.synopsis || "").toLowerCase();
      const yearText = String(anime.year || "").toLowerCase();
      const titleText = String(anime.title || "").toLowerCase();

      const matchesSearch =
        !term ||
        titleText.includes(term) ||
        genreText.includes(term) ||
        descriptionText.includes(term) ||
        yearText.includes(term);
      const matchesInitial = !activeInitial || getInitialLetter(anime.title) === activeInitial;
      const matchesYear = !activeYear || String(anime.year || "") === activeYear;
      const matchesGenres =
        activeGenres.length === 0 || activeGenres.every((genreKey) => genreKeys.has(genreKey));

      return matchesSearch && matchesInitial && matchesYear && matchesGenres;
    });
  }, [orderedAnimes, searchTerm, activeInitial, activeYear, activeGenres]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeInitial, activeYear, activeGenres]);

  const totalPages = Math.max(1, Math.ceil(filteredAnimes.length / ITEMS_PER_PAGE));
  const paginatedAnimes = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAnimes.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAnimes, currentPage]);

  const toggleDraftGenre = (genreKey) => {
    setDraftGenres((prev) =>
      prev.includes(genreKey) ? prev.filter((item) => item !== genreKey) : [...prev, genreKey]
    );
  };

  const applyFilters = () => {
    if (draftGenres.length === 1 && !draftInitial && !draftYear && !searchTerm.trim()) {
      const target = availableGenres.find((g) => g.key === draftGenres[0]);
      if (target?.label) {
        router.push(`/categoria/${encodeURIComponent(target.label)}`);
        setShowFilters(false);
        return;
      }
    }
    setActiveInitial(draftInitial);
    setActiveYear(draftYear);
    setActiveGenres(draftGenres);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setDraftInitial("");
    setDraftYear("");
    setDraftGenres([]);
    setActiveInitial("");
    setActiveYear("");
    setActiveGenres([]);
    setGenreSearch("");
    setGenrePickerOpen(false);
  };

  const handleCardClick = (animeId) => {
    if (activeCard === animeId) {
      trackEvent("open_series", { animeId, source: "home_grid" });
      router.push(`/serie/${animeId}`);
      return;
    }
    setActiveCard(animeId);
    setTimeout(() => setActiveCard(null), 4200);
  };

  const prevHero = () => {
    if (heroAnimes.length === 0) return;
    setHeroIndex((prev) => (prev - 1 + heroAnimes.length) % heroAnimes.length);
  };

  const nextHero = () => {
    if (heroAnimes.length === 0) return;
    setHeroIndex((prev) => (prev + 1) % heroAnimes.length);
  };

  const onHeroTouchStart = (e) => {
    const point = e.touches?.[0];
    if (!point) return;
    setTouchStartX(point.clientX);
    setTouchEndX(point.clientX);
  };

  const onHeroTouchMove = (e) => {
    const point = e.touches?.[0];
    if (!point) return;
    setTouchEndX(point.clientX);
  };

  const onHeroTouchEnd = () => {
    if (touchStartX == null || touchEndX == null) return;
    const delta = touchStartX - touchEndX;
    const threshold = 45;
    if (Math.abs(delta) >= threshold) {
      if (delta > 0) nextHero();
      else prevHero();
    }
    setTouchStartX(null);
    setTouchEndX(null);
  };

  return (
    <>
      <Head>
        <title>AniStream+</title>
        <meta name="description" content="Catalogo de hentai online con series, episodios y buscador rapido." />
        <meta property="og:title" content="AniStream+ | Catalogo" />
        <meta property="og:description" content="Explora series y episodios en AniStream+." />
      </Head>

      <main className="mx-auto max-w-7xl px-3 py-3 text-white sm:px-4 sm:py-6" id="catalogo">
        <div className="mb-3 md:hidden">
          <button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm font-medium hover:bg-white/20"
          >
            Filtros
          </button>
        </div>

        <section className={`relative z-30 mb-4 mr-auto w-full max-w-3xl rounded-2xl glass p-2.5 sm:mb-5 sm:p-4 ${showFilters ? "block" : "hidden"} ${genrePickerOpen ? "mb-8" : ""}`}>

          {showFilters && (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
              <div className="mb-4 flex flex-wrap gap-2">
                {LETTER_FILTERS.map((letter) => {
                  const active = draftInitial === letter;
                  return (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => setDraftInitial((prev) => (prev === letter ? "" : letter))}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold sm:text-sm ${
                        active ? "bg-rose-500 text-white" : "bg-white/10 text-neutral-200 hover:bg-white/20"
                      }`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={() => setGenrePickerOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm"
                  >
                    <span>
                      Genero: {draftGenres.length > 0 ? `${draftGenres.length} seleccionados` : "Seleccionar"}
                    </span>
                    <span className="text-neutral-300">{genrePickerOpen ? "-" : "+"}</span>
                  </button>

                  {genrePickerOpen && (
                    <div className="mt-2 w-full rounded-xl border border-white/10 bg-[#161112] p-3 shadow-2xl">
                      <input
                        type="text"
                        value={genreSearch}
                        onChange={(e) => setGenreSearch(e.target.value)}
                        placeholder="Buscar genero..."
                        className="mb-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
                      />
                      <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                        {visibleGenreOptions.map((genre) => (
                          <label
                            key={genre.key}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5"
                          >
                            <input
                              type="checkbox"
                              checked={draftGenres.includes(genre.key)}
                              onChange={() => toggleDraftGenre(genre.key)}
                            />
                            <span className="text-sm text-neutral-100">{genre.label}</span>
                          </label>
                        ))}
                        {visibleGenreOptions.length === 0 && (
                          <p className="px-2 py-2 text-sm text-neutral-400">No hay coincidencias.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <select
                  value={draftYear}
                  onChange={(e) => setDraftYear(e.target.value)}
                  className="rounded-lg border border-white/10 bg-[#141112] px-3 py-2 text-xs text-neutral-100 outline-none"
                >
                  <option value="">Ano: Seleccionar</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={applyFilters}
                  className="rounded-lg bg-gradient-to-r from-rose-500 to-orange-500 px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
                >
                  Aplicar
                </button>
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-md border border-white/20 px-2.5 py-1 text-xs text-neutral-300 hover:text-white sm:text-sm"
                >
                  Limpiar filtros
                </button>
              </div>
            </div>
          )}
        </section>

        {activeHero && (
          <section
            className="relative mb-5 overflow-hidden rounded-2xl border border-white/10"
            onTouchStart={onHeroTouchStart}
            onTouchMove={onHeroTouchMove}
            onTouchEnd={onHeroTouchEnd}
          >
            <div
              className="h-[300px] bg-cover bg-center sm:h-[420px] md:h-[500px]"
              style={{ backgroundImage: `url(${activeHero.cover})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/92 via-black/58 to-black/18" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0607]/95 via-transparent to-transparent" />

            <div className="absolute left-4 top-4 right-4 flex items-center justify-between gap-3 sm:left-8 sm:right-8">
              <div className="flex items-center gap-3">
                <span className="title-display text-2xl text-rose-300 sm:text-4xl">AniStream+</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={prevHero}
                  className="interactive min-h-[44px] rounded-xl border border-white/25 bg-black/40 px-3 py-2 text-sm text-white hover:bg-white/20"
                >
                  {"<"}
                </button>
                <button
                  type="button"
                  onClick={nextHero}
                  className="interactive min-h-[44px] rounded-xl border border-white/25 bg-black/40 px-3 py-2 text-sm text-white hover:bg-white/20"
                >
                  {">"}
                </button>
              </div>
            </div>

            <div className="absolute left-4 right-4 bottom-4 sm:left-8 sm:right-8 sm:bottom-6">
              <p className="mb-1 text-xs uppercase tracking-[0.22em] text-rose-300/90">Recomendado</p>
              <h1 className="mb-1 line-clamp-2 max-w-4xl text-2xl font-extrabold text-white sm:text-5xl">{activeHero.title}</h1>
              <p className="mb-2 text-xs text-neutral-300 sm:mb-3 sm:text-sm">
                {activeHero.year || "Ano desconocido"} • {extractAnimeGenres(activeHero).slice(0, 3).join(", ") || "Genero"}
              </p>
              <p className="mb-3 max-w-2xl line-clamp-3 text-xs text-neutral-200 sm:mb-4 sm:text-base">
                {shortText(activeHero.description || activeHero.synopsis, 170)}
              </p>
              <Link
                href={`/serie/${activeHero.id}`}
                className="inline-flex min-h-[42px] items-center rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-neutral-200"
              >
                Ver Hentai
              </Link>
            </div>

            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
              {heroAnimes.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setHeroIndex(idx)}
                  className={`h-1.5 w-7 rounded-full ${heroIndex === idx ? "bg-rose-400" : "bg-white/25"}`}
                  aria-label={`Ir a recomendado ${idx + 1}`}
                />
              ))}
            </div>
          </section>
        )}

        <p className="mb-4 text-xs text-neutral-400 sm:mb-5 sm:text-sm">
          {filteredAnimes.length} resultados • Pagina {currentPage} de {totalPages}
        </p>

        {paginatedAnimes.length > 0 ? (
          <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5">
            {paginatedAnimes.map((anime) => {
              const isActive = activeCard === anime.id;
              const genres = extractAnimeGenres(anime);

              return (
                <article
                  key={anime.id}
                  onClick={() => handleCardClick(anime.id)}
                  className={`group relative cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-[0_8px_30px_rgba(0,0,0,0.45)] hover:-translate-y-1 ${
                    isActive ? "ring-2 ring-rose-400" : ""
                  }`}
                >
                  <img
                    src={anime.cover}
                    alt={anime.title}
                    loading="lazy"
                    decoding="async"
                    className={`h-[250px] w-full object-cover sm:h-[300px] md:h-[330px] ${
                      isActive ? "scale-105" : "group-hover:scale-105"
                    }`}
                  />

                  <div
                    className={`absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black via-black/70 to-transparent p-3 sm:p-4 ${
                      isActive
                        ? "translate-y-0 opacity-100"
                        : "translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
                    }`}
                  >
                    <h2 className="mb-1 text-sm font-semibold text-white sm:text-base">{anime.title}</h2>
                    <p className="mb-2 text-[11px] text-neutral-300 sm:text-xs">
                      {anime.year} - {genres.length > 0 ? genres.join(", ") : "Desconocido"}
                    </p>
                    <p className="mb-3 line-clamp-3 text-[11px] text-neutral-300 sm:text-xs">
                      {anime.description}
                    </p>

                    <Link
                      href={`/serie/${anime.id}`}
                      className="rounded-lg bg-gradient-to-r from-rose-500 to-orange-500 px-3 py-1.5 text-center text-xs font-medium text-white hover:opacity-90"
                    >
                      Ver serie
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <p className="mt-10 text-center text-neutral-400">No se encontro ningun hentai con ese filtro.</p>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 pb-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="min-h-[40px] rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm disabled:opacity-40"
            >
              Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
              Math.max(0, currentPage - 3),
              Math.max(0, currentPage - 3) + 5
            ).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`rounded-lg px-3 py-2 text-sm ${
                  currentPage === page ? "bg-rose-500 text-white" : "border border-white/15 bg-white/5"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="min-h-[40px] rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        )}
      </main>
    </>
  );
}










