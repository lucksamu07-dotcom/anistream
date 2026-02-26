import { useEffect, useState } from "react";
import { useRouter } from "next/router";

function toId(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function normalizeGenreInput(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export default function Admin() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [animes, setAnimes] = useState([]);
  const [selectedAnime, setSelectedAnime] = useState(null);

  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [enrichLoading, setEnrichLoading] = useState(false);

  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [episodeAutoLoading, setEpisodeAutoLoading] = useState(false);
  const [repairLoading, setRepairLoading] = useState(false);

  const [newAnime, setNewAnime] = useState({
    title: "",
    year: "",
    genre: [],
    description: "",
    cover: "",
    episodes: [],
  });

  const [newEpisode, setNewEpisode] = useState({
    title: "",
    sourceUrl: "",
  });

  const [editingAnime, setEditingAnime] = useState(null);
  const [editingEpisode, setEditingEpisode] = useState(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const authRes = await fetch("/api/admin/me");
        if (!authRes.ok) {
          router.push("/login");
          return;
        }

        const res = await fetch("/api/mock/read");
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) throw new Error("Error al cargar los datos");

        const json = await res.json();
        if (active) setAnimes(Array.isArray(json) ? json : []);
      } catch (err) {
        console.error(err);
        if (active) setError("Error cargando datos");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [router]);

  const handleLookupByName = async () => {
    if (!newAnime.title.trim()) {
      setLookupMessage("Escribe un nombre primero");
      setLookupResult(null);
      return;
    }

    setLookupLoading(true);
    setLookupMessage("");
    setLookupResult(null);

    try {
      const res = await fetch("/api/mock/enrich-one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newAnime.title }),
      });
      const data = await res.json();

      if (!res.ok) {
        setLookupMessage(data?.message || "No se encontro en la fuente");
        return;
      }

      setLookupResult({
        metadata: data.metadata || {},
        source: data.source || "desconocida",
        confidence: data.confidence ?? 0,
        accepted: Boolean(data.accepted),
      });
      setLookupMessage(data.message || "Resultado encontrado");
    } catch (err) {
      setLookupMessage("Error consultando la fuente");
    } finally {
      setLookupLoading(false);
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
      episodes:
        Array.isArray(prev.episodes) && prev.episodes.length > 0
          ? prev.episodes
          : Array.isArray(meta.episodes)
          ? meta.episodes
          : [],
      genre:
        normalizeGenreInput(prev.genre).length > 0
          ? normalizeGenreInput(prev.genre)
          : normalizeGenreInput(meta.genre),
    }));

    setLookupMessage("Datos aplicados al formulario. Ahora puedes agregar la serie.");
  };

  const handleAddAnime = () => {
    if (!newAnime.title.trim()) return alert("Completa el titulo");

    const id = toId(newAnime.title);
    if (!id) return alert("Titulo invalido");
    if (animes.find((a) => a.id === id)) {
      return alert("Ya existe una serie con ese titulo");
    }

    const anime = {
      ...newAnime,
      id,
      year: newAnime.year || "",
      genre: normalizeGenreInput(newAnime.genre),
      description: newAnime.description || "",
      cover: newAnime.cover || "",
      episodes: Array.isArray(newAnime.episodes) ? newAnime.episodes : [],
    };

    setAnimes((prev) => [...prev, anime]);
    setNewAnime({
      title: "",
      year: "",
      genre: [],
      description: "",
      cover: "",
      episodes: [],
    });
    setLookupMessage("");
    setLookupResult(null);
  };

  const handleSaveEditAnime = (id) => {
    const updated = animes.map((a) =>
      a.id === id
        ? {
            ...a,
            ...editingAnime,
            genre: normalizeGenreInput(editingAnime.genre),
          }
        : a
    );
    setAnimes(updated);
    setEditingAnime(null);
  };

  const handleDeleteAnime = (id) => {
    if (!confirm("Eliminar esta serie y todos sus episodios?")) return;
    setAnimes((prev) => prev.filter((a) => a.id !== id));
    if (selectedAnime === id) setSelectedAnime(null);
  };

  const handleAddEpisode = () => {
    if (!selectedAnime) return alert("Selecciona una serie primero");
    if (!newEpisode.title) return alert("Completa titulo del episodio");

    const updated = animes.map((a) =>
      a.id === selectedAnime
        ? {
            ...a,
            episodes: [
              ...a.episodes,
              {
                id: `ep${a.episodes.length + 1}`,
                title: newEpisode.title,
                slug: `${a.id}-ep${a.episodes.length + 1}`,
                sourceUrl: newEpisode.sourceUrl || "",
                sources: newEpisode.sourceUrl
                  ? [{ label: "Principal", url: newEpisode.sourceUrl }]
                  : [],
              },
            ],
          }
        : a
    );

    setAnimes(updated);
    setNewEpisode({ title: "", sourceUrl: "" });
  };

  const autoFillEpisodesForSelectedAnime = async () => {
    const selected = animes.find((a) => a.id === selectedAnime);
    if (!selected?.title) {
      setSyncMessage("No se encontro la serie seleccionada");
      return;
    }

    setEpisodeAutoLoading(true);
    setSyncMessage("");

    try {
      const res = await fetch("/api/mock/enrich-episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: selected.title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "No se pudo autocompletar episodios");

      const incomingEpisodes = Array.isArray(data?.episodes)
        ? data.episodes
        : [];

      if (incomingEpisodes.length === 0) {
        setSyncMessage("No se detectaron episodios automaticos para esta serie");
        return;
      }

      const updated = animes.map((anime) => {
        if (anime.id !== selectedAnime) return anime;

        const current = Array.isArray(anime.episodes) ? anime.episodes : [];
        const merged = [...current];

        for (const ep of incomingEpisodes) {
          const exists = merged.find((m) => {
            if (ep.slug && m.slug && ep.slug === m.slug) return true;
            if (ep.sourceUrl && m.sourceUrl && ep.sourceUrl === m.sourceUrl) return true;
            return false;
          });
          if (!exists) {
            merged.push({
              id: ep.id || `ep${merged.length + 1}`,
              title: ep.title || `Episodio ${merged.length + 1}`,
              slug: ep.slug || `${anime.id}-ep${merged.length + 1}`,
              sourceUrl: ep.sourceUrl || "",
              sources: Array.isArray(ep.sources) ? ep.sources : [],
            });
          }
        }

        return { ...anime, episodes: merged };
      });

      setAnimes(updated);
      setSyncMessage(`Episodios autocompletados: ${incomingEpisodes.length}`);
    } catch (err) {
      setSyncMessage(`Error autocompletando episodios: ${err.message}`);
    } finally {
      setEpisodeAutoLoading(false);
    }
  };

  const repairEpisodeUrlsForSelectedAnime = async () => {
    const selected = animes.find((a) => a.id === selectedAnime);
    if (!selected?.title) {
      setSyncMessage("No se encontro la serie seleccionada");
      return;
    }

    setRepairLoading(true);
    setSyncMessage("");

    try {
      const res = await fetch("/api/mock/repair-episode-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selected.title,
          episodes: Array.isArray(selected.episodes) ? selected.episodes : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "No se pudo reparar URLs");

      const updated = animes.map((anime) =>
        anime.id === selectedAnime
          ? { ...anime, episodes: Array.isArray(data.updatedEpisodes) ? data.updatedEpisodes : anime.episodes }
          : anime
      );
      setAnimes(updated);
      setSyncMessage(
        `URLs reparadas: ${data.replacedCount || 0} | Nuevas detectadas: ${data.foundFreshEpisodes || 0}`
      );
    } catch (err) {
      setSyncMessage(`Error reparando URLs: ${err.message}`);
    } finally {
      setRepairLoading(false);
    }
  };

  const handleSaveEditEpisode = (animeId, epId) => {
    const updated = animes.map((a) => {
      if (a.id !== animeId) return a;
      return {
        ...a,
        episodes: a.episodes.map((e) =>
          e.id === epId ? { ...e, ...editingEpisode } : e
        ),
      };
    });

    setAnimes(updated);
    setEditingEpisode(null);
  };

  const handleDeleteEpisode = (animeId, epId) => {
    if (!confirm("Eliminar este episodio?")) return;
    const updated = animes.map((a) => {
      if (a.id !== animeId) return a;
      return {
        ...a,
        episodes: a.episodes.filter((e) => e.id !== epId),
      };
    });
    setAnimes(updated);
  };

  const saveToFile = async () => {
    try {
      const res = await fetch("/api/mock/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(animes),
      });
      const result = await res.json();
      const enrichedInfo =
        typeof result.enrichedCount === "number"
          ? `\nMetadatos autocompletados: ${result.enrichedCount}`
          : "";
      const consolidatedInfo =
        typeof result.consolidatedCount === "number"
          ? `\nSeries consolidadas: ${result.consolidatedCount}`
          : "";
      alert((result.message || "Guardado correctamente") + enrichedInfo + consolidatedInfo);
    } catch (err) {
      console.error(err);
      alert("Error al guardar los datos");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  };

  const syncStreamtape = async () => {
    setSyncLoading(true);
    setSyncMessage("");

    try {
      const res = await fetch("/api/syncStreamtape");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAnimes(data.animesActualizados);
      setSyncMessage(`Sincronizacion: ${data.message}`);
    } catch (err) {
      setSyncMessage(`Error: ${err.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const previewEnrich = async () => {
    setEnrichLoading(true);
    setSyncMessage("");

    try {
      const res = await fetch("/api/mock/enrich-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(animes),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "No se pudo autocompletar");

      setAnimes(Array.isArray(data.animes) ? data.animes : []);
      setSyncMessage(
        `Autocompletado en vista: ${data.enrichedCount || 0} | Consolidados: ${data.consolidatedCount || 0}`
      );
    } catch (err) {
      setSyncMessage(`Error autocompletando: ${err.message}`);
    } finally {
      setEnrichLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-neutral-950 p-8 text-white">Cargando...</div>;
  }

  if (error) {
    return <div className="min-h-screen bg-neutral-950 p-8 text-white">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-8 text-white">
      <h1 className="mb-6 text-center text-3xl font-bold text-pink-500">Panel de Administracion</h1>

      <div className="mb-6 rounded-xl bg-neutral-900 p-4">
        <h2 className="mb-2 text-lg font-semibold">Sincronizacion automatica</h2>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={syncStreamtape}
            disabled={syncLoading}
            className="btn bg-blue-600 hover:bg-blue-700"
          >
            {syncLoading ? "Sincronizando..." : "Sincronizar Streamtape"}
          </button>

          <button
            onClick={previewEnrich}
            disabled={enrichLoading}
            className="btn bg-violet-600 hover:bg-violet-700"
          >
            {enrichLoading ? "Autocompletando..." : "Autocompletar ahora"}
          </button>
        </div>

        {syncMessage && <p className="mt-2 text-sm text-neutral-300">{syncMessage}</p>}
      </div>

      <div className="mb-8 rounded-xl bg-neutral-900 p-4">
        <h2 className="mb-2 text-xl font-semibold">Agregar nueva serie</h2>
        <p className="mb-3 text-sm text-neutral-400">
          1) Escribe nombre y pulsa "Buscar y autocompletar". 2) Si no encuentra, completa manualmente.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <input
            placeholder="Nombre del hentai"
            className="input sm:col-span-2"
            value={newAnime.title}
            onChange={(e) => setNewAnime({ ...newAnime, title: e.target.value })}
          />

          <button
            onClick={handleLookupByName}
            disabled={lookupLoading}
            className="btn bg-indigo-600 hover:bg-indigo-700"
          >
            {lookupLoading ? "Buscando..." : "Buscar y autocompletar"}
          </button>
        </div>

        {lookupMessage && <p className="mt-2 text-sm text-neutral-300">{lookupMessage}</p>}

        {lookupResult?.metadata && (
          <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3">
            <p className="text-xs text-neutral-400">
              Fuente: <span className="text-neutral-200">{lookupResult.source}</span> | Confianza:{" "}
              <span className={`${lookupResult.accepted ? "text-green-400" : "text-yellow-400"}`}>
                {(lookupResult.confidence * 100).toFixed(1)}%
              </span>
            </p>

            <p className="mt-2 text-sm">
              <span className="text-neutral-400">Titulo:</span>{" "}
              <span className="text-neutral-100">{lookupResult.metadata.title || "-"}</span>
            </p>
            <p className="text-sm">
              <span className="text-neutral-400">Ano:</span>{" "}
              <span className="text-neutral-100">{lookupResult.metadata.year || "-"}</span>
            </p>
            <p className="text-sm">
              <span className="text-neutral-400">Genero:</span>{" "}
              <span className="text-neutral-100">
                {Array.isArray(lookupResult.metadata.genre)
                  ? lookupResult.metadata.genre.join(", ")
                  : lookupResult.metadata.genre || "-"}
              </span>
            </p>
            <p className="text-sm">
              <span className="text-neutral-400">Episodios detectados:</span>{" "}
              <span className="text-neutral-100">
                {Array.isArray(lookupResult.metadata.episodes)
                  ? lookupResult.metadata.episodes.length
                  : 0}
              </span>
            </p>

            {lookupResult.metadata.cover ? (
              <img
                src={lookupResult.metadata.cover}
                alt={lookupResult.metadata.title || "preview"}
                className="mt-2 h-32 w-24 rounded object-cover"
              />
            ) : null}

            <button
              type="button"
              onClick={applyLookupResult}
              className="btn mt-3 bg-emerald-600 hover:bg-emerald-700"
            >
              Aplicar datos
            </button>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            placeholder="Ano (manual opcional)"
            className="input"
            value={newAnime.year}
            onChange={(e) => setNewAnime({ ...newAnime, year: e.target.value })}
          />

          <input
            placeholder="Genero (manual opcional)"
            className="input"
            value={Array.isArray(newAnime.genre) ? newAnime.genre.join(", ") : newAnime.genre}
            onChange={(e) => setNewAnime({ ...newAnime, genre: e.target.value })}
          />

          <input
            placeholder="URL de portada (manual opcional)"
            className="input sm:col-span-2"
            value={newAnime.cover}
            onChange={(e) => setNewAnime({ ...newAnime, cover: e.target.value })}
          />
        </div>

        <textarea
          placeholder="Descripcion (manual opcional)"
          className="input mt-3"
          rows="3"
          value={newAnime.description}
          onChange={(e) => setNewAnime({ ...newAnime, description: e.target.value })}
        />

        <button onClick={handleAddAnime} className="btn mt-4 bg-pink-600 hover:bg-pink-700">
          Agregar serie
        </button>
      </div>

      <h2 className="mb-3 text-xl font-semibold">Series existentes</h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {animes.map((a) => (
          <div key={a.id} className="rounded-lg bg-neutral-900 p-3">
            {editingAnime?.id === a.id ? (
              <>
                <input
                  className="input mb-2"
                  value={editingAnime.title}
                  onChange={(e) => setEditingAnime({ ...editingAnime, title: e.target.value })}
                />
                <input
                  className="input mb-2"
                  value={editingAnime.cover}
                  onChange={(e) => setEditingAnime({ ...editingAnime, cover: e.target.value })}
                />
                <input
                  className="input mb-2"
                  value={editingAnime.year}
                  onChange={(e) => setEditingAnime({ ...editingAnime, year: e.target.value })}
                />
                <button onClick={() => handleSaveEditAnime(a.id)} className="btn bg-green-600 hover:bg-green-700">
                  Guardar
                </button>
              </>
            ) : (
              <>
                {a.cover ? (
                  <img src={a.cover} alt={a.title} className="mb-2 h-40 w-full rounded object-cover" />
                ) : (
                  <div className="mb-2 flex h-40 w-full items-center justify-center rounded bg-neutral-800 text-xs text-neutral-400">
                    Sin portada
                  </div>
                )}
                <h3 className="text-sm font-semibold">{a.title}</h3>
                <p className="mb-2 text-xs text-neutral-400">{a.year || "Sin ano"}</p>
                <div className="flex justify-between gap-2">
                  <button
                    onClick={() => setSelectedAnime(a.id)}
                    className={`rounded px-3 py-1 text-xs ${
                      selectedAnime === a.id ? "bg-pink-600" : "bg-neutral-700 hover:bg-neutral-600"
                    }`}
                  >
                    {selectedAnime === a.id ? "Seleccionado" : "Agregar episodio"}
                  </button>
                  <button
                    onClick={() => setEditingAnime(a)}
                    className="rounded bg-blue-600 px-3 py-1 text-xs hover:bg-blue-700"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteAnime(a.id)}
                    className="rounded bg-red-600 px-3 py-1 text-xs hover:bg-red-700"
                  >
                    Borrar
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {selectedAnime && (
        <div className="mb-8 rounded-xl bg-neutral-900 p-4">
          <h2 className="mb-2 text-xl font-semibold">Episodios de la serie seleccionada</h2>

          <button
            type="button"
            onClick={autoFillEpisodesForSelectedAnime}
            disabled={episodeAutoLoading}
            className="btn mb-3 bg-indigo-600 hover:bg-indigo-700"
          >
            {episodeAutoLoading ? "Buscando episodios..." : "Autocompletar episodios"}
          </button>

          <button
            type="button"
            onClick={repairEpisodeUrlsForSelectedAnime}
            disabled={repairLoading}
            className="btn mb-3 ml-2 bg-cyan-600 hover:bg-cyan-700"
          >
            {repairLoading ? "Reparando URLs..." : "Reparar URLs de episodios"}
          </button>

          {(animes.find((a) => a.id === selectedAnime)?.episodes || []).map((ep) => (
              <div key={ep.id} className="mb-2 flex items-center justify-between rounded bg-neutral-800 p-2">
                {editingEpisode?.id === ep.id ? (
                  <>
                    <input
                      className="input mr-2"
                      value={editingEpisode.title}
                      onChange={(e) => setEditingEpisode({ ...editingEpisode, title: e.target.value })}
                    />
                    <button
                      onClick={() => handleSaveEditEpisode(selectedAnime, ep.id)}
                      className="rounded bg-green-600 px-3 py-1 text-xs hover:bg-green-700"
                    >
                      Guardar
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span>{ep.title}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                          ep.sourceUrl ? "bg-emerald-700/60 text-emerald-200" : "bg-amber-700/60 text-amber-200"
                        }`}
                      >
                        {ep.sourceUrl ? "Con URL" : "Sin URL"}
                      </span>
                    </div>
                    <div>
                      <button
                        onClick={() => setEditingEpisode(ep)}
                        className="mr-2 rounded bg-blue-600 px-3 py-1 text-xs hover:bg-blue-700"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteEpisode(selectedAnime, ep.id)}
                        className="rounded bg-red-600 px-3 py-1 text-xs hover:bg-red-700"
                      >
                        Borrar
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Titulo del episodio"
              className="input"
              value={newEpisode.title}
              onChange={(e) => setNewEpisode({ ...newEpisode, title: e.target.value })}
            />
            <input
              placeholder="URL del video (opcional)"
              className="input"
              value={newEpisode.sourceUrl}
              onChange={(e) => setNewEpisode({ ...newEpisode, sourceUrl: e.target.value })}
            />
          </div>

          <button onClick={handleAddEpisode} className="btn mt-4 bg-pink-600 hover:bg-pink-700">
            Agregar episodio
          </button>
        </div>
      )}

      <div className="flex flex-col justify-center gap-4 text-center sm:flex-row">
        <button onClick={saveToFile} className="btn bg-green-600 hover:bg-green-700">
          Guardar cambios
        </button>
        <button onClick={handleLogout} className="btn bg-red-600 hover:bg-red-700">
          Cerrar sesion
        </button>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 8px;
          background: #111;
          color: white;
          padding: 8px 10px;
          outline: none;
        }

        .btn {
          display: inline-block;
          border-radius: 8px;
          padding: 8px 16px;
          font-weight: 600;
          transition: 0.3s;
        }
      `}</style>
    </div>
  );
}

export async function getServerSideProps(context) {
  const { isAdminRequest } = await import("../lib/adminAuth");
  if (!isAdminRequest(context.req)) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  return { props: {} };
}
