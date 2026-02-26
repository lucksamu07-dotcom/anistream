import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

const AUTO_ACCEPT_THRESHOLD = 0.8;

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toId(text) {
  return normalizeText(text).replace(/\s+/g, "-");
}

function splitGenres(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map((x) => String(x).trim());
  return String(value || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function similarity(a, b) {
  const ta = new Set(normalizeText(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const t of ta) {
    if (tb.has(t)) common += 1;
  }
  return common / Math.max(ta.size, tb.size);
}

function computeClientConfidence(queryTitle, metadata) {
  const titleScore = similarity(queryTitle, metadata?.title || "");
  const yearScore = metadata?.year ? 0.15 : 0;
  const genreScore = Array.isArray(metadata?.genre) && metadata.genre.length > 0 ? 0.15 : 0;
  const coverScore = metadata?.cover ? 0.15 : 0;
  const episodesScore = Array.isArray(metadata?.episodes) ? Math.min(0.25, metadata.episodes.length * 0.04) : 0;
  return Math.max(0, Math.min(1, titleScore * 0.3 + yearScore + genreScore + coverScore + episodesScore));
}

function mergeAnimeByTitle(catalog, incomingAnime) {
  const normTitle = normalizeText(incomingAnime?.title || "");
  const existing = catalog.find((a) => normalizeText(a.title) === normTitle);
  if (!existing) return [...catalog, incomingAnime];

  const episodes = [...(Array.isArray(existing.episodes) ? existing.episodes : [])];
  for (const ep of Array.isArray(incomingAnime.episodes) ? incomingAnime.episodes : []) {
    const found = episodes.find(
      (x) =>
        (ep.slug && x.slug && ep.slug === x.slug) ||
        (ep.sourceUrl && x.sourceUrl && ep.sourceUrl === x.sourceUrl) ||
        similarity(ep.title, x.title) >= 0.95
    );
    if (!found) episodes.push(ep);
  }

  return catalog.map((anime) => {
    if (anime.id !== existing.id) return anime;
    return {
      ...anime,
      year: anime.year || incomingAnime.year || "",
      cover: anime.cover || incomingAnime.cover || "",
      description: anime.description || incomingAnime.description || "",
      genre: [...new Set([...(anime.genre || []), ...(incomingAnime.genre || [])])],
      episodes,
      updatedAt: new Date().toISOString(),
    };
  });
}

export default function Admin() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncMessage, setSyncMessage] = useState("");

  const [animes, setAnimes] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [audit, setAudit] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [discovered, setDiscovered] = useState([]);
  const [selectedAnime, setSelectedAnime] = useState("");
  const [jobs, setJobs] = useState([]);

  const [newAnime, setNewAnime] = useState({
    title: "",
    year: "",
    genre: "",
    description: "",
    cover: "",
    episodes: [],
  });
  const [newEpisode, setNewEpisode] = useState({ title: "", sourceUrl: "" });
  const [lookupResult, setLookupResult] = useState(null);

  const [filters, setFilters] = useState({
    q: "",
    year: "",
    state: "all",
    genres: [],
    genresMode: "all",
    sort: "recent",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isLoggedIn = localStorage.getItem("loggedIn");
    if (isLoggedIn !== "true") {
      router.push("/login");
      return;
    }
    setToken(localStorage.getItem("adminApiToken") || "");
  }, [router]);

  const request = async (url, options = {}) => {
    const headers = {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    };
    if (token) headers["x-admin-token"] = token;
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "Error en solicitud");
    return data;
  };

  const refreshCore = async () => {
    const [catalog, dash, auditData, snapsData] = await Promise.all([
      request("/api/mock/read"),
      request("/api/mock/admin-dashboard"),
      request("/api/mock/admin-audit?limit=60"),
      request("/api/mock/admin-snapshots"),
    ]);
    setAnimes(Array.isArray(catalog) ? catalog : []);
    setDashboard(dash || null);
    setAudit(Array.isArray(auditData?.items) ? auditData.items : []);
    setSnapshots(Array.isArray(snapsData?.snapshots) ? snapsData.snapshots : []);
  };

  useEffect(() => {
    const load = async () => {
      try {
        await refreshCore();
      } catch (err) {
        setError(err.message || "Error cargando panel");
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const addJob = (type, label) => {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setJobs((prev) => [{ id, type, label, status: "pending", progress: 0, message: "En cola" }, ...prev]);
    return id;
  };

  const updateJob = (id, patch) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  };

  const runJob = async (type, label, fn) => {
    const id = addJob(type, label);
    try {
      updateJob(id, { status: "running", progress: 20, message: "Procesando..." });
      const out = await fn((progress, message) => updateJob(id, { progress, message }));
      updateJob(id, { status: "ok", progress: 100, message: "Completado" });
      return out;
    } catch (err) {
      updateJob(id, { status: "error", progress: 100, message: err.message || "Error" });
      throw err;
    }
  };

  const availableGenres = useMemo(() => {
    const set = new Set();
    for (const anime of animes) {
      for (const g of splitGenres(anime.genre)) set.add(g);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [animes]);

  const years = useMemo(() => {
    const set = new Set(animes.map((a) => String(a.year || "")).filter(Boolean));
    return [...set].sort((a, b) => Number(b) - Number(a));
  }, [animes]);

  const filteredAnimes = useMemo(() => {
    let list = [...animes];
    if (filters.year) list = list.filter((a) => String(a.year || "") === filters.year);
    if (filters.state === "complete") {
      list = list.filter((a) => a.description && a.cover && a.year && splitGenres(a.genre).length > 0);
    }
    if (filters.state === "incomplete") {
      list = list.filter((a) => !a.description || !a.cover || !a.year || splitGenres(a.genre).length === 0);
    }
    if (filters.genres.length > 0) {
      list = list.filter((a) => {
        const g = splitGenres(a.genre).map((x) => normalizeText(x));
        const selected = filters.genres.map((x) => normalizeText(x));
        if (filters.genresMode === "all") return selected.every((item) => g.includes(item));
        return selected.some((item) => g.includes(item));
      });
    }
    if (filters.q.trim()) {
      const q = filters.q.trim();
      list = list
        .map((a) => ({
          ...a,
          _score: Math.max(similarity(q, a.title), similarity(q, a.id), similarity(q, `${a.title} ${(a.genre || []).join(" ")}`)),
        }))
        .filter((a) => a._score >= 0.2)
        .sort((a, b) => b._score - a._score);
    }
    if (filters.sort === "episodes") list.sort((a, b) => (b.episodes?.length || 0) - (a.episodes?.length || 0));
    else if (filters.sort === "title") list.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
    else list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    return list;
  }, [animes, filters]);

  const selectedAnimeData = useMemo(() => animes.find((a) => a.id === selectedAnime) || null, [animes, selectedAnime]);

  const saveToFile = async () => {
    try {
      await request("/api/mock/write", { method: "POST", body: JSON.stringify(animes) });
      setSyncMessage("Cambios guardados correctamente");
      await refreshCore();
    } catch (err) {
      setSyncMessage(`Error al guardar: ${err.message}`);
    }
  };

  const handleLookup = async () => {
    const title = String(newAnime.title || "").trim();
    if (!title) return setSyncMessage("Escribe el nombre de la serie");
    try {
      const result = await runJob("lookup", `Autocompletar: ${title}`, async () =>
        request("/api/mock/enrich-one", { method: "POST", body: JSON.stringify({ title }) })
      );
      const confidence = Math.max(Number(result?.confidence || 0), computeClientConfidence(title, result?.metadata || {}));
      setLookupResult({ ...result, confidence, accepted: confidence >= AUTO_ACCEPT_THRESHOLD });
      setSyncMessage("Autocompletado terminado. Revisa los datos.");
    } catch (err) {
      setSyncMessage(`No se pudo autocompletar: ${err.message}`);
      setLookupResult(null);
    }
  };

  const applyLookupResult = () => {
    if (!lookupResult?.metadata) return;
    const meta = lookupResult.metadata;
    setNewAnime((prev) => ({
      ...prev,
      title: prev.title || meta.title || "",
      year: prev.year || meta.year || "",
      cover: prev.cover || meta.cover || "",
      description: prev.description || meta.description || "",
      genre: splitGenres(prev.genre).length > 0 ? prev.genre : splitGenres(meta.genre).join(", "),
      episodes: Array.isArray(prev.episodes) && prev.episodes.length > 0 ? prev.episodes : Array.isArray(meta.episodes) ? meta.episodes : [],
    }));
  };

  const handleAddAnime = () => {
    const title = String(newAnime.title || "").trim();
    if (!title) return setSyncMessage("Completa el titulo");
    const nextAnime = {
      id: toId(title),
      title,
      year: newAnime.year || "",
      genre: splitGenres(newAnime.genre),
      description: String(newAnime.description || "").trim(),
      cover: String(newAnime.cover || "").trim(),
      episodes: Array.isArray(newAnime.episodes) ? newAnime.episodes : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setAnimes((prev) => mergeAnimeByTitle(prev, nextAnime));
    setSyncMessage("Serie agregada/actualizada sin duplicados");
    setNewAnime({ title: "", year: "", genre: "", description: "", cover: "", episodes: [] });
    setLookupResult(null);
  };

  const discoverNew = async () => {
    try {
      const data = await runJob("discover", "Buscar nuevos hentai", async (progress) => {
        progress(35, "Consultando fuentes...");
        const result = await request("/api/mock/discover-new", {
          method: "POST",
          body: JSON.stringify({ existingTitles: animes.map((a) => a.title), limit: 30 }),
        });
        progress(85, "Procesando resultados...");
        return result;
      });
      const currentTitles = new Set(animes.map((a) => normalizeText(a.title)));
      const unique = (Array.isArray(data?.candidates) ? data.candidates : []).filter((c) => !currentTitles.has(normalizeText(c.title)));
      setDiscovered(unique);
      setSyncMessage(`Nuevos resultados: ${unique.length}`);
    } catch (err) {
      setSyncMessage(`Error en descubrimiento: ${err.message}`);
    }
  };

  const autoImport20 = async () => {
    try {
      const data = await runJob("auto-import", "Auto agregar 20 nuevos hentai", async (progress) => {
        progress(20, "Buscando nuevos...");
        const result = await request("/api/mock/discover-auto-import", {
          method: "POST",
          body: JSON.stringify({ count: 20 }),
        });
        progress(90, "Aplicando resultados al catalogo...");
        return result;
      });

      await refreshCore();
      setSyncMessage(
        `${data.message || "Proceso completado"} | Nuevos: ${data.added || 0} | Actualizados: ${data.updated || 0} | Omitidos: ${data.skipped || 0}`
      );
    } catch (err) {
      setSyncMessage(`Error en auto import: ${err.message}`);
    }
  };

  const addDiscovered = async (candidate) => {
    try {
      const data = await runJob("add-discovered", `Agregar: ${candidate.title}`, async () =>
        request("/api/mock/add-discovered", { method: "POST", body: JSON.stringify({ title: candidate.title }) })
      );
      setAnimes((prev) => mergeAnimeByTitle(prev, data.anime));
      setDiscovered((prev) => prev.filter((c) => c.title !== candidate.title));
      setSyncMessage(`Agregado: ${candidate.title}`);
    } catch (err) {
      setSyncMessage(`No se pudo agregar: ${err.message}`);
    }
  };

  const autoFillEpisodes = async () => {
    if (!selectedAnimeData?.title) return setSyncMessage("Selecciona una serie");
    try {
      const data = await runJob("episodes", `Extraer episodios: ${selectedAnimeData.title}`, async () =>
        request("/api/mock/enrich-episodes", { method: "POST", body: JSON.stringify({ title: selectedAnimeData.title }) })
      );
      const incoming = Array.isArray(data?.episodes) ? data.episodes : [];
      setAnimes((prev) =>
        prev.map((a) => (a.id === selectedAnimeData.id ? (mergeAnimeByTitle(prev, { ...a, episodes: incoming }).find((x) => x.id === a.id) || a) : a))
      );
      setSyncMessage(`Episodios encontrados: ${incoming.length}`);
    } catch (err) {
      setSyncMessage(`Error extrayendo episodios: ${err.message}`);
    }
  };

  const repairUrls = async () => {
    if (!selectedAnimeData?.title) return setSyncMessage("Selecciona una serie");
    try {
      const data = await runJob("repair", `Reparar URLs: ${selectedAnimeData.title}`, async () =>
        request("/api/mock/repair-episode-urls", {
          method: "POST",
          body: JSON.stringify({ title: selectedAnimeData.title, episodes: selectedAnimeData.episodes || [] }),
        })
      );
      setAnimes((prev) =>
        prev.map((a) => (a.id === selectedAnimeData.id ? { ...a, episodes: data.updatedEpisodes || a.episodes, updatedAt: new Date().toISOString() } : a))
      );
      setSyncMessage(`URLs reparadas: ${data.replacedCount || 0}`);
    } catch (err) {
      setSyncMessage(`Error reparando URLs: ${err.message}`);
    }
  };

  const validateUrls = async () => {
    try {
      const data = await runJob("validate", "Validar estado de URLs", async () =>
        request("/api/mock/admin-validate-urls", { method: "POST", body: JSON.stringify({ animeId: selectedAnime || "" }) })
      );
      setSyncMessage(`Validacion completada. Revisadas: ${data.checked}, caidas: ${data.down}`);
      await refreshCore();
    } catch (err) {
      setSyncMessage(`Error validando URLs: ${err.message}`);
    }
  };

  const handleAddEpisode = () => {
    if (!selectedAnimeData) return setSyncMessage("Selecciona una serie");
    if (!String(newEpisode.title || "").trim()) return setSyncMessage("Escribe el titulo del episodio");
    const nextEp = {
      id: `ep${(selectedAnimeData.episodes?.length || 0) + 1}`,
      title: newEpisode.title,
      slug: `${selectedAnimeData.id}-ep${(selectedAnimeData.episodes?.length || 0) + 1}`,
      sourceUrl: String(newEpisode.sourceUrl || "").trim(),
      sources: newEpisode.sourceUrl ? [{ label: "Principal", url: newEpisode.sourceUrl, language: "original", status: "unknown" }] : [],
      updatedAt: new Date().toISOString(),
    };
    setAnimes((prev) =>
      prev.map((a) => (a.id === selectedAnimeData.id ? { ...a, episodes: [...(a.episodes || []), nextEp], updatedAt: new Date().toISOString() } : a))
    );
    setNewEpisode({ title: "", sourceUrl: "" });
  };

  const handleRollback = async (snapshot) => {
    if (!confirm(`Restaurar snapshot ${snapshot}?`)) return;
    try {
      await request("/api/mock/admin-snapshots", { method: "POST", body: JSON.stringify({ snapshot }) });
      setSyncMessage(`Rollback aplicado desde ${snapshot}`);
      await refreshCore();
    } catch (err) {
      setSyncMessage(`Error en rollback: ${err.message}`);
    }
  };

  const removeAnime = (animeId) => {
    if (!confirm("Eliminar esta serie?")) return;
    setAnimes((prev) => prev.filter((a) => a.id !== animeId));
    if (selectedAnime === animeId) setSelectedAnime("");
  };

  const logout = () => {
    localStorage.removeItem("loggedIn");
    router.push("/login");
  };

  if (loading) return <div className="min-h-screen bg-neutral-950 p-8 text-white">Cargando admin...</div>;
  if (error) return <div className="min-h-screen bg-neutral-950 p-8 text-red-300">{error}</div>;

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-white">
      <h1 className="mb-4 text-3xl font-bold text-pink-500">Admin AniStream+</h1>

      <div className="mb-4 grid gap-3 rounded-xl bg-neutral-900 p-4 md:grid-cols-3">
        <input
          className="input"
          type="password"
          placeholder="Token admin (opcional si definiste ADMIN_API_TOKEN)"
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
            localStorage.setItem("adminApiToken", e.target.value);
          }}
        />
        <button className="btn bg-slate-700 hover:bg-slate-600" onClick={refreshCore}>
          Refrescar panel
        </button>
        <button className="btn bg-green-600 hover:bg-green-700" onClick={saveToFile}>
          Guardar cambios
        </button>
      </div>

      {syncMessage && <p className="mb-4 text-sm text-neutral-300">{syncMessage}</p>}

      {dashboard?.kpis && (
        <div className="mb-6 grid gap-3 rounded-xl bg-neutral-900 p-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="kpi"><span>Series</span><strong>{dashboard.kpis.animesTotal}</strong></div>
          <div className="kpi"><span>Episodios</span><strong>{dashboard.kpis.episodesTotal}</strong></div>
          <div className="kpi"><span>Sin URL</span><strong>{dashboard.kpis.episodesWithoutUrl}</strong></div>
          <div className="kpi"><span>Fuentes caidas</span><strong>{dashboard.kpis.brokenSources}</strong></div>
          <div className="kpi"><span>Metadata incompleta</span><strong>{dashboard.kpis.metadataIncomplete}</strong></div>
          <div className="kpi"><span>Generos</span><strong>{dashboard.kpis.genresTotal}</strong></div>
        </div>
      )}

      <div className="mb-6 rounded-xl bg-neutral-900 p-4">
        <h2 className="mb-3 text-xl font-semibold">Busqueda y filtros avanzados</h2>
        <div className="grid gap-3 md:grid-cols-5">
          <input className="input md:col-span-2" placeholder="Buscar por titulo / ID / genero" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          <select className="input" value={filters.year} onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}>
            <option value="">Todos los años</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="input" value={filters.state} onChange={(e) => setFilters((f) => ({ ...f, state: e.target.value }))}>
            <option value="all">Todos</option>
            <option value="complete">Completos</option>
            <option value="incomplete">Incompletos</option>
          </select>
          <select className="input" value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}>
            <option value="recent">Orden: Reciente</option>
            <option value="episodes">Orden: Mas episodios</option>
            <option value="title">Orden: Titulo</option>
          </select>
        </div>

        <div className="mt-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-400">Generos:</span>
            <button className={`chip ${filters.genresMode === "all" ? "chip-on" : ""}`} onClick={() => setFilters((f) => ({ ...f, genresMode: "all" }))}>Coincidir todos (AND)</button>
            <button className={`chip ${filters.genresMode === "any" ? "chip-on" : ""}`} onClick={() => setFilters((f) => ({ ...f, genresMode: "any" }))}>Coincidir alguno (OR)</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableGenres.map((genre) => {
              const selected = filters.genres.includes(genre);
              return (
                <button
                  key={genre}
                  className={`chip ${selected ? "chip-on" : ""}`}
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      genres: selected ? f.genres.filter((g) => g !== genre) : [...f.genres, genre],
                    }))
                  }
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 rounded-xl bg-neutral-900 p-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-xl font-semibold">Agregar serie (manual + autocompletar)</h2>
          <div className="grid gap-2 md:grid-cols-2">
            <input className="input md:col-span-2" placeholder="Titulo" value={newAnime.title} onChange={(e) => setNewAnime((a) => ({ ...a, title: e.target.value }))} />
            <input className="input" placeholder="Año" value={newAnime.year} onChange={(e) => setNewAnime((a) => ({ ...a, year: e.target.value }))} />
            <input className="input" placeholder="Generos (coma)" value={newAnime.genre} onChange={(e) => setNewAnime((a) => ({ ...a, genre: e.target.value }))} />
            <input className="input md:col-span-2" placeholder="Portada URL" value={newAnime.cover} onChange={(e) => setNewAnime((a) => ({ ...a, cover: e.target.value }))} />
          </div>
          <textarea className="input mt-2" rows={3} placeholder="Descripcion" value={newAnime.description} onChange={(e) => setNewAnime((a) => ({ ...a, description: e.target.value }))} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn bg-indigo-600 hover:bg-indigo-700" onClick={handleLookup}>Buscar y autocompletar</button>
            <button className="btn bg-pink-600 hover:bg-pink-700" onClick={handleAddAnime}>Agregar / consolidar</button>
          </div>
          {lookupResult?.metadata && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3 text-sm">
              <p className="text-neutral-400">
                Fuente: {lookupResult.source || "-"} | Confianza: <span className={lookupResult.accepted ? "text-green-400" : "text-amber-400"}>{(Number(lookupResult.confidence || 0) * 100).toFixed(1)}%</span>
              </p>
              <p>Titulo detectado: {lookupResult.metadata.title || "-"}</p>
              <p>Episodios detectados: {Array.isArray(lookupResult.metadata.episodes) ? lookupResult.metadata.episodes.length : 0}</p>
              {lookupResult.metadata.cover ? <img src={lookupResult.metadata.cover} alt="cover" className="mt-2 h-32 w-24 rounded object-cover" /> : null}
              <button className="btn mt-2 bg-emerald-600 hover:bg-emerald-700" onClick={applyLookupResult}>Aplicar datos</button>
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">Automatizacion</h2>
          <div className="flex flex-wrap gap-2">
            <button className="btn bg-violet-600 hover:bg-violet-700" onClick={discoverNew}>Buscar nuevos hentai</button>
            <button className="btn bg-fuchsia-600 hover:bg-fuchsia-700" onClick={autoImport20}>Auto agregar 20 (validado)</button>
            <button className="btn bg-cyan-600 hover:bg-cyan-700" onClick={autoFillEpisodes}>Extraer episodios</button>
            <button className="btn bg-blue-600 hover:bg-blue-700" onClick={repairUrls}>Reparar URLs</button>
            <button className="btn bg-sky-600 hover:bg-sky-700" onClick={validateUrls}>Validar URLs</button>
          </div>

          <div className="mt-4">
            <h3 className="mb-2 font-semibold">Cola de tareas</h3>
            <div className="max-h-52 space-y-2 overflow-auto pr-1">
              {jobs.length === 0 && <p className="text-sm text-neutral-400">Sin tareas aun.</p>}
              {jobs.map((job) => (
                <div key={job.id} className="rounded bg-neutral-800 p-2 text-xs">
                  <p className="font-semibold">{job.label}</p>
                  <p className="text-neutral-300">{job.message}</p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-neutral-700">
                    <div
                      className={`h-full ${job.status === "error" ? "bg-red-500" : job.status === "ok" ? "bg-emerald-500" : "bg-pink-500"}`}
                      style={{ width: `${job.progress || 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {discovered.length > 0 && (
        <div className="mb-6 rounded-xl bg-neutral-900 p-4">
          <h2 className="mb-2 text-xl font-semibold">Resultados nuevos encontrados</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {discovered.map((item) => (
              <div key={item.title} className="rounded bg-neutral-800 p-2">
                {item.cover ? <img src={item.cover} alt={item.title} className="mb-2 h-40 w-full rounded object-cover" /> : <div className="mb-2 flex h-40 items-center justify-center rounded bg-neutral-700 text-xs text-neutral-400">Sin portada</div>}
                <p className="line-clamp-2 text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-neutral-400">
                  {item.year || "Año n/d"} | {(Number(item.confidence || 0) * 100).toFixed(0)}%
                </p>
                <button className="btn mt-2 w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => addDiscovered(item)}>Agregar a AniStream</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6 rounded-xl bg-neutral-900 p-4">
        <h2 className="mb-2 text-xl font-semibold">Catalogo ({filteredAnimes.length})</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {filteredAnimes.map((a) => (
            <div key={a.id} className="rounded-lg bg-neutral-800 p-2">
              {a.cover ? <img src={a.cover} alt={a.title} className="mb-2 h-40 w-full rounded object-cover" /> : <div className="mb-2 flex h-40 items-center justify-center rounded bg-neutral-700 text-xs text-neutral-400">Sin portada</div>}
              <p className="line-clamp-2 text-sm font-semibold">{a.title}</p>
              <p className="text-xs text-neutral-400">
                {a.year || "Sin año"} | {(a.episodes || []).length} eps
              </p>
              <p className="line-clamp-1 text-xs text-neutral-500">{splitGenres(a.genre).join(", ") || "Sin genero"}</p>
              <div className="mt-2 flex gap-2">
                <button className={`btn w-full ${selectedAnime === a.id ? "bg-pink-700" : "bg-neutral-700 hover:bg-neutral-600"}`} onClick={() => setSelectedAnime(a.id)}>
                  {selectedAnime === a.id ? "Seleccionado" : "Gestionar"}
                </button>
                <button className="btn bg-red-700 hover:bg-red-600" onClick={() => removeAnime(a.id)}>Borrar</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedAnimeData && (
        <div className="mb-6 rounded-xl bg-neutral-900 p-4">
          <h2 className="mb-2 text-xl font-semibold">Episodios de {selectedAnimeData.title}</h2>
          <div className="space-y-2">
            {(selectedAnimeData.episodes || []).map((ep) => (
              <div key={ep.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-neutral-800 p-2 text-sm">
                <div>
                  <p>{ep.title}</p>
                  <p className="text-xs text-neutral-400">{ep.sourceUrl || "Sin URL"}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(ep.sources || []).slice(0, 3).map((s) => (
                    <span key={`${ep.id}-${s.url}`} className={`rounded px-2 py-0.5 text-[10px] ${s.status === "up" ? "bg-emerald-700/60" : s.status === "down" ? "bg-red-700/60" : "bg-neutral-700"}`}>
                      {s.label}: {s.status || "unknown"}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            <input className="input" placeholder="Nuevo episodio titulo" value={newEpisode.title} onChange={(e) => setNewEpisode((x) => ({ ...x, title: e.target.value }))} />
            <input className="input" placeholder="URL video (opcional)" value={newEpisode.sourceUrl} onChange={(e) => setNewEpisode((x) => ({ ...x, sourceUrl: e.target.value }))} />
          </div>
          <button className="btn mt-2 bg-pink-600 hover:bg-pink-700" onClick={handleAddEpisode}>Agregar episodio manual</button>
        </div>
      )}

      <div className="mb-6 grid gap-4 rounded-xl bg-neutral-900 p-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-xl font-semibold">Auditoria</h2>
          <div className="max-h-52 space-y-2 overflow-auto pr-1 text-sm">
            {audit.map((item) => (
              <div key={item.id} className="rounded bg-neutral-800 p-2">
                <p className="font-semibold">{item.action || "accion"}</p>
                <p className="text-neutral-300">{item.detail || "-"}</p>
                <p className="text-xs text-neutral-500">{item.createdAt}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-2 text-xl font-semibold">Snapshots y rollback</h2>
          <div className="max-h-52 space-y-2 overflow-auto pr-1 text-sm">
            {snapshots.map((snap) => (
              <div key={snap} className="flex items-center justify-between rounded bg-neutral-800 p-2">
                <span className="line-clamp-1 pr-2">{snap}</span>
                <button className="btn bg-amber-700 hover:bg-amber-600" onClick={() => handleRollback(snap)}>Restaurar</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button className="btn bg-green-600 hover:bg-green-700" onClick={saveToFile}>Guardar todo</button>
        <button className="btn bg-red-700 hover:bg-red-600" onClick={logout}>Cerrar sesion</button>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 8px;
          background: #111;
          color: #fff;
          border: 1px solid #2a2a2a;
          padding: 8px 10px;
          outline: none;
        }
        .input:focus {
          border-color: #ec4899;
        }
        .btn {
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 600;
          transition: 0.2s;
        }
        .chip {
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 11px;
          background: #262626;
        }
        .chip-on {
          background: #be185d;
        }
        .kpi {
          border-radius: 10px;
          background: #111;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-height: 66px;
        }
        .kpi span {
          font-size: 11px;
          color: #a3a3a3;
        }
        .kpi strong {
          font-size: 20px;
          color: #fff;
          line-height: 1;
        }
      `}</style>
    </div>
  );
}
