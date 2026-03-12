import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import data from "../data/videos.json";
import { trackEvent } from "../lib/analytics";

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

export default function Navbar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchSuppressed, setSearchSuppressed] = useState(false);
  const searchAreaRef = useRef(null);
  const mobileSearchAreaRef = useRef(null);
  const searchInputRef = useRef(null);
  const showSearch = !router.pathname.startsWith("/admin") && !router.pathname.startsWith("/login");

  useEffect(() => {
    const onSearchSync = (event) => {
      const value = String(event?.detail?.term || "");
      setSearchTerm(value);
    };
    window.addEventListener("anistream:sync-search", onSearchSync);
    return () => window.removeEventListener("anistream:sync-search", onSearchSync);
  }, []);

  useEffect(() => {
    const onFiltersOpen = () => setSearchFocused(false);
    window.addEventListener("anistream:filters-opened", onFiltersOpen);
    return () => window.removeEventListener("anistream:filters-opened", onFiltersOpen);
  }, []);

  useEffect(() => {
    const onSearchToggle = (event) => {
      const open = Boolean(event?.detail?.open);
      setSearchFocused(open);
    };
    window.addEventListener("anistream:search-toggle", onSearchToggle);
    return () => window.removeEventListener("anistream:search-toggle", onSearchToggle);
  }, []);

  useEffect(() => {
    const onSuppress = () => setSearchSuppressed(true);
    const onRelease = () => setSearchSuppressed(false);
    window.addEventListener("anistream:search-suppress", onSuppress);
    window.addEventListener("anistream:search-release", onRelease);
    return () => {
      window.removeEventListener("anistream:search-suppress", onSuppress);
      window.removeEventListener("anistream:search-release", onRelease);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const desktopArea = searchAreaRef.current;
      const mobileArea = mobileSearchAreaRef.current;
      if (!desktopArea && !mobileArea) return;
      if (desktopArea?.contains(event.target) || mobileArea?.contains(event.target)) return;
      setSearchFocused(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleRouteChange = () => {
      setSearchFocused(false);
      setSearchSuppressed(false);
    };
    router.events.on("routeChangeStart", handleRouteChange);
    return () => router.events.off("routeChangeStart", handleRouteChange);
  }, [router.events]);

  const orderedAnimes = useMemo(() => [...data].reverse(), []);
  const liveSuggestions = useMemo(() => {
    const term = normalizeText(searchTerm);
    if (!term) return [];

    const scored = orderedAnimes.map((anime) => {
      const titleNorm = normalizeText(anime.title);
      const genreNorm = normalizeText(extractAnimeGenres(anime).join(" "));
      const descriptionNorm = normalizeText(anime.description || anime.synopsis || "");
      let score = 0;

      if (titleNorm === term) score = 300;
      else if (titleNorm.startsWith(term)) score = 220;
      else if (titleNorm.includes(term)) score = 170;
      else if (genreNorm.includes(term)) score = 110;
      else if (descriptionNorm.includes(term)) score = 70;

      return { anime, score };
    });

    return scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 7)
      .map((item) => item.anime);
  }, [orderedAnimes, searchTerm]);

  const onSearchChange = (value) => {
    setSearchTerm(value);
    trackEvent("search_input", { termLength: String(value || "").trim().length });
    setSearchFocused(true);
    setSearchSuppressed(false);
    window.dispatchEvent(
      new CustomEvent("anistream:set-search", {
        detail: { term: value },
      })
    );
  };

  const onToggleFilters = () => {
    setSearchFocused(false);
    setSearchSuppressed(true);
    if (searchInputRef.current) searchInputRef.current.blur();
    if (typeof window !== "undefined") {
      sessionStorage.setItem("anistream:open-filters", "1");
    }
    window.dispatchEvent(new CustomEvent("anistream:force-catalog-open"));
    if (router.pathname !== "/") {
      router.push("/#catalogo");
      return;
    }
    window.location.hash = "catalogo";
    window.dispatchEvent(new CustomEvent("anistream:toggle-filters", { detail: { open: true } }));
    const catalog = document.getElementById("catalogo");
    if (catalog) {
      catalog.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#0c090a]/88 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="interactive flex items-end gap-1 text-lg font-bold tracking-tight hover:opacity-90"
            onClick={() => setOpen(false)}
          >
            <span className="title-display text-2xl leading-none text-white">Ani</span>
            <span className="title-display text-2xl leading-none text-rose-400">Stream+</span>
          </Link>

          {showSearch && (
            <div ref={searchAreaRef} className="relative hidden w-[350px] lg:w-[380px] md:block">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3-3" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar hentai..."
                  className="w-full bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-400"
                  value={searchTerm}
                  onFocus={() => setSearchFocused(true)}
                  onChange={(e) => onSearchChange(e.target.value)}
                />
                <button
                  type="button"
                  onClick={onToggleFilters}
                  className="rounded-lg border border-white/10 bg-white/10 px-2.5 py-1 text-xs text-neutral-100 hover:bg-white/20"
                >
                  Filtros
                </button>
              </div>

              {searchFocused && searchTerm.trim() && !searchSuppressed && (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] overflow-hidden rounded-xl border border-white/10 bg-[#130f11]/95 shadow-2xl">
                  <div className="max-h-[340px] overflow-y-auto p-2">
                    {liveSuggestions.length > 0 ? (
                      liveSuggestions.map((anime) => (
                        <button
                          key={anime.id}
                          type="button"
                          onClick={() => {
                            trackEvent("search_select", { animeId: anime.id, term: searchTerm });
                            router.push(`/serie/${anime.id}`);
                          }}
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/10"
                        >
                          <img src={anime.cover} alt={anime.title} className="h-12 w-9 rounded object-cover" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{anime.title}</p>
                            <p className="truncate text-xs text-neutral-300">
                              {anime.year || "Ano n/d"} - {extractAnimeGenres(anime).slice(0, 2).join(", ") || "Sin genero"}
                            </p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="px-2 py-2 text-sm text-neutral-400">No hay coincidencias.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="interactive inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-neutral-100 md:hidden"
          aria-expanded={open}
          aria-label="Abrir menu"
        >
          Menu
        </button>

        <nav className="hidden items-center gap-4 text-sm text-neutral-300 md:flex">
          <Link
            href="/"
            className={`interactive rounded-lg px-3 py-1.5 hover:bg-white/5 hover:text-white ${
              router.pathname === "/" ? "bg-white/5 text-white" : ""
            }`}
          >
            Inicio
          </Link>
          <Link href="/#catalogo" className="interactive rounded-lg px-3 py-1.5 hover:bg-white/5 hover:text-white">
            Catalogo
          </Link>
          <Link
            href="/dmca"
            className={`interactive rounded-lg px-3 py-1.5 hover:bg-white/5 hover:text-white ${
              router.pathname === "/dmca" ? "bg-white/5 text-white" : ""
            }`}
          >
            DMCA
          </Link>
          <Link
            href="/favoritos"
            className={`interactive rounded-lg px-3 py-1.5 hover:bg-rose-500/20 ${
              router.pathname === "/favoritos" ? "bg-rose-500/20 text-rose-200" : "bg-rose-500/10 text-rose-300"
            }`}
          >
            Favoritos
          </Link>
        </nav>
      </div>

      {showSearch && (
        <div ref={mobileSearchAreaRef} className="relative px-4 pb-3 md:hidden">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3-3" />
            </svg>
            <input
              type="text"
              placeholder="Buscar hentai..."
              className="w-full bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-400"
              value={searchTerm}
              onFocus={() => setSearchFocused(true)}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            <button
              type="button"
              onClick={onToggleFilters}
              className="rounded-lg border border-white/10 bg-white/10 px-2.5 py-1 text-xs text-neutral-100 hover:bg-white/20"
            >
              Filtros
            </button>
          </div>

          {searchFocused && searchTerm.trim() && !searchSuppressed && (
            <div className="absolute left-4 right-4 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-white/10 bg-[#130f11]/95 shadow-2xl">
              <div className="max-h-[340px] overflow-y-auto p-2">
                {liveSuggestions.length > 0 ? (
                  liveSuggestions.map((anime) => (
                    <button
                      key={anime.id}
                      type="button"
                      onClick={() => {
                        trackEvent("search_select", { animeId: anime.id, term: searchTerm });
                        router.push(`/serie/${anime.id}`);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/10"
                    >
                      <img src={anime.cover} alt={anime.title} className="h-12 w-9 rounded object-cover" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{anime.title}</p>
                        <p className="truncate text-xs text-neutral-300">
                          {anime.year || "Ano n/d"} - {extractAnimeGenres(anime).slice(0, 2).join(", ") || "Sin genero"}
                        </p>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-2 text-sm text-neutral-400">No hay coincidencias.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {open && (
        <nav className="fluid-enter mx-auto flex max-w-7xl flex-col gap-2 px-4 pb-3 text-sm text-neutral-200 md:hidden">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="interactive rounded-lg bg-white/5 px-3 py-2 hover:bg-white/10"
          >
            Inicio
          </Link>
          <Link
            href="/#catalogo"
            onClick={() => setOpen(false)}
            className="interactive rounded-lg bg-white/5 px-3 py-2 hover:bg-white/10"
          >
            Catalogo
          </Link>
          <Link
            href="/dmca"
            onClick={() => setOpen(false)}
            className="interactive rounded-lg bg-white/5 px-3 py-2 hover:bg-white/10"
          >
            DMCA
          </Link>
          <Link
            href="/favoritos"
            onClick={() => setOpen(false)}
            className="interactive rounded-lg bg-rose-500/10 px-3 py-2 text-rose-300 hover:bg-rose-500/20"
          >
            Favoritos
          </Link>
        </nav>
      )}
    </header>
  );
}
