import { useState, useEffect } from "react";
import { useRouter } from "next/router";

export default function Login() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/admin/me");
        if (res.ok) router.push("/admin");
      } catch {
        // no-op
      }
    };
    check();
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.message || "No se pudo iniciar sesion");
        return;
      }

      router.push("/admin");
    } catch {
      setError("Error de red al iniciar sesion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
      <div className="bg-neutral-900 p-8 rounded-2xl shadow-lg w-80">
        <h1 className="text-2xl font-bold text-center text-pink-500 mb-6">Acceso Administrador</h1>

        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Usuario"
            className="input"
            value={user}
            onChange={(e) => setUser(e.target.value)}
          />
          <input
            type="password"
            placeholder="Contrasena"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button type="submit" className="btn bg-pink-600 hover:bg-pink-700 mt-2" disabled={loading}>
            {loading ? "Entrando..." : "Iniciar sesion"}
          </button>
        </form>
      </div>

      <style jsx>{`
        .input {
          background: #111;
          color: white;
          border-radius: 8px;
          padding: 10px;
          width: 100%;
          outline: none;
        }
        .btn {
          display: block;
          width: 100%;
          padding: 10px;
          border-radius: 8px;
          font-weight: 600;
          transition: 0.3s;
        }
      `}</style>
    </div>
  );
}
