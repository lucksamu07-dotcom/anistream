import { useState, useEffect } from "react";
import { useRouter } from "next/router";

export default function Admin() {
  const router = useRouter();

  // 🔒 Protección de acceso
  useEffect(() => {
    const isLoggedIn =
      typeof window !== "undefined" && localStorage.getItem("loggedIn");
    if (isLoggedIn !== "true") router.push("/login");
  }, [router]);

  const [loading, setLoading] = useState(true);
  const [animes, setAnimes] = useState([]);
  const [error, setError] = useState("");
  const [selectedAnime, setSelectedAnime] = useState(null);

  // 🔁 Sincronización Streamtape
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  const [newAnime, setNewAnime] = useState({
    title: "",
    year: "",
    genre: "",
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

  // 🚀 Cargar datos desde la API
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/mock/read");
        if (!res.ok) throw new Error("Error al cargar los datos");
        const json = await res.json();
        setAnimes(Array.isArray(json) ? json : []);
      } catch (err) {
        console.error(err);
        setError("❌ Error cargando datos");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ➕ Agregar nueva serie
  const handleAddAnime = () => {
    if (!newAnime.title || !newAnime.cover)
      return alert("Completa título y portada");

    const id = newAnime.title.toLowerCase().replace(/\s+/g, "-");
    if (animes.find((a) => a.id === id))
      return alert("Ya existe una serie con ese título");

    const anime = { ...newAnime, id, episodes: [] };
    setAnimes([...animes, anime]);
    setNewAnime({
      title: "",
      year: "",
      genre: "",
      description: "",
      cover: "",
      episodes: [],
    });
  };

  // ✏️ Guardar edición de serie
  const handleSaveEditAnime = (id) => {
    const updated = animes.map((a) =>
      a.id === id ? { ...a, ...editingAnime } : a
    );
    setAnimes(updated);
    setEditingAnime(null);
  };

  // ➖ Eliminar serie
  const handleDeleteAnime = (id) => {
    if (!confirm("¿Eliminar esta serie y todos sus episodios?")) return;
    setAnimes(animes.filter((a) => a.id !== id));
    if (selectedAnime === id) setSelectedAnime(null);
  };

  // ➕ Agregar episodio
  const handleAddEpisode = () => {
    if (!selectedAnime) return alert("Selecciona una serie primero");
    if (!newEpisode.title || !newEpisode.sourceUrl)
      return alert("Completa título y URL del episodio");

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
                sourceUrl: newEpisode.sourceUrl,
              },
            ],
          }
        : a
    );
    setAnimes(updated);
    setNewEpisode({ title: "", sourceUrl: "" });
  };

  // ✏️ Guardar edición de episodio
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

  // ➖ Eliminar episodio
  const handleDeleteEpisode = (animeId, epId) => {
    if (!confirm("¿Eliminar este episodio?")) return;
    const updated = animes.map((a) => {
      if (a.id !== animeId) return a;
      const newEpisodes = a.episodes.filter((e) => e.id !== epId);
      return { ...a, episodes: newEpisodes };
    });
    setAnimes(updated);
  };

  // 💾 Guardar datos
  const saveToFile = async () => {
    try {
      const res = await fetch("/api/mock/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(animes),
      });
      const result = await res.json();
      alert(result.message || "Guardado correctamente ✅");
    } catch (err) {
      console.error(err);
      alert("❌ Error al guardar los datos");
    }
  };

  // 🚪 Cerrar sesión
  const handleLogout = () => {
    localStorage.removeItem("loggedIn");
    router.push("/login");
  };

  // 🔁 Sincronizar videos desde Streamtape
const syncStreamtape = async () => {
  setSyncLoading(true);
  setSyncMessage("");

  try {
    const res = await fetch("/api/syncStreamtape");
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    // IMPORTANTE: el API debe devolver animesActualizados
    setAnimes(data.animesActualizados);
    setSyncMessage(`✅ ${data.message}`);
  } catch (err) {
    setSyncMessage(`❌ Error: ${err.message}`);
  }

  setSyncLoading(false);
};

  if (loading)
    return (
      <div className="min-h-screen bg-neutral-950 text-white p-8">Cargando...</div>
    );
  if (error)
    return (
      <div className="min-h-screen bg-neutral-950 text-white p-8">{error}</div>
    );

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-6 text-center text-pink-500">
        Panel de Administración
      </h1>

      {/* 🔁 Streamtape Sync */}
<div className="bg-neutral-900 p-4 rounded-xl mb-6">
  <h2 className="text-lg font-semibold mb-2">
    Sincronización automática
  </h2>

  <button
    onClick={syncStreamtape}
    disabled={syncLoading}
    className="btn bg-blue-600 hover:bg-blue-700"
  >
    {syncLoading ? "🔄 Sincronizando..." : "🔁 Sincronizar Streamtape"}
  </button>

  {syncMessage && (
    <p className="mt-2 text-sm text-neutral-300">{syncMessage}</p>
  )}
</div>

      {/* Formulario Nueva Serie */}
      <div className="bg-neutral-900 p-4 rounded-xl mb-8">
        <h2 className="text-xl font-semibold mb-2">Agregar nueva serie</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            placeholder="Título"
            className="input"
            value={newAnime.title}
            onChange={(e) => setNewAnime({ ...newAnime, title: e.target.value })}
          />
          <input
            placeholder="Año"
            className="input"
            value={newAnime.year}
            onChange={(e) => setNewAnime({ ...newAnime, year: e.target.value })}
          />
          <input
            placeholder="Género"
            className="input"
            value={newAnime.genre}
            onChange={(e) => setNewAnime({ ...newAnime, genre: e.target.value })}
          />
          <input
            placeholder="URL de portada"
            className="input"
            value={newAnime.cover}
            onChange={(e) => setNewAnime({ ...newAnime, cover: e.target.value })}
          />
        </div>
        <textarea
          placeholder="Descripción"
          className="input mt-3"
          rows="3"
          value={newAnime.description}
          onChange={(e) =>
            setNewAnime({ ...newAnime, description: e.target.value })
          }
        />
        <button
          onClick={handleAddAnime}
          className="btn mt-4 bg-pink-600 hover:bg-pink-700"
        >
          ➕ Agregar Serie
        </button>
      </div>

      {/* Lista de Series */}
      <h2 className="text-xl font-semibold mb-3">Series existentes</h2>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {animes.map((a) => (
          <div key={a.id} className="bg-neutral-900 p-3 rounded-lg">
            {editingAnime?.id === a.id ? (
              <>
                <input
                  className="input mb-2"
                  value={editingAnime.title}
                  onChange={(e) =>
                    setEditingAnime({ ...editingAnime, title: e.target.value })
                  }
                />
                <input
                  className="input mb-2"
                  value={editingAnime.cover}
                  onChange={(e) =>
                    setEditingAnime({ ...editingAnime, cover: e.target.value })
                  }
                />
                <input
                  className="input mb-2"
                  value={editingAnime.year}
                  onChange={(e) =>
                    setEditingAnime({ ...editingAnime, year: e.target.value })
                  }
                />
                <button
                  onClick={() => handleSaveEditAnime(a.id)}
                  className="btn bg-green-600 hover:bg-green-700"
                >
                  💾 Guardar
                </button>
              </>
            ) : (
              <>
                <img
                  src={a.cover}
                  alt={a.title}
                  className="rounded mb-2 h-40 w-full object-cover"
                />
                <h3 className="font-semibold text-sm">{a.title}</h3>
                <p className="text-xs text-neutral-400 mb-2">{a.year}</p>
                <div className="flex justify-between">
                  <button
                    onClick={() => setSelectedAnime(a.id)}
                    className={`text-xs px-3 py-1 rounded ${
                      selectedAnime === a.id
                        ? "bg-pink-600"
                        : "bg-neutral-700 hover:bg-neutral-600"
                    }`}
                  >
                    {selectedAnime === a.id
                      ? "Seleccionado"
                      : "Agregar episodio"}
                  </button>
                  <button
                    onClick={() => setEditingAnime(a)}
                    className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => handleDeleteAnime(a.id)}
                    className="text-xs px-3 py-1 bg-red-600 hover:bg-red-700 rounded"
                  >
                    🗑️
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Formulario de Episodios */}
      {selectedAnime && (
        <div className="bg-neutral-900 p-4 rounded-xl mb-8">
          <h2 className="text-xl font-semibold mb-2">
            Episodios de la serie seleccionada
          </h2>

          {animes
            .find((a) => a.id === selectedAnime)
            ?.episodes.map((ep) => (
              <div
                key={ep.id}
                className="flex justify-between items-center bg-neutral-800 rounded p-2 mb-2"
              >
                {editingEpisode?.id === ep.id ? (
                  <>
                    <input
                      className="input mr-2"
                      value={editingEpisode.title}
                      onChange={(e) =>
                        setEditingEpisode({
                          ...editingEpisode,
                          title: e.target.value,
                        })
                      }
                    />
                    <button
                      onClick={() =>
                        handleSaveEditEpisode(selectedAnime, ep.id)
                      }
                      className="text-xs px-3 py-1 bg-green-600 hover:bg-green-700 rounded"
                    >
                      💾
                    </button>
                  </>
                ) : (
                  <>
                    <span>{ep.title}</span>
                    <div>
                      <button
                        onClick={() => setEditingEpisode(ep)}
                        className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded mr-2"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteEpisode(selectedAnime, ep.id)}
                        className="text-xs px-3 py-1 bg-red-600 hover:bg-red-700 rounded"
                      >
                        🗑️
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            <input
              placeholder="Título del episodio"
              className="input"
              value={newEpisode.title}
              onChange={(e) =>
                setNewEpisode({ ...newEpisode, title: e.target.value })
              }
            />
            <input
              placeholder="URL del video (Streamtape...)"
              className="input"
              value={newEpisode.sourceUrl}
              onChange={(e) =>
                setNewEpisode({ ...newEpisode, sourceUrl: e.target.value })
              }
            />
          </div>
          <button
            onClick={handleAddEpisode}
            className="btn mt-4 bg-pink-600 hover:bg-pink-700"
          >
            ➕ Agregar Episodio
          </button>
        </div>
      )}

      {/* Botones finales */}
      <div className="text-center flex flex-col sm:flex-row justify-center gap-4">
        <button
          onClick={saveToFile}
          className="btn bg-green-600 hover:bg-green-700"
        >
          💾 Guardar cambios
        </button>
        <button
          onClick={handleLogout}
          className="btn bg-red-600 hover:bg-red-700"
        >
          🚪 Cerrar sesión
        </button>
      </div>

      <style jsx>{`
        .input {
          background: #111;
          color: white;
          border-radius: 8px;
          padding: 8px 10px;
          width: 100%;
          outline: none;
        }
        .btn {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 600;
          transition: 0.3s;
        }
      `}</style>
    </div>
  );
}