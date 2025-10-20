import { useState, useEffect } from "react";
import { useRouter } from "next/router";

export default function Login() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // Si ya está logueado, redirige al panel
    if (localStorage.getItem("loggedIn") === "true") {
      router.push("/admin");
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();

    // Usuario y contraseña configurados
    const USER = "admin";
    const PASS = "anistream123";

    if (user === USER && password === PASS) {
      localStorage.setItem("loggedIn", "true");
      router.push("/admin");
    } else {
      setError("❌ Usuario o contraseña incorrectos");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
      <div className="bg-neutral-900 p-8 rounded-2xl shadow-lg w-80">
        <h1 className="text-2xl font-bold text-center text-pink-500 mb-6">
          Acceso Administrador
        </h1>

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
            placeholder="Contraseña"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            className="btn bg-pink-600 hover:bg-pink-700 mt-2"
          >
            Iniciar sesión
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
